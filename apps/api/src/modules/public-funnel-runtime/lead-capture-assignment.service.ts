import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  LeadSourceChannel as PrismaLeadSourceChannel,
  Prisma,
} from '@prisma/client';
import { TrackingEventsService } from '../events/tracking-events.service';
import { LeadDispatcherService } from '../messaging-automation/lead-dispatcher.service';
import { MessagingAutomationService } from '../messaging-automation/messaging-automation.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { RegisterPublicVisitorDto } from './dto/register-public-visitor.dto';
import type { CapturePublicLeadDto } from './dto/capture-public-lead.dto';
import type { AutoAssignPublicLeadDto } from './dto/auto-assign-public-lead.dto';
import type { SubmitPublicLeadCaptureDto } from './dto/submit-public-lead-capture.dto';
import { buildPublicationStepPath } from './public-funnel-runtime.utils';
import { pickNextRotationMember } from './lead-capture-assignment.utils';
import {
  buildPublicWhatsappMessage,
  buildPublicWhatsappUrl,
  normalizeWhatsappPhone,
  resolvePublicHandoffConfig,
  toPublicVisibleSponsor,
} from './reveal-handoff.utils';

const eligibleMemberInclude = {
  sponsor: true,
} satisfies Prisma.RotationMemberInclude;

const flowPublicationInclude = {
  domain: true,
  handoffStrategy: true,
  funnelInstance: {
    include: {
      legacyFunnel: true,
      handoffStrategy: true,
      rotationPool: {
        include: {
          members: {
            where: {
              isActive: true,
              sponsor: {
                isActive: true,
                status: 'active',
                availabilityStatus: 'available',
              },
            },
            orderBy: {
              position: 'asc',
            },
            include: eligibleMemberInclude,
          },
        },
      },
      steps: {
        orderBy: {
          position: 'asc',
        },
      },
    },
  },
} satisfies Prisma.FunnelPublicationInclude;

type TransactionClient = Prisma.TransactionClient;
type FlowPublicationRecord = Prisma.FunnelPublicationGetPayload<{
  include: typeof flowPublicationInclude;
}>;
type RotationPoolWithMembers = Prisma.RotationPoolGetPayload<{
  include: {
    members: {
      include: typeof eligibleMemberInclude;
    };
  };
}>;

type AssignmentSummary = {
  id: string;
  status: string;
  reason: string;
  assignedAt: string;
  sponsor: {
    id: string;
    displayName: string;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
  };
};

type PublicAssignedAdvisor = {
  id: string;
  sponsorId: string;
  name: string;
  role: string;
  bio: string;
  phone: string | null;
  photoUrl: string | null;
};

type StepNavigation = {
  id: string;
  slug: string;
  path: string;
  stepType: string;
} | null;

type LeadCaptureResult = {
  lead: Prisma.LeadGetPayload<Record<string, never>>;
  wasCreated: boolean;
};

type AssignmentResolution = {
  assignment: AssignmentSummary | null;
  advisor: PublicAssignedAdvisor | null;
  wasCreated: boolean;
};

type AssignmentFailureTrackingContext = {
  workspaceId: string;
  publicationId: string;
  funnelInstanceId: string;
  funnelStepId?: string | null;
  triggerEventId?: string | null;
  leadId?: string | null;
};

type RuntimeAttributionPayload = {
  sourceUrl?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  utmMedium?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  ttclid?: string | null;
};

const ASSIGNMENT_FALLBACK_ERROR_CODES = new Set([
  'ROTATION_POOL_NOT_CONFIGURED',
  'ROTATION_POOL_NOT_FOUND',
  'NO_ELIGIBLE_SPONSORS',
  'ROTATION_MEMBER_NOT_FOUND',
]);

const UNASSIGNED_ASSIGNMENT_ERROR_CODES = new Set([
  ...ASSIGNMENT_FALLBACK_ERROR_CODES,
  'NO_FALLBACK_SPONSOR_AVAILABLE',
  'NO_ACTIVE_AD_WHEEL',
  'NO_ACTIVE_AD_WHEEL_PARTICIPANTS',
]);

type DirectEligibleSponsor = Prisma.SponsorGetPayload<Record<string, never>>;
type TeamAssignmentUserRecord = Prisma.UserGetPayload<{
  include: {
    sponsor: true;
  };
}>;

@Injectable()
export class LeadCaptureAssignmentService {
  private readonly logger = new Logger(LeadCaptureAssignmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trackingEventsService: TrackingEventsService,
    private readonly messagingAutomationService: MessagingAutomationService,
    private readonly leadDispatcherService: LeadDispatcherService,
  ) {}

  async registerVisitor(dto: RegisterPublicVisitorDto) {
    return this.prisma.$transaction(async (tx) => {
      const publication = await this.getPublicationContextOrThrow(
        tx,
        dto.publicationId,
      );

      return this.registerVisitorInTransaction(tx, publication, {
        anonymousId: dto.anonymousId,
        kind: dto.kind,
        sourceChannel: dto.sourceChannel ?? 'form',
        sourceUrl: dto.sourceUrl ?? null,
        utmSource: dto.utmSource ?? null,
        utmCampaign: dto.utmCampaign ?? null,
        utmMedium: dto.utmMedium ?? null,
        utmContent: dto.utmContent ?? null,
        utmTerm: dto.utmTerm ?? null,
        fbclid: dto.fbclid ?? null,
        gclid: dto.gclid ?? null,
        ttclid: dto.ttclid ?? null,
      });
    });
  }

  async captureLead(dto: CapturePublicLeadDto) {
    return this.prisma.$transaction(async (tx) => {
      const publication = await this.getPublicationContextOrThrow(
        tx,
        dto.publicationId,
      );

      const visitor = await this.resolveVisitorForCapture(tx, publication, dto);
      const result = await this.captureLeadInTransaction(
        tx,
        publication,
        visitor,
        dto,
      );

      return result.lead;
    });
  }

