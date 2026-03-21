import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LeadSourceChannel as PrismaLeadSourceChannel,
  Prisma,
} from '@prisma/client';
import { TrackingEventsService } from '../events/tracking-events.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { RegisterPublicVisitorDto } from './dto/register-public-visitor.dto';
import type { CapturePublicLeadDto } from './dto/capture-public-lead.dto';
import type { AutoAssignPublicLeadDto } from './dto/auto-assign-public-lead.dto';
import type { SubmitPublicLeadCaptureDto } from './dto/submit-public-lead-capture.dto';
import { buildPublicationStepPath } from './public-funnel-runtime.utils';
import { pickNextRotationMember } from './lead-capture-assignment.utils';

const eligibleMemberInclude = {
  sponsor: true,
} satisfies Prisma.RotationMemberInclude;

const flowPublicationInclude = {
  domain: true,
  funnelInstance: {
    include: {
      legacyFunnel: true,
      rotationPool: {
        include: {
          members: {
            where: {
              isActive: true,
              sponsor: {
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
  };
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
  assignment: AssignmentSummary;
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

@Injectable()
export class LeadCaptureAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackingEventsService: TrackingEventsService,
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
        utmSource: dto.utmSource ?? null,
        utmCampaign: dto.utmCampaign ?? null,
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
      return await this.prisma.$transaction(async (tx) => {
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

        const { assignment } = await this.assignLeadToNextSponsorInTransaction(
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
          nextStep,
        };
      });
    } catch (error) {
      await this.recordAssignmentFailure(failureContext, error);
      throw error;
    }
  }

  async submitLeadCapture(dto: SubmitPublicLeadCaptureDto) {
    let failureContext: AssignmentFailureTrackingContext | null = null;

    try {
      return await this.prisma.$transaction(async (tx) => {
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
            utmSource: dto.utmSource ?? null,
            utmCampaign: dto.utmCampaign ?? null,
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

        const { assignment } = await this.assignLeadToNextSponsorInTransaction(
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

        failureContext = null;

        return {
          visitor,
          lead: leadResult.lead,
          assignment,
          nextStep,
        };
      });
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

  private async getPublicationContextOrThrow(
    tx: TransactionClient,
    publicationId: string,
  ): Promise<FlowPublicationRecord> {
    const publication = await tx.funnelPublication.findUnique({
      where: { id: publicationId },
      include: flowPublicationInclude,
    });

    if (!publication || publication.status !== 'active') {
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
      utmSource: null,
      utmCampaign: null,
    });
  }

  private async registerVisitorInTransaction(
    tx: TransactionClient,
    publication: FlowPublicationRecord,
    input: {
      anonymousId: string;
      kind?: 'anonymous' | 'identified';
      sourceChannel: string;
      utmSource?: string | null;
      utmCampaign?: string | null;
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
    input: CapturePublicLeadDto,
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
          in: ['pending', 'assigned', 'accepted'],
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
          },
        },
        wasCreated: false,
      };
    }

    const rotationPool = await this.resolveRotationPoolOrThrow(tx, publication);
    const nextMember = await this.resolveNextRotationMemberOrThrow(
      tx,
      rotationPool,
    );
    const legacyFunnelId = publication.funnelInstance.legacyFunnelId;

    if (!legacyFunnelId) {
      throw new ConflictException({
        code: 'LEGACY_FUNNEL_REQUIRED',
        message:
          'The current funnel instance is not yet linked to a legacy funnel, so assignment persistence cannot proceed in v1.',
      });
    }

    const assignedAt = new Date();
    const assignment = await tx.assignment.create({
      data: {
        workspaceId: publication.workspaceId,
        leadId: lead.id,
        sponsorId: nextMember.sponsor.id,
        teamId: publication.teamId,
        funnelId: legacyFunnelId,
        funnelInstanceId: publication.funnelInstanceId,
        funnelPublicationId: publication.id,
        rotationPoolId: rotationPool.id,
        status: 'assigned',
        reason: 'rotation',
        assignedAt,
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
          rotationPoolId: rotationPool.id,
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
        rotationPoolId: rotationPool.id,
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
        handoffStrategyId: publication.handoffStrategyId,
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
        },
      },
      wasCreated: true,
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

  private async resolveNextRotationMemberOrThrow(
    tx: TransactionClient,
    rotationPool: RotationPoolWithMembers,
  ) {
    if (rotationPool.members.length === 0) {
      throw new ConflictException({
        code: 'NO_ELIGIBLE_SPONSORS',
        message: `Rotation pool ${rotationPool.id} does not have active sponsors available for assignment.`,
      });
    }

    const lastAssignment = await tx.assignment.findFirst({
      where: {
        rotationPoolId: rotationPool.id,
      },
      orderBy: {
        assignedAt: 'desc',
      },
    });

    const nextMember = pickNextRotationMember(
      rotationPool.members.map((member) => ({
        sponsorId: member.sponsorId,
        position: member.position,
      })),
      lastAssignment?.sponsorId,
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