  async assignLeadToNextSponsor(dto: AutoAssignPublicLeadDto) {
    let failureContext: AssignmentFailureTrackingContext | null = null;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const publication = await this.getPublicationContextOrThrow(
          tx,
          dto.publicationId,
        );
        const lead = await tx.lead.findFirst({
          where: {
            id: dto.leadId,
            workspaceId: publication.workspaceId,
          },
        });

        if (!lead) {
          throw new NotFoundException({
            code: 'LEAD_NOT_FOUND',
            message: `Lead ${dto.leadId} was not found for publication ${dto.publicationId}.`,
          });
        }

        failureContext = {
          workspaceId: publication.workspaceId,
          publicationId: publication.id,
          funnelInstanceId: publication.funnelInstanceId,
          triggerEventId: dto.triggerEventId ?? null,
          leadId: lead.id,
        };

        const { assignment, advisor, wasCreated } =
          await this.assignLeadOrLeaveUnassignedInTransaction(
            tx,
            publication,
            lead,
            {
              triggerEventId: dto.triggerEventId ?? null,
            },
          );
        const nextStep = this.resolveNextStepAfterCaptureFromPublication(
          publication,
          publication.funnelInstance.steps[0]?.id,
        );

        failureContext = null;

        return {
          assignment,
          advisor,
          nextStep,
          assignmentWasCreated: wasCreated,
        };
      });

      if (result.assignmentWasCreated && result.assignment) {
        this.dispatchAssignmentCreatedSideEffects({
          assignmentId: result.assignment.id,
          sponsorId: result.assignment.sponsor.id,
          automation: {
            assignmentId: result.assignment.id,
            triggerType: 'public_auto_assignment_created',
            triggerEventId: dto.triggerEventId ?? null,
          },
        });
      }

      return {
        assignment: result.assignment,
        advisor: result.advisor,
        nextStep: result.nextStep,
      };
    } catch (error) {
      await this.recordAssignmentFailure(failureContext, error);
      throw error;
    }
  }

  async submitLeadCapture(dto: SubmitPublicLeadCaptureDto) {
    let failureContext: AssignmentFailureTrackingContext | null = null;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const publication = await this.getPublicationContextOrThrow(
          tx,
          dto.publicationId,
        );
        const currentStep = publication.funnelInstance.steps.find(
          (step) => step.id === dto.currentStepId,
        );

        if (!currentStep) {
          throw new NotFoundException({
            code: 'STEP_NOT_FOUND',
            message: `Step ${dto.currentStepId} does not belong to publication ${dto.publicationId}.`,
          });
        }

        const visitor = await this.registerVisitorInTransaction(
          tx,
          publication,
          {
            anonymousId: dto.anonymousId,
            kind: 'identified',
            sourceChannel: dto.sourceChannel ?? 'form',
            sourceUrl: dto.sourceUrl ?? null,
            utmSource: dto.utmSource ?? null,
            utmCampaign: dto.utmCampaign ?? null,
            utmMedium: dto.utmMedium ?? null,
            utmContent: dto.utmContent ?? null,
            utmTerm: dto.utmTerm ?? null,
            fbclid: dto.fbclid ?? null,
            gclid: dto.gclid ?? null,
            ttclid: dto.ttclid ?? null,
          },
        );

        const leadResult = await this.captureLeadInTransaction(
          tx,
          publication,
          visitor,
          {
            publicationId: dto.publicationId,
            visitorId: visitor.id,
            anonymousId: dto.anonymousId,
            sourceChannel: dto.sourceChannel ?? 'form',
            fullName: dto.fullName ?? null,
            email: dto.email ?? null,
            phone: dto.phone ?? null,
            companyName: dto.companyName ?? null,
            fieldValues: dto.fieldValues ?? {},
            sourceUrl: dto.sourceUrl ?? null,
            utmSource: dto.utmSource ?? null,
            utmCampaign: dto.utmCampaign ?? null,
            utmMedium: dto.utmMedium ?? null,
            utmContent: dto.utmContent ?? null,
            utmTerm: dto.utmTerm ?? null,
            fbclid: dto.fbclid ?? null,
            gclid: dto.gclid ?? null,
            ttclid: dto.ttclid ?? null,
            tags: dto.tags ?? [],
            triggerEventId: dto.submissionEventId ?? null,
          },
        );

        failureContext = {
          workspaceId: publication.workspaceId,
          publicationId: publication.id,
          funnelInstanceId: publication.funnelInstanceId,
          funnelStepId: dto.currentStepId,
          triggerEventId: dto.submissionEventId ?? null,
          leadId: leadResult.wasCreated ? null : leadResult.lead.id,
        };

        const { assignment, advisor, wasCreated } =
          await this.assignLeadOrLeaveUnassignedInTransaction(
            tx,
            publication,
            leadResult.lead,
            {
              triggerEventId: dto.submissionEventId ?? null,
              funnelStepId: dto.currentStepId,
            },
          );
        const nextStep = this.resolveNextStepAfterCaptureFromPublication(
          publication,
          dto.currentStepId,
        );
        const publicCaptureContext = this.buildPublicCaptureContext({
          publication,
          lead: leadResult.lead,
          assignment,
          advisor,
          nextStep,
        });

        failureContext = null;

        return {
          visitor,
          lead: leadResult.lead,
          assignment,
          advisor,
          assignmentWasCreated: wasCreated,
          nextStep,
          handoff: publicCaptureContext.handoff,
          advisorPayload: publicCaptureContext.advisor,
          assignedAdvisorPayload: publicCaptureContext.assigned_advisor,
        };
      });

      if (result.assignmentWasCreated && result.assignment) {
        this.dispatchAssignmentCreatedSideEffects({
          assignmentId: result.assignment.id,
          sponsorId: result.assignment.sponsor.id,
          automation: {
            assignmentId: result.assignment.id,
            triggerType: 'public_submission_assignment_created',
            triggerEventId: dto.submissionEventId ?? null,
            anonymousId: dto.anonymousId,
            currentStepId: dto.currentStepId,
            nextStepPath: result.nextStep?.path ?? null,
          },
        });
      }

      return {
        visitor: result.visitor,
        lead: result.lead,
        assignment: result.assignment,
        nextStep: result.nextStep,
        handoff: result.handoff,
        advisor: result.advisorPayload,
        assigned_advisor: result.assignedAdvisorPayload,
      };
    } catch (error) {
      await this.recordAssignmentFailure(failureContext, error);
      throw error;
    }
  }

  async listAssignments(filters?: {
    workspaceId?: string;
    sponsorId?: string;
    funnelPublicationId?: string;
  }) {
    return this.prisma.assignment.findMany({
      where: {
        workspaceId: filters?.workspaceId,
        sponsorId: filters?.sponsorId,
        funnelPublicationId: filters?.funnelPublicationId,
      },
      include: {
        sponsor: true,
        lead: true,
      },
      orderBy: {
        assignedAt: 'desc',
      },
    });
  }

  async listLeadsBySponsor(sponsorId: string) {
    return this.prisma.lead.findMany({
      where: {
        assignments: {
          some: {
            sponsorId,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async listLeadsByPublication(funnelPublicationId: string) {
    return this.prisma.lead.findMany({
      where: {
        funnelPublicationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  resolveNextStepAfterCapture(
    publication: FlowPublicationRecord,
    currentStepId: string,
  ): StepNavigation {
    return this.resolveNextStepAfterCaptureFromPublication(
      publication,
      currentStepId,
    );
  }

  private async sendLeadContextUpsert(input: { assignmentId: string }) {
    try {
      await this.leadDispatcherService.dispatchLeadContextUpsert(input);
    } catch (err) {
      this.logger.error('Lead dispatcher failed', err);
    }
  }

  private dispatchAssignmentCreatedSideEffects(input: {
    assignmentId: string;
    sponsorId: string;
    automation: Parameters<
      MessagingAutomationService['dispatchAssignmentAutomation']
    >[0];
  }) {
    this.logger.log(
      `Queueing LEAD_CONTEXT_UPSERT immediately after assignment creation. assignmentId=${input.assignmentId} sponsorId=${input.sponsorId}`,
    );

    void this.sendLeadContextUpsert({
      assignmentId: input.assignmentId,
    });

    void this.messagingAutomationService
      .dispatchAssignmentAutomation(input.automation)
      .catch(() => undefined);
  }

  private async getPublicationContextOrThrow(
    tx: TransactionClient,
    publicationId: string,
  ): Promise<FlowPublicationRecord> {
    const publication = await tx.funnelPublication.findUnique({
      where: { id: publicationId },
      include: flowPublicationInclude,
    });

    if (
      !publication ||
      publication.status !== 'active' ||
      !publication.isActive
    ) {
      throw new NotFoundException({
        code: 'PUBLICATION_NOT_FOUND',
        message: `Publication ${publicationId} is not active.`,
      });
    }

    if (publication.domain.status !== 'active') {
      throw new ConflictException({
        code: 'DOMAIN_INACTIVE',
        message: `Domain ${publication.domain.host} is not active.`,
      });
    }

    if (publication.funnelInstance.status !== 'active') {
      throw new ConflictException({
        code: 'FUNNEL_INSTANCE_INACTIVE',
        message: `Funnel instance ${publication.funnelInstance.id} is not active.`,
      });
    }

    return publication;
  }

  private async resolveVisitorForCapture(
    tx: TransactionClient,
    publication: FlowPublicationRecord,
    dto: CapturePublicLeadDto,
  ) {
    if (dto.visitorId) {
      const visitor = await tx.visitor.findFirst({
        where: {
          id: dto.visitorId,
          workspaceId: publication.workspaceId,
        },
      });

      if (!visitor) {
        throw new NotFoundException({
          code: 'VISITOR_NOT_FOUND',
          message: `Visitor ${dto.visitorId} was not found in workspace ${publication.workspaceId}.`,
        });
      }

      return visitor;
    }

    if (!dto.anonymousId) {
      throw new BadRequestException({
        code: 'ANONYMOUS_ID_REQUIRED',
        message: 'anonymousId is required when visitorId is not provided.',
      });
    }

    return this.registerVisitorInTransaction(tx, publication, {
      anonymousId: dto.anonymousId,
      kind: 'identified',
      sourceChannel: dto.sourceChannel ?? 'form',
      sourceUrl: null,
      utmSource: null,
      utmCampaign: null,
      utmMedium: null,
      utmContent: null,
      utmTerm: null,
      fbclid: null,
      gclid: null,
      ttclid: null,
    });
  }

  private async registerVisitorInTransaction(
    tx: TransactionClient,
    publication: FlowPublicationRecord,
    input: {
      anonymousId: string;
      kind?: 'anonymous' | 'identified';
      sourceChannel: string;
      sourceUrl?: string | null;
      utmSource?: string | null;
      utmCampaign?: string | null;
      utmMedium?: string | null;
      utmContent?: string | null;
      utmTerm?: string | null;
      fbclid?: string | null;
      gclid?: string | null;
      ttclid?: string | null;
    },
  ) {
    const existing = await tx.visitor.findUnique({
      where: {
        workspaceId_anonymousId: {
          workspaceId: publication.workspaceId,
          anonymousId: input.anonymousId,
        },
      },
    });

    const seenAt = new Date();
    const sourceChannel = this.toDbSource(input.sourceChannel);

    const visitor = existing
      ? await tx.visitor.update({
          where: { id: existing.id },
          data: {
            kind:
              input.kind === 'identified' || existing.kind === 'identified'
                ? 'identified'
                : existing.kind,
            lastSeenAt: seenAt,
            sourceChannel,
            utmSource: input.utmSource ?? existing.utmSource,
            utmCampaign: input.utmCampaign ?? existing.utmCampaign,
          },
        })
      : await tx.visitor.create({
          data: {
            workspaceId: publication.workspaceId,
            anonymousId: input.anonymousId,
            kind: input.kind ?? 'anonymous',
            status: 'active',
            sourceChannel,
            firstSeenAt: seenAt,
            lastSeenAt: seenAt,
            utmSource: input.utmSource ?? null,
            utmCampaign: input.utmCampaign ?? null,
          },
        });

    await tx.domainEvent.create({
      data: {
        workspaceId: publication.workspaceId,
        eventId: randomUUID(),
        aggregateType: 'visitor',
        aggregateId: visitor.id,
        eventName: existing ? 'visitor_seen' : 'visitor_registered',
        actorType: 'visitor',
        payload: {
          publicationId: publication.id,
          funnelInstanceId: publication.funnelInstanceId,
          anonymousId: visitor.anonymousId,
          sourceChannel: visitor.sourceChannel,
          attribution: this.buildAttributionPayload(input),
        },
        occurredAt: seenAt,
        funnelInstanceId: publication.funnelInstanceId,
        funnelPublicationId: publication.id,
        visitorId: visitor.id,
      },
    });

    return visitor;
  }

  private async captureLeadInTransaction(
    tx: TransactionClient,
    publication: FlowPublicationRecord,
    visitor: { id: string },
    input: CapturePublicLeadDto &
      RuntimeAttributionPayload & {
        fieldValues?: Record<string, string | null>;
      },
  ): Promise<LeadCaptureResult> {
    const legacyFunnelId = publication.funnelInstance.legacyFunnelId;

    if (!legacyFunnelId) {
      throw new ConflictException({
        code: 'LEGACY_FUNNEL_REQUIRED',
        message:
          'The current funnel instance is not yet linked to a legacy funnel, so lead persistence cannot proceed in v1.',
      });
    }

    const existing = await tx.lead.findFirst({
      where: {
        visitorId: visitor.id,
      },
    });

    const tags = Array.from(new Set(input.tags ?? []));
    const lead = existing
      ? await tx.lead.update({
          where: { id: existing.id },
          data: {
            funnelId: legacyFunnelId,
            funnelInstanceId: publication.funnelInstanceId,
            funnelPublicationId: publication.id,
            sourceChannel: this.toDbSource(input.sourceChannel ?? 'form'),
            fullName: input.fullName ?? existing.fullName,
            email: input.email ?? existing.email,
            phone: input.phone ?? existing.phone,
            companyName: input.companyName ?? existing.companyName,
            tags: tags.length > 0 ? tags : existing.tags,
          },
        })
      : await tx.lead.create({
          data: {
            workspaceId: publication.workspaceId,
            funnelId: legacyFunnelId,
            funnelInstanceId: publication.funnelInstanceId,
            funnelPublicationId: publication.id,
            visitorId: visitor.id,
            sourceChannel: this.toDbSource(input.sourceChannel ?? 'form'),
            fullName: input.fullName ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            companyName: input.companyName ?? null,
            status: 'captured',
            currentAssignmentId: null,
            tags,
          },
        });

    await tx.visitor.update({
      where: { id: visitor.id },
      data: {
        kind: 'identified',
        status: 'converted',
      },
    });

    await tx.domainEvent.create({
      data: {
        workspaceId: publication.workspaceId,
        eventId: randomUUID(),
        aggregateType: 'lead',
        aggregateId: lead.id,
        eventName: existing ? 'lead_updated' : 'lead_captured',
        actorType: 'visitor',
        payload: {
          publicationId: publication.id,
          funnelInstanceId: publication.funnelInstanceId,
          visitorId: visitor.id,
          sourceChannel: lead.sourceChannel,
          attribution: this.buildAttributionPayload(input),
          fieldValues: input.fieldValues ?? {},
        },
        occurredAt: new Date(),
        visitorId: visitor.id,
        leadId: lead.id,
      },
    });

    if (!existing) {
      await this.trackingEventsService.recordTrackingEventInTransaction(tx, {
        workspaceId: publication.workspaceId,
        eventId: input.triggerEventId ?? undefined,
        aggregateType: 'lead',
        aggregateId: lead.id,
        eventName: 'lead_created',
        actorType: 'visitor',
        funnelInstanceId: publication.funnelInstanceId,
        funnelPublicationId: publication.id,
        visitorId: visitor.id,
        leadId: lead.id,
        payload: {
          source: 'server',
          triggerEventId: input.triggerEventId ?? null,
          sourceChannel: lead.sourceChannel,
          publicationId: publication.id,
          funnelInstanceId: publication.funnelInstanceId,
        },
      });
    }

    return {
      lead,
      wasCreated: !existing,
    };
  }

  private buildAttributionPayload(input: RuntimeAttributionPayload) {
    return {
      sourceUrl: input.sourceUrl ?? null,
      utmSource: input.utmSource ?? null,
      utmCampaign: input.utmCampaign ?? null,
      utmMedium: input.utmMedium ?? null,
      utmContent: input.utmContent ?? null,
      utmTerm: input.utmTerm ?? null,
      fbclid: input.fbclid ?? null,
      gclid: input.gclid ?? null,
      ttclid: input.ttclid ?? null,
    };
  }

  private async assignLeadToNextSponsorInTransaction(
    tx: TransactionClient,
    publication: FlowPublicationRecord,
    lead: {
      id: string;
      currentAssignmentId: string | null;
    },
    input?: {
      triggerEventId?: string | null;
      funnelStepId?: string | null;
    },
  ): Promise<AssignmentResolution> {
    const existingOpenAssignment = await tx.assignment.findFirst({
      where: {
        leadId: lead.id,
        status: {
          in: ['pending', 'assigned'],
        },
      },
      include: {
        sponsor: true,
      },
      orderBy: {
        assignedAt: 'desc',
      },
    });

    if (existingOpenAssignment) {
      return {
        assignment: {
          id: existingOpenAssignment.id,
          status: existingOpenAssignment.status,
          reason: existingOpenAssignment.reason,
          assignedAt: existingOpenAssignment.assignedAt.toISOString(),
          sponsor: {
            id: existingOpenAssignment.sponsor.id,
            displayName: existingOpenAssignment.sponsor.displayName,
            email: existingOpenAssignment.sponsor.email,
            phone: existingOpenAssignment.sponsor.phone,
            avatarUrl: existingOpenAssignment.sponsor.avatarUrl,
          },
        },
        advisor: await this.resolveAssignedAdvisorBySponsorId(
          tx,
          publication,
          existingOpenAssignment.sponsor.id,
        ),
        wasCreated: false,
      };
    }

    const assignee = await this.resolveRoundRobinAssigneeOrThrow(tx, publication);
    const assignmentReason = assignee.reason;
    const selectedAdvisor = assignee.user;
    const selectedSponsor = selectedAdvisor.sponsor;
    const assignmentRotationPoolId = null;

    if (!selectedSponsor) {
      throw new ConflictException({
        code: 'ADVISOR_SPONSOR_REQUIRED',
        message: `Selected advisor ${selectedAdvisor.id} does not have an operational sponsor profile.`,
      });
    }

    const legacyFunnelId = publication.funnelInstance.legacyFunnelId;

    if (!legacyFunnelId) {
      throw new ConflictException({
        code: 'LEGACY_FUNNEL_REQUIRED',
        message:
          'The current funnel instance is not yet linked to a legacy funnel, so assignment persistence cannot proceed in v1.',
      });
    }

    const assignedAt = new Date();
    const effectiveHandoffStrategy =
      publication.handoffStrategy ?? publication.funnelInstance.handoffStrategy;
    const assignment = await tx.assignment.create({
      data: {
        workspaceId: publication.workspaceId,
        leadId: lead.id,
        sponsorId: selectedSponsor.id,
        teamId: publication.teamId,
        funnelId: legacyFunnelId,
        funnelInstanceId: publication.funnelInstanceId,
        funnelPublicationId: publication.id,
        rotationPoolId: assignmentRotationPoolId,
        status: 'assigned',
        reason: assignmentReason,
        assignedAt,
        acceptedAt: null,
        resolvedAt: null,
      },
      include: {
        sponsor: true,
      },
    });

    await tx.lead.update({
      where: { id: lead.id },
      data: {
        status: 'assigned',
        currentAssignmentId: assignment.id,
      },
    });

    await tx.domainEvent.create({
      data: {
        workspaceId: publication.workspaceId,
        eventId: randomUUID(),
        aggregateType: 'lead',
        aggregateId: lead.id,
        eventName: 'lead_assigned',
        actorType: 'system',
        payload: {
          assignmentId: assignment.id,
          sponsorId: assignment.sponsor.id,
          rotationPoolId: assignmentRotationPoolId,
          funnelPublicationId: publication.id,
        },
        occurredAt: assignedAt,
        funnelInstanceId: publication.funnelInstanceId,
        funnelPublicationId: publication.id,
        funnelStepId: input?.funnelStepId ?? null,
        leadId: lead.id,
        assignmentId: assignment.id,
      },
    });

    await this.trackingEventsService.recordTrackingEventInTransaction(tx, {
      workspaceId: publication.workspaceId,
      aggregateType: 'assignment',
      aggregateId: assignment.id,
      eventName: 'assignment_created',
      actorType: 'system',
      occurredAt: assignedAt,
      funnelInstanceId: publication.funnelInstanceId,
      funnelPublicationId: publication.id,
      funnelStepId: input?.funnelStepId ?? null,
      leadId: lead.id,
      assignmentId: assignment.id,
      payload: {
        source: 'server',
        triggerEventId: input?.triggerEventId ?? null,
        sponsorId: assignment.sponsor.id,
        rotationPoolId: assignmentRotationPoolId,
        assignmentReason,
      },
    });

    await this.trackingEventsService.recordTrackingEventInTransaction(tx, {
      workspaceId: publication.workspaceId,
      aggregateType: 'assignment',
      aggregateId: assignment.id,
      eventName: 'handoff_started',
      actorType: 'system',
      occurredAt: assignedAt,
      funnelInstanceId: publication.funnelInstanceId,
      funnelPublicationId: publication.id,
      funnelStepId: input?.funnelStepId ?? null,
      leadId: lead.id,
      assignmentId: assignment.id,
      payload: {
        source: 'server',
        triggerEventId: input?.triggerEventId ?? null,
        sponsorId: assignment.sponsor.id,
        handoffStrategyId: effectiveHandoffStrategy?.id ?? null,
      },
    });

    return {
      assignment: {
        id: assignment.id,
        status: assignment.status,
        reason: assignment.reason,
        assignedAt: assignment.assignedAt.toISOString(),
        sponsor: {
          id: assignment.sponsor.id,
          displayName: assignment.sponsor.displayName,
          email: assignment.sponsor.email,
          phone: assignment.sponsor.phone,
          avatarUrl: assignment.sponsor.avatarUrl,
        },
      },
      advisor: this.toPublicAssignedAdvisor(selectedAdvisor),
      wasCreated: true,
    };
  }

  private async assignLeadOrLeaveUnassignedInTransaction(
    tx: TransactionClient,
    publication: FlowPublicationRecord,
    lead: {
      id: string;
      currentAssignmentId: string | null;
    },
    input?: {
      triggerEventId?: string | null;
      funnelStepId?: string | null;
    },
  ): Promise<AssignmentResolution> {
    try {
      return await this.assignLeadToNextSponsorInTransaction(
        tx,
        publication,
        lead,
        input,
      );
    } catch (error) {
      if (!this.shouldLeaveLeadUnassigned(error)) {
        throw error;
      }

      const { code, message } = this.getConflictErrorDetails(error);

      this.logger.warn(
        `Lead ${lead.id} captured without assignment for publication ${publication.id}. code=${code ?? 'UNKNOWN'} message=${message ?? 'Lead will remain unassigned for manual review.'}`,
      );

      return {
        assignment: null,
        advisor: null,
        wasCreated: false,
      };
    }
  }

  private buildPublicCaptureContext(input: {
    publication: FlowPublicationRecord;
    lead: {
      fullName: string | null;
      email: string | null;
      phone: string | null;
    };
    assignment: AssignmentSummary | null;
    advisor: PublicAssignedAdvisor | null;
    nextStep: StepNavigation;
  }) {
    const effectiveHandoffStrategy =
      input.publication.handoffStrategy ??
      input.publication.funnelInstance.handoffStrategy;
    const handoffConfig = resolvePublicHandoffConfig(effectiveHandoffStrategy);
    const sponsor = input.assignment?.sponsor
      ? toPublicVisibleSponsor(input.assignment.sponsor)
      : null;
    const whatsappPhone = normalizeWhatsappPhone(sponsor?.phone ?? null);
    const whatsappMessage = sponsor
      ? buildPublicWhatsappMessage({
          template: handoffConfig.messageTemplate,
          sponsorName: sponsor.displayName,
          leadName: input.lead.fullName,
          leadEmail: input.lead.email,
          leadPhone: input.lead.phone,
          funnelName: input.publication.funnelInstance.name,
          publicationPath: input.nextStep?.path ?? input.publication.pathPrefix,
        })
      : null;
    const whatsappUrl = buildPublicWhatsappUrl(whatsappPhone, whatsappMessage);
    const advisor = input.advisor
      ? {
          name: input.advisor.name,
          role: input.advisor.role,
          bio: input.advisor.bio,
          phone: input.advisor.phone ?? whatsappPhone,
          photoUrl: input.advisor.photoUrl,
          whatsappUrl,
        }
      : null;

    return {
      handoff: {
        mode: handoffConfig.mode,
        channel: handoffConfig.channel,
        buttonLabel: handoffConfig.buttonLabel,
        autoRedirect: handoffConfig.autoRedirect,
        autoRedirectDelayMs: handoffConfig.autoRedirectDelayMs,
        sponsor,
        whatsappPhone,
        whatsappMessage,
        whatsappUrl,
      },
      advisor,
      assigned_advisor: advisor
        ? {
            name: advisor.name,
            role: advisor.role,
            bio: advisor.bio,
            phone: advisor.phone,
            photo_url: advisor.photoUrl,
          }
        : null,
    };
  }

  private async recordAssignmentFailure(
    context: AssignmentFailureTrackingContext | null,
    error: unknown,
  ) {
    if (!context) {
      return;
    }

    const message =
      error instanceof Error ? error.message : 'Unknown assignment failure.';

    try {
      await this.trackingEventsService.recordTrackingEvent({
        workspaceId: context.workspaceId,
        aggregateType: context.leadId ? 'lead' : 'funnel-publication',
        aggregateId: context.leadId ?? context.publicationId,
        eventName: 'assignment_failed',
        actorType: 'system',
        funnelInstanceId: context.funnelInstanceId,
        funnelPublicationId: context.publicationId,
        funnelStepId: context.funnelStepId ?? null,
        leadId: context.leadId ?? null,
        payload: {
          source: 'server',
          triggerEventId: context.triggerEventId ?? null,
          errorMessage: message,
          publicationId: context.publicationId,
          leadPersisted: Boolean(context.leadId),
        },
      });
    } catch {
      return;
    }
  }

  private async resolveRotationPoolOrThrow(
    tx: TransactionClient,
    publication: FlowPublicationRecord,
  ): Promise<RotationPoolWithMembers> {
    if (publication.funnelInstance.rotationPool) {
      return publication.funnelInstance.rotationPool;
    }

    const fallbackPoolId =
      publication.funnelInstance.legacyFunnel?.defaultRotationPoolId;
    if (!fallbackPoolId) {
      throw new ConflictException({
        code: 'ROTATION_POOL_NOT_CONFIGURED',
        message: `Publication ${publication.id} does not have a rotation pool configured.`,
      });
    }

    const fallbackPool = await tx.rotationPool.findUnique({
      where: { id: fallbackPoolId },
      include: {
        members: {
          where: {
            isActive: true,
            sponsor: {
              isActive: true,
              status: 'active',
              availabilityStatus: 'available',
            },
          },
          orderBy: {
            position: 'asc',
          },
          include: eligibleMemberInclude,
        },
      },
    });

    if (!fallbackPool) {
      throw new ConflictException({
        code: 'ROTATION_POOL_NOT_FOUND',
        message: `Rotation pool ${fallbackPoolId} could not be resolved for publication ${publication.id}.`,
      });
    }

    return fallbackPool;
  }

  private async resolveRoundRobinAssigneeOrThrow(
    tx: TransactionClient,
    publication: FlowPublicationRecord,
  ): Promise<{
    user: TeamAssignmentUserRecord;
    reason: 'rotation' | 'fallback';
  }> {
    const team = await this.lockTeamAssignmentPointerOrThrow(tx, publication);
    const activeAdvisors = await this.listActiveAdvisorUsers(tx, publication);

    if (activeAdvisors.length > 0) {
      const currentIndex = activeAdvisors.findIndex(
        (advisor) => advisor.id === team.lastAssignedUserId,
      );
      const nextIndex = (currentIndex + 1) % activeAdvisors.length;
      const winner = activeAdvisors[nextIndex] ?? activeAdvisors[0];

      await tx.team.update({
        where: {
          id: publication.teamId,
        },
        data: {
          lastAssignedUserId: winner.id,
        },
      });

      return {
        user: winner,
        reason: 'rotation',
      };
    }

    const fallbackUser = await this.resolveFallbackTeamAdminOrThrow(
      tx,
      publication,
    );

    await tx.team.update({
      where: {
        id: publication.teamId,
      },
      data: {
        lastAssignedUserId: fallbackUser.id,
      },
    });

    return {
      user: fallbackUser,
      reason: 'fallback',
    };
  }

  private async lockTeamAssignmentPointerOrThrow(
    tx: TransactionClient,
    publication: FlowPublicationRecord,
  ) {
    const [team] = await tx.$queryRaw<
      Array<{
        id: string;
        lastAssignedUserId: string | null;
      }>
    >(Prisma.sql`
      SELECT id, "lastAssignedUserId"
      FROM "Team"
      WHERE id = ${publication.teamId}
        AND "workspaceId" = ${publication.workspaceId}
      FOR UPDATE
    `);

    if (!team) {
      throw new NotFoundException({
        code: 'TEAM_NOT_FOUND',
        message: `Team ${publication.teamId} was not found for publication ${publication.id}.`,
      });
    }

    return team;
  }

  private async listActiveAdvisorUsers(
    tx: TransactionClient,
    publication: FlowPublicationRecord,
  ) {
    return tx.user.findMany({
      where: {
        workspaceId: publication.workspaceId,
        teamId: publication.teamId,
        role: 'MEMBER',
        status: 'active',
        sponsor: {
          is: {
            isActive: true,
            status: 'active',
          },
        },
      },
      include: {
        sponsor: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  private async resolveFallbackTeamAdminOrThrow(
    tx: TransactionClient,
    publication: FlowPublicationRecord,
  ) {
    const fallbackUser = await tx.user.findFirst({
      where: {
        workspaceId: publication.workspaceId,
        teamId: publication.teamId,
        role: 'TEAM_ADMIN',
        status: 'active',
        sponsor: {
          is: {
            isActive: true,
            status: 'active',
          },
        },
      },
      include: {
        sponsor: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (!fallbackUser?.sponsor) {
      throw new ConflictException({
        code: 'NO_FALLBACK_SPONSOR_AVAILABLE',
        message: `Team ${publication.teamId} does not have an active team admin sponsor available for assignment.`,
      });
    }

    return fallbackUser;
  }

  private async resolveAssignedAdvisorBySponsorId(
    tx: TransactionClient,
    publication: FlowPublicationRecord,
    sponsorId: string,
  ) {
    const user = await tx.user.findFirst({
      where: {
        workspaceId: publication.workspaceId,
        teamId: publication.teamId,
        sponsorId,
        status: 'active',
      },
      include: {
        sponsor: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (!user?.sponsor) {
      return null;
    }

    return this.toPublicAssignedAdvisor(user);
  }

  private toPublicAssignedAdvisor(
    user: TeamAssignmentUserRecord,
  ): PublicAssignedAdvisor {
    const role =
      user.role === 'TEAM_ADMIN' ? 'Propietario del equipo' : 'Asesor';

    return {
      id: user.id,
      sponsorId: user.sponsor!.id,
      name: user.sponsor?.displayName ?? user.fullName,
      role,
      bio: role,
      phone: user.sponsor?.phone ?? null,
      photoUrl: user.sponsor?.avatarUrl ?? null,
    };
  }

  private async resolveNextRotationMemberOrThrow(
    tx: TransactionClient,
    rotationPool: RotationPoolWithMembers,
    eligibleSponsorIds: string[],
  ) {
    const eligibleMembers = rotationPool.members.filter((member) =>
      eligibleSponsorIds.includes(member.sponsorId),
    );

    if (eligibleMembers.length === 0) {
      throw new ConflictException({
        code: 'NO_ELIGIBLE_SPONSORS',
        message: `Rotation pool ${rotationPool.id} does not have active sponsors available for assignment.`,
      });
    }

    const lastAssignmentMap = await this.getLastAssignmentBySponsorId(
      tx,
      eligibleMembers.map((member) => member.sponsorId),
    );

    const nextMember = pickNextRotationMember(
      eligibleMembers.map((member) => ({
        sponsorId: member.sponsorId,
        position: member.position,
        lastAssignedAt:
          lastAssignmentMap.get(member.sponsorId)?.assignedAt.toISOString() ??
          null,
      })),
    );

    if (!nextMember) {
      throw new ConflictException({
        code: 'NO_ELIGIBLE_SPONSORS',
        message: `Rotation pool ${rotationPool.id} could not resolve the next sponsor.`,
      });
    }

    const matchedMember = rotationPool.members.find(
      (member) => member.sponsorId === nextMember.sponsorId,
    );

    if (!matchedMember) {
      throw new ConflictException({
        code: 'ROTATION_MEMBER_NOT_FOUND',
        message: `Sponsor ${nextMember.sponsorId} is no longer eligible in rotation pool ${rotationPool.id}.`,
      });
    }

    return matchedMember;
  }

  private shouldFallbackAssignment(error: unknown) {
    const { code } = this.getConflictErrorDetails(error);

    return code ? ASSIGNMENT_FALLBACK_ERROR_CODES.has(code) : false;
  }

  private shouldLeaveLeadUnassigned(error: unknown) {
    const { code } = this.getConflictErrorDetails(error);

    return code ? UNASSIGNED_ASSIGNMENT_ERROR_CODES.has(code) : false;
  }

  private getConflictErrorDetails(error: unknown) {
    if (!(error instanceof ConflictException)) {
      return {
        code: null,
        message: null,
      };
    }

    const response = error.getResponse();
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      return {
        code: null,
        message: error.message,
      };
    }

    const code =
      'code' in response && typeof response.code === 'string'
        ? response.code
        : null;
    const message =
      'message' in response && typeof response.message === 'string'
        ? response.message
        : error.message;

    return {
      code,
      message,
    };
  }

  private async resolveFallbackSponsorOrThrow(
    tx: TransactionClient,
    publication: FlowPublicationRecord,
    eligibleSponsorIds: string[],
  ) {
    const fallbackPool = await tx.rotationPool.findFirst({
      where: {
        workspaceId: publication.workspaceId,
        teamId: publication.teamId,
        status: 'active',
        isFallbackPool: true,
      },
      include: {
        members: {
          where: {
            isActive: true,
            sponsorId: {
              in: eligibleSponsorIds,
            },
            sponsor: {
              isActive: true,
              status: 'active',
              availabilityStatus: 'available',
            },
          },
          orderBy: {
            position: 'asc',
          },
          include: eligibleMemberInclude,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (fallbackPool?.members.length) {
      const sponsor = await this.pickLeastRecentlyAssignedDirectSponsor(
        tx,
        fallbackPool.members.map((member) => member.sponsor),
      );

      if (!sponsor) {
        throw new ConflictException({
          code: 'NO_FALLBACK_SPONSOR_AVAILABLE',
          message: `Publication ${publication.id} does not have a fallback sponsor available.`,
        });
      }

      return {
        sponsor,
        rotationPoolId: fallbackPool.id,
      };
    }

    const directSponsors = await tx.sponsor.findMany({
      where: {
        workspaceId: publication.workspaceId,
        teamId: publication.teamId,
        id: {
          in: eligibleSponsorIds,
        },
        isActive: true,
        status: 'active',
        availabilityStatus: 'available',
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    const directSponsor = await this.pickLeastRecentlyAssignedDirectSponsor(
      tx,
      directSponsors,
    );

    if (directSponsor) {
      return {
        sponsor: directSponsor,
        rotationPoolId: null,
      };
    }

    throw new ConflictException({
      code: 'NO_FALLBACK_SPONSOR_AVAILABLE',
      message: `Publication ${publication.id} does not have a fallback sponsor available.`,
    });
  }

  private async resolveEligibleAdWheelSponsorIdsOrThrow(
    tx: TransactionClient,
    publication: FlowPublicationRecord,
  ) {
    const activeWheel = await tx.adWheel.findFirst({
      where: {
        teamId: publication.teamId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        participants: {
          select: {
            sponsorId: true,
          },
        },
      },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
    });

    if (!activeWheel) {
      throw new ConflictException({
        code: 'NO_ACTIVE_AD_WHEEL',
        message: `Team ${publication.teamId} does not have an active ad wheel.`,
      });
    }

    const sponsorIds = [
      ...new Set(activeWheel.participants.map((item) => item.sponsorId)),
    ];

    if (sponsorIds.length === 0) {
      throw new ConflictException({
        code: 'NO_ACTIVE_AD_WHEEL_PARTICIPANTS',
        message: `Active ad wheel ${activeWheel.id} does not have paid participants.`,
      });
    }

    return sponsorIds;
  }

  private async getLastAssignmentBySponsorId(
    tx: TransactionClient,
    sponsorIds: string[],
  ) {
    if (sponsorIds.length === 0) {
      return new Map<string, { sponsorId: string; assignedAt: Date }>();
    }

    const assignments = await tx.assignment.findMany({
      where: {
        sponsorId: {
          in: sponsorIds,
        },
      },
      select: {
        sponsorId: true,
        assignedAt: true,
      },
      orderBy: {
        assignedAt: 'desc',
      },
    });

    const lastAssignmentMap = new Map<
      string,
      {
        sponsorId: string;
        assignedAt: Date;
      }
    >();

    for (const assignment of assignments) {
      if (!lastAssignmentMap.has(assignment.sponsorId)) {
        lastAssignmentMap.set(assignment.sponsorId, assignment);
      }
    }

    return lastAssignmentMap;
  }

  private async pickLeastRecentlyAssignedDirectSponsor(
    tx: TransactionClient,
    sponsors: DirectEligibleSponsor[],
  ) {
    if (sponsors.length === 0) {
      return null;
    }

    const lastAssignmentMap = await this.getLastAssignmentBySponsorId(
      tx,
      sponsors.map((sponsor) => sponsor.id),
    );

    return (
      [...sponsors].sort((left, right) => {
        const leftAssignedAt =
          lastAssignmentMap.get(left.id)?.assignedAt.getTime() ??
          Number.NEGATIVE_INFINITY;
        const rightAssignedAt =
          lastAssignmentMap.get(right.id)?.assignedAt.getTime() ??
          Number.NEGATIVE_INFINITY;

        if (leftAssignedAt !== rightAssignedAt) {
          return leftAssignedAt - rightAssignedAt;
        }

        return left.createdAt.getTime() - right.createdAt.getTime();
      })[0] ?? null
    );
  }

  private resolveNextStepAfterCaptureFromPublication(
    publication: FlowPublicationRecord,
    currentStepId?: string,
  ): StepNavigation {
    if (!currentStepId) {
      return null;
    }

    const steps = publication.funnelInstance.steps;
    const currentIndex = steps.findIndex((step) => step.id === currentStepId);
    if (currentIndex < 0) {
      return null;
    }

    const nextStep = steps[currentIndex + 1];
    if (!nextStep) {
      return null;
    }

    return {
      id: nextStep.id,
      slug: nextStep.slug,
      path: buildPublicationStepPath(
        publication.pathPrefix,
        nextStep.slug,
        nextStep.isEntryStep,
      ),
      stepType: nextStep.stepType,
    };
  }

  private toDbSource(value: string): PrismaLeadSourceChannel {
    switch (value) {
      case 'landing-page':
        return 'landing_page';
      case 'manual':
      case 'form':
      case 'api':
      case 'import':
      case 'automation':
        return value;
      default:
        return 'form';
    }
  }
}
