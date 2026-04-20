import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { type Prisma, type UserRole } from '@prisma/client';
import { mapLeadRecord } from '../../prisma/prisma.mappers';
import { PrismaService } from '../../prisma/prisma.service';
import { buildEntity } from '../shared/domain.factory';
import { LEAD_REPOSITORY } from '../shared/domain.tokens';
import type { CreateLeadNoteDto } from './dto/create-lead-note.dto';
import type { CreateLeadDto } from './dto/create-lead.dto';
import type { UpdateLeadFollowUpDto } from './dto/update-lead-follow-up.dto';
import type { UpdateLeadQualificationDto } from './dto/update-lead-qualification.dto';
import {
  memberLeadStatusValues,
  type UpdateMemberLeadDto,
} from './dto/update-member-lead.dto';
import type { SuppressMemberLeadDto } from './dto/suppress-member-lead.dto';
import type { Lead, LeadRepository } from './interfaces/lead.interface';
import { buildLeadWorkflow, type LeadWorkflowView } from './leads-workflows';
import type {
  LeadNoteView,
  LeadReminderSummary,
  LeadTimelineDetail,
  LeadTimelineItem,
  LeadTimelineScope,
} from './leads.types';
import { KurukinBlacklistService } from '../kurukin-blacklist/kurukin-blacklist.service';

const leadTimelineInclude = {
  currentAssignment: {
    include: {
      sponsor: true,
      team: true,
    },
  },
  funnelInstance: true,
  funnelPublication: {
    include: {
      domain: true,
    },
  },
  notes: {
    orderBy: {
      createdAt: 'desc',
    },
    take: 20,
  },
  events: {
    orderBy: {
      occurredAt: 'desc',
    },
    take: 20,
  },
} satisfies Prisma.LeadInclude;

type LeadTimelineRecord = Prisma.LeadGetPayload<{
  include: typeof leadTimelineInclude;
}>;

const LEGACY_SIGNAL_EVENT_NAMES = new Set([
  'conversation_started',
  'message_inbound',
  'message_outbound',
  'lead_contacted',
  'lead_qualified',
  'lead_follow_up',
  'lead_won',
  'lead_lost',
]);

const INTERNAL_TIMELINE_EVENT_NAMES = new Set([
  ...LEGACY_SIGNAL_EVENT_NAMES,
  'lead_note_added',
]);

const toIso = (value: Date | null) => (value ? value.toISOString() : null);
const toInputJsonValue = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

type RawLeadFallbackRow = {
  id: string;
  workspaceId: string;
  funnelId: string;
  funnelInstanceId: string | null;
  funnelPublicationId: string | null;
  visitorId: string | null;
  sourceChannel: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  status: Lead['status'];
  qualificationGrade: Lead['qualificationGrade'];
  summaryText: string | null;
  nextActionLabel: string | null;
  followUpAt: Date | null;
  lastContactedAt: Date | null;
  lastQualifiedAt: Date | null;
  isSuppressed: boolean;
  suppressedAt: Date | null;
  suppressedReason: string | null;
  suppressedSource: string | null;
  currentAssignmentId: string | null;
  tags: string[] | null;
  createdAt: Date;
  updatedAt: Date;
};

const prettifyEventName = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const buildEventDescription = (
  event: LeadTimelineRecord['events'][number],
): string => {
  const payload = event.payload as Record<string, unknown>;

  switch (event.eventName) {
    case 'lead_status_updated':
      return (
        [
          typeof payload.previousStatus === 'string'
            ? `Estado previo: ${payload.previousStatus}`
            : null,
          typeof payload.nextStatus === 'string'
            ? `Estado actual: ${payload.nextStatus}`
            : null,
        ]
          .filter(Boolean)
          .join(' · ') ||
        'Se actualizó manualmente el estado operativo del lead.'
      );
    case 'lead_note_added':
      return typeof payload.body === 'string'
        ? payload.body
        : 'Se registró una nota manual sobre el lead.';
    case 'lead_qualification_updated':
      return (
        [
          typeof payload.qualificationGrade === 'string'
            ? `Calificación -> ${payload.qualificationGrade}`
            : null,
          typeof payload.summaryText === 'string' && payload.summaryText.trim()
            ? payload.summaryText.trim()
            : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Se actualizó la calificación operativa del lead.'
      );
    case 'lead_follow_up_updated':
      return (
        [
          typeof payload.nextActionLabel === 'string' &&
          payload.nextActionLabel.trim()
            ? `Próxima acción: ${payload.nextActionLabel.trim()}`
            : null,
          typeof payload.followUpAt === 'string'
            ? `Follow-up: ${payload.followUpAt}`
            : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Se actualizó el plan de seguimiento del lead.'
      );
    case 'lead_suppressed':
      return (
        [
          typeof payload.reason === 'string' ? `Motivo: ${payload.reason}` : null,
          typeof payload.hubSyncStatus === 'string'
            ? `Hub: ${payload.hubSyncStatus}`
            : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'El lead quedó suprimido para evitar nuevos envíos.'
      );
    default:
      return typeof payload.message === 'string'
        ? payload.message
        : 'Evento de dominio registrado para este lead.';
  }
};

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kurukinBlacklistService: KurukinBlacklistService,
    @Optional()
    @Inject(LEAD_REPOSITORY)
    private readonly repository?: LeadRepository,
  ) {}

  createDraft(dto: CreateLeadDto): Lead {
    return this.enrichLead(
      buildEntity<Lead>({
        workspaceId: dto.workspaceId,
        funnelId: dto.funnelId,
        funnelInstanceId: dto.funnelInstanceId ?? null,
        funnelPublicationId: dto.funnelPublicationId ?? null,
        visitorId: dto.visitorId ?? null,
        sourceChannel: dto.sourceChannel,
        fullName: dto.fullName ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        companyName: dto.companyName ?? null,
        status: 'captured',
        qualificationGrade: null,
        summaryText: null,
        nextActionLabel: null,
        followUpAt: null,
        lastContactedAt: null,
        lastQualifiedAt: null,
        isSuppressed: false,
        suppressedAt: null,
        suppressedReason: null,
        suppressedSource: null,
        currentAssignmentId: null,
        tags: dto.tags ?? [],
      }),
    );
  }

  async list(filters?: {
    workspaceId?: string;
    teamId?: string;
    sponsorId?: string;
    funnelPublicationId?: string;
    status?: string;
  }): Promise<Lead[]> {
    if (!this.repository) {
      throw new Error('LeadRepository provider is not configured.');
    }

    try {
      if (filters?.sponsorId) {
        const records = await this.repository.findBySponsorId(filters.sponsorId);
        return this.enrichLeads(
          filters.status
            ? records.filter((item) => item.status === filters.status)
            : records,
        );
      }

      if (filters?.funnelPublicationId) {
        const records = await this.repository.findByPublicationId(
          filters.funnelPublicationId,
        );
        return this.enrichLeads(
          filters.status
            ? records.filter((item) => item.status === filters.status)
            : records,
        );
      }

      if (filters?.teamId) {
        const records = await this.repository.findByTeamId(filters.teamId);
        return this.enrichLeads(
          filters.status
            ? records.filter((item) => item.status === filters.status)
            : records,
        );
      }

      if (filters?.workspaceId) {
        const records = await this.repository.findByWorkspaceId(
          filters.workspaceId,
        );
        return this.enrichLeads(
          filters.status
            ? records.filter((item) => item.status === filters.status)
            : records,
        );
      }

      const records = await this.repository.findAll();
      return this.enrichLeads(
        filters?.status
          ? records.filter((item) => item.status === filters.status)
          : records,
      );
    } catch (error) {
      if (!this.isLeadSchemaDesyncError(error)) {
        throw error;
      }

      this.logger.warn(
        `Lead list fell back to raw SQL after Prisma schema desync: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );

      const records = await this.listWithSchemaFallback(filters);
      return this.enrichLeads(
        filters?.status
          ? records.filter((item) => item.status === filters.status)
          : records,
      );
    }
  }

  async findOne(filters: {
    id: string;
    workspaceId?: string;
    teamId?: string;
    sponsorId?: string;
  }): Promise<Lead> {
    const record = await this.prisma.lead.findFirst({
      where: this.buildLeadWhere(
        {
          workspaceId: filters.workspaceId,
          teamId: filters.teamId,
          sponsorId: filters.sponsorId,
        },
        filters.id,
      ),
    });

    if (!record) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'The requested lead was not found for this scope.',
      });
    }

    return this.enrichLead(mapLeadRecord(record));
  }

  async getRemindersSummary(
    scope: LeadTimelineScope,
  ): Promise<LeadReminderSummary> {
    const leads = await this.list(scope);

    return leads.reduce<LeadReminderSummary>(
      (summary, lead) => {
        if (lead.reminderBucket === 'none') {
          return summary;
        }

        summary.totals.active += 1;

        if (lead.needsAttention) {
          summary.totals.needsAttention += 1;
        }

        switch (lead.reminderBucket) {
          case 'overdue':
            summary.totals.overdue += 1;
            break;
          case 'due_today':
            summary.totals.dueToday += 1;
            break;
          case 'upcoming':
            summary.totals.upcoming += 1;
            break;
          case 'unscheduled':
            summary.totals.unscheduled += 1;
            break;
          default:
            break;
        }

        return summary;
      },
      {
        generatedAt: new Date().toISOString(),
        totals: {
          active: 0,
          overdue: 0,
          dueToday: 0,
          upcoming: 0,
          unscheduled: 0,
          needsAttention: 0,
        },
      },
    );
  }

  async getLeadPlaybook(scope: LeadTimelineScope, leadId: string) {
    const lead = await this.findOne({
      id: leadId,
      workspaceId: scope.workspaceId,
      teamId: scope.teamId,
      sponsorId: scope.sponsorId,
    });

    return {
      leadId: lead.id,
      workflow: this.toWorkflowView(lead),
    };
  }

  async updateForMember(
    scope: {
      workspaceId: string;
      teamId: string;
      sponsorId: string;
    },
    leadId: string,
    dto: UpdateMemberLeadDto,
  ): Promise<Lead> {
    if (!dto.status) {
      throw new BadRequestException({
        code: 'LEAD_UPDATE_EMPTY',
        message: 'A lead status is required.',
      });
    }

    if (!memberLeadStatusValues.includes(dto.status)) {
      throw new BadRequestException({
        code: 'LEAD_STATUS_INVALID',
        message: `Lead status must be one of: ${memberLeadStatusValues.join(
          ', ',
        )}.`,
      });
    }

    const lead = await this.prisma.lead.findFirst({
      where: this.buildLeadWhere(scope, leadId),
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'The requested lead was not found for this member.',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const record = await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: dto.status,
          lastQualifiedAt:
            dto.status === 'qualified' || dto.status === 'won'
              ? now
              : undefined,
        },
      });

      if (
        lead.currentAssignmentId &&
        (dto.status === 'won' || dto.status === 'lost')
      ) {
        await tx.assignment.updateMany({
          where: {
            id: lead.currentAssignmentId,
            sponsorId: scope.sponsorId,
            status: {
              not: 'closed',
            },
          },
          data: {
            status: 'closed',
            resolvedAt: now,
          },
        });
      }

      await this.recordLeadDomainEvent(tx, {
        leadId: lead.id,
        workspaceId: lead.workspaceId,
        assignmentId: lead.currentAssignmentId,
        eventName: 'lead_status_updated',
        actorType: 'user',
        payload: {
          nextStatus: record.status,
          previousStatus: lead.status,
          actorSponsorId: scope.sponsorId,
        },
      });

      return record;
    });

    return this.enrichLead(mapLeadRecord(updated));
  }

  async autoAcceptLeadFromWebhook(leadId: string) {
    const lead = await this.prisma.lead.findUnique({
      where: {
        id: leadId,
      },
      include: {
        currentAssignment: true,
      },
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'The requested lead was not found.',
      });
    }

    const assignment = lead.currentAssignment;

    if (!assignment) {
      throw new BadRequestException({
        code: 'LEAD_ASSIGNMENT_REQUIRED',
        message: 'The lead does not have an active assignment to accept.',
      });
    }

    if (lead.status === 'won' || lead.status === 'lost') {
      throw new BadRequestException({
        code: 'LEAD_NOT_ACCEPTABLE',
        message: 'Terminal leads cannot be auto-accepted.',
      });
    }

    if (assignment.status === 'accepted') {
      return {
        ok: true,
        leadId: lead.id,
        assignmentId: assignment.id,
        assignmentStatus: assignment.status,
        leadStatus: lead.status,
        acceptedAt:
          assignment.acceptedAt?.toISOString() ??
          assignment.updatedAt.toISOString(),
        alreadyAccepted: true,
      };
    }

    if (assignment.status !== 'pending' && assignment.status !== 'assigned') {
      throw new BadRequestException({
        code: 'ASSIGNMENT_NOT_ACCEPTABLE',
        message: 'Only pending or assigned leads can be auto-accepted.',
      });
    }

    const now = new Date();
    const nextLeadStatus =
      lead.status === 'captured' || lead.status === 'assigned'
        ? 'nurturing'
        : lead.status;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedAssignment = await tx.assignment.update({
        where: {
          id: assignment.id,
        },
        data: {
          status: 'accepted',
          acceptedAt: assignment.acceptedAt ?? now,
        },
      });

      if (nextLeadStatus !== lead.status) {
        await tx.lead.update({
          where: {
            id: lead.id,
          },
          data: {
            status: nextLeadStatus,
          },
        });

        await this.recordLeadDomainEvent(tx, {
          leadId: lead.id,
          workspaceId: lead.workspaceId,
          assignmentId: assignment.id,
          eventName: 'lead_status_updated',
          actorType: 'integration',
          occurredAt: now,
          payload: {
            nextStatus: nextLeadStatus,
            previousStatus: lead.status,
            source: 'n8n_auto_accept_webhook',
          },
        });
      }

      await tx.domainEvent.create({
        data: {
          id: randomUUID(),
          workspaceId: lead.workspaceId,
          eventId: randomUUID(),
          aggregateType: 'assignment',
          aggregateId: assignment.id,
          eventName: 'assignment_auto_accepted',
          actorType: 'integration',
          payload: toInputJsonValue({
            leadId: lead.id,
            sponsorId: assignment.sponsorId,
            previousStatus: assignment.status,
            nextStatus: 'accepted',
            source: 'n8n_auto_accept_webhook',
          }),
          occurredAt: now,
          visitorId: lead.visitorId,
          leadId: lead.id,
          assignmentId: assignment.id,
        },
      });

      return {
        leadId: lead.id,
        assignmentId: assignment.id,
        assignmentStatus: updatedAssignment.status,
        leadStatus: nextLeadStatus,
        acceptedAt:
          updatedAssignment.acceptedAt?.toISOString() ?? now.toISOString(),
      };
    });

    return {
      ok: true,
      ...result,
      alreadyAccepted: false,
    };
  }

  async suppressForMember(
    scope: {
      workspaceId: string;
      teamId: string;
      sponsorId: string;
    },
    leadId: string,
    dto?: SuppressMemberLeadDto,
  ) {
    const lead = await this.prisma.lead.findFirst({
      where: this.buildLeadWhere(scope, leadId),
      include: {
        currentAssignment: true,
      },
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'The requested lead was not found for this member.',
      });
    }

    return this.applyLeadSuppression(
      {
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
        sponsorId: scope.sponsorId,
      },
      {
        leadId: lead.id,
        blockedPhone: lead.phone,
        reason: dto?.reason?.trim() || 'manual_member_opt_out',
        source: dto?.source?.trim() || 'manual_member_button',
      },
    );
  }

  async suppressFromIncomingWebhook(input: {
    workspaceId: string;
    teamId: string;
    sponsorId: string;
    leadId: string;
    blockedPhone?: string | null;
    reason: string;
    source: string;
    occurredAt?: Date;
    keyword?: string | null;
  }) {
    return this.applyLeadSuppression(
      {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        sponsorId: input.sponsorId,
      },
      {
        leadId: input.leadId,
        blockedPhone: input.blockedPhone,
        reason: input.reason,
        source: input.source,
        occurredAt: input.occurredAt,
        keyword: input.keyword,
      },
    );
  }

  async getTimelineDetail(
    scope: LeadTimelineScope,
    leadId: string,
  ): Promise<LeadTimelineDetail> {
    const lead = await this.prisma.lead.findFirst({
      include: leadTimelineInclude,
      where: this.buildLeadWhere(scope, leadId),
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'The requested lead was not found for this scope.',
      });
    }

    const notes = lead.notes.map<LeadNoteView>((note) => ({
      id: note.id,
      body: note.body,
      authorName: note.authorName,
      authorRole: note.authorRole,
      sponsorId: note.sponsorId ?? null,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    }));

    const timeline = this.buildTimeline(lead);
    const workflow = this.toWorkflowView({
      status: lead.status,
      qualificationGrade: lead.qualificationGrade,
      nextActionLabel: lead.nextActionLabel,
      followUpAt: toIso(lead.followUpAt),
      lastContactedAt: toIso(lead.lastContactedAt),
      lastQualifiedAt: toIso(lead.lastQualifiedAt),
    });

    return {
      lead: {
        id: lead.id,
        fullName: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        companyName: lead.companyName,
        sourceChannel: lead.sourceChannel,
        status: lead.status,
        qualificationGrade: lead.qualificationGrade,
        summaryText: lead.summaryText,
        nextActionLabel: lead.nextActionLabel,
        followUpAt: toIso(lead.followUpAt),
        lastContactedAt: toIso(lead.lastContactedAt),
        lastQualifiedAt: toIso(lead.lastQualifiedAt),
        isSuppressed: lead.isSuppressed,
        suppressedAt: toIso(lead.suppressedAt),
        suppressedReason: lead.suppressedReason,
        suppressedSource: lead.suppressedSource,
        sponsorId: lead.currentAssignment?.sponsorId ?? null,
        sponsorName: lead.currentAssignment?.sponsor.displayName ?? null,
        teamId: lead.currentAssignment?.teamId ?? null,
        teamName: lead.currentAssignment?.team.name ?? null,
        assignmentId: lead.currentAssignment?.id ?? null,
        assignmentStatus: lead.currentAssignment?.status ?? null,
        assignedAt: toIso(lead.currentAssignment?.assignedAt ?? null),
        funnelName: lead.funnelInstance?.name ?? null,
        domainHost: lead.funnelPublication?.domain.host ?? null,
        publicationPath: lead.funnelPublication?.pathPrefix ?? null,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      },
      workflow,
      notes,
      timeline,
    };
  }

  async updateQualification(
    scope: LeadTimelineScope,
    leadId: string,
    dto: UpdateLeadQualificationDto,
    actor: {
      id: string;
      fullName: string;
      role: UserRole;
      sponsorId?: string | null;
    },
  ): Promise<Lead> {
    if (
      typeof dto.qualificationGrade === 'undefined' &&
      typeof dto.summaryText === 'undefined'
    ) {
      throw new BadRequestException({
        code: 'LEAD_QUALIFICATION_EMPTY',
        message:
          'Provide qualificationGrade and/or summaryText to update the lead qualification.',
      });
    }

    const lead = await this.prisma.lead.findFirst({
      include: {
        currentAssignment: true,
      },
      where: this.buildLeadWhere(scope, leadId),
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'The requested lead was not found for this scope.',
      });
    }
    const now = new Date();
    const summaryText =
      typeof dto.summaryText === 'undefined'
        ? undefined
        : dto.summaryText?.trim() || null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          qualificationGrade:
            typeof dto.qualificationGrade === 'undefined'
              ? undefined
              : dto.qualificationGrade,
          summaryText,
          lastQualifiedAt:
            typeof dto.qualificationGrade === 'undefined'
              ? undefined
              : dto.qualificationGrade
                ? now
                : null,
        },
      });

      await this.recordLeadDomainEvent(tx, {
        leadId: lead.id,
        workspaceId: lead.workspaceId,
        assignmentId: lead.currentAssignmentId ?? null,
        eventName: 'lead_qualification_updated',
        actorType: 'user',
        payload: {
          actorUserId: actor.id,
          actorName: actor.fullName,
          qualificationGrade: record.qualificationGrade,
          summaryText: record.summaryText,
        },
      });

      return record;
    });

    return this.enrichLead(mapLeadRecord(updated));
  }

  async updateFollowUp(
    scope: LeadTimelineScope,
    leadId: string,
    dto: UpdateLeadFollowUpDto,
    actor: {
      id: string;
      fullName: string;
      role: UserRole;
      sponsorId?: string | null;
    },
  ): Promise<Lead> {
    if (
      typeof dto.nextActionLabel === 'undefined' &&
      typeof dto.followUpAt === 'undefined'
    ) {
      throw new BadRequestException({
        code: 'LEAD_FOLLOW_UP_EMPTY',
        message:
          'Provide nextActionLabel and/or followUpAt to update the follow-up plan.',
      });
    }

    const lead = await this.prisma.lead.findFirst({
      include: {
        currentAssignment: true,
      },
      where: this.buildLeadWhere(scope, leadId),
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'The requested lead was not found for this scope.',
      });
    }
    const nextActionLabel =
      typeof dto.nextActionLabel === 'undefined'
        ? undefined
        : dto.nextActionLabel?.trim() || null;
    let followUpAt: Date | null | undefined = undefined;

    if (typeof dto.followUpAt !== 'undefined') {
      if (!dto.followUpAt) {
        followUpAt = null;
      } else {
        const parsed = new Date(dto.followUpAt);

        if (Number.isNaN(parsed.valueOf())) {
          throw new BadRequestException({
            code: 'LEAD_FOLLOW_UP_INVALID_DATE',
            message: 'The provided followUpAt value is invalid.',
          });
        }

        followUpAt = parsed;
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          nextActionLabel,
          followUpAt,
        },
      });

      await this.recordLeadDomainEvent(tx, {
        leadId: lead.id,
        workspaceId: lead.workspaceId,
        assignmentId: lead.currentAssignmentId ?? null,
        eventName: 'lead_follow_up_updated',
        actorType: 'user',
        payload: {
          actorUserId: actor.id,
          actorName: actor.fullName,
          nextActionLabel: record.nextActionLabel,
          followUpAt: toIso(record.followUpAt),
        },
      });

      return record;
    });

    return this.enrichLead(mapLeadRecord(updated));
  }

  async addNote(
    scope: LeadTimelineScope,
    leadId: string,
    dto: CreateLeadNoteDto,
    actor: {
      id: string;
      fullName: string;
      role: UserRole;
      sponsorId?: string | null;
    },
  ): Promise<LeadNoteView> {
    const body = dto.body?.trim();

    if (!body) {
      throw new BadRequestException({
        code: 'LEAD_NOTE_BODY_REQUIRED',
        message: 'A note body is required.',
      });
    }

    const lead = await this.prisma.lead.findFirst({
      include: {
        currentAssignment: true,
      },
      where: this.buildLeadWhere(scope, leadId),
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'The requested lead was not found for this scope.',
      });
    }

    const note = await this.prisma.$transaction(async (tx) => {
      const created = await tx.leadNote.create({
        data: {
          id: randomUUID(),
          workspaceId: lead.workspaceId,
          teamId:
            scope.teamId ??
            lead.currentAssignment?.teamId ??
            (() => {
              throw new BadRequestException({
                code: 'LEAD_TEAM_REQUIRED',
                message: 'The lead note requires a team context.',
              });
            })(),
          leadId: lead.id,
          sponsorId:
            scope.sponsorId ?? lead.currentAssignment?.sponsorId ?? null,
          authorUserId: actor.id,
          authorRole: actor.role,
          authorName: actor.fullName,
          body,
        },
      });

      await this.recordLeadDomainEvent(tx, {
        leadId: lead.id,
        workspaceId: lead.workspaceId,
        assignmentId: lead.currentAssignmentId ?? null,
        eventName: 'lead_note_added',
        actorType: 'user',
        payload: {
          actorUserId: actor.id,
          actorName: actor.fullName,
          body,
        },
      });

      return created;
    });

    return {
      id: note.id,
      body: note.body,
      authorName: note.authorName,
      authorRole: note.authorRole,
      sponsorId: note.sponsorId ?? null,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    };
  }

  private buildLeadWhere(
    scope: LeadTimelineScope,
    leadId?: string,
  ): Prisma.LeadWhereInput {
    return {
      ...(leadId ? { id: leadId } : {}),
      ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}),
      ...(scope.teamId
        ? {
            OR: [
              {
                assignments: {
                  some: { teamId: scope.teamId },
                },
              },
              {
                funnelInstance: {
                  teamId: scope.teamId,
                },
              },
              {
                funnelPublication: {
                  teamId: scope.teamId,
                },
              },
            ],
          }
        : {}),
      ...(scope.sponsorId
        ? {
            assignments: {
              some: { sponsorId: scope.sponsorId },
            },
          }
        : {}),
    };
  }

  private enrichLeads(leads: Lead[]): Lead[] {
    return leads.map((lead) => this.enrichLead(lead));
  }

  private isLeadSchemaDesyncError(error: unknown) {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const candidate = error as { code?: string; message?: string };
    return (
      candidate.code === 'P2022' ||
      candidate.message?.includes('isSuppressed') === true
    );
  }

  private async listWithSchemaFallback(filters?: {
    workspaceId?: string;
    teamId?: string;
    sponsorId?: string;
    funnelPublicationId?: string;
  }): Promise<Lead[]> {
    const baseSelect = `
      SELECT DISTINCT
        l."id",
        l."workspaceId",
        l."funnelId",
        l."funnelInstanceId",
        l."funnelPublicationId",
        l."visitorId",
        l."sourceChannel",
        l."fullName",
        l."email",
        l."phone",
        l."companyName",
        l."status",
        l."qualificationGrade",
        l."summaryText",
        l."nextActionLabel",
        l."followUpAt",
        l."lastContactedAt",
        l."lastQualifiedAt",
        FALSE AS "isSuppressed",
        NULL::timestamp AS "suppressedAt",
        NULL::text AS "suppressedReason",
        NULL::text AS "suppressedSource",
        l."currentAssignmentId",
        l."tags",
        l."createdAt",
        l."updatedAt"
      FROM "Lead" l
    `;

    if (filters?.sponsorId) {
      return this.queryLeadFallback(
        `${baseSelect}
        INNER JOIN "Assignment" a ON a."leadId" = l."id"
        WHERE a."sponsorId" = $1
        ORDER BY l."createdAt" DESC`,
        filters.sponsorId,
      );
    }

    if (filters?.funnelPublicationId) {
      return this.queryLeadFallback(
        `${baseSelect}
        WHERE l."funnelPublicationId" = $1
        ORDER BY l."createdAt" DESC`,
        filters.funnelPublicationId,
      );
    }

    if (filters?.teamId) {
      return this.queryLeadFallback(
        `${baseSelect}
        LEFT JOIN "Assignment" a ON a."leadId" = l."id"
        LEFT JOIN "FunnelInstance" fi ON fi."id" = l."funnelInstanceId"
        LEFT JOIN "FunnelPublication" fp ON fp."id" = l."funnelPublicationId"
        WHERE a."teamId" = $1 OR fi."teamId" = $1 OR fp."teamId" = $1
        ORDER BY l."createdAt" DESC`,
        filters.teamId,
      );
    }

    if (filters?.workspaceId) {
      return this.queryLeadFallback(
        `${baseSelect}
        WHERE l."workspaceId" = $1
        ORDER BY l."createdAt" ASC`,
        filters.workspaceId,
      );
    }

    return this.queryLeadFallback(
      `${baseSelect}
      ORDER BY l."createdAt" ASC`,
    );
  }

  private async queryLeadFallback(query: string, ...params: string[]) {
    const rows = await this.prisma.$queryRawUnsafe<RawLeadFallbackRow[]>(
      query,
      ...params,
    );

    return rows.map((row) => ({
      id: row.id,
      workspaceId: row.workspaceId,
      funnelId: row.funnelId,
      funnelInstanceId: row.funnelInstanceId,
      funnelPublicationId: row.funnelPublicationId,
      visitorId: row.visitorId,
      sourceChannel:
        row.sourceChannel === 'landing_page'
          ? 'landing-page'
          : row.sourceChannel,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      companyName: row.companyName,
      status: row.status,
      qualificationGrade: row.qualificationGrade,
      summaryText: row.summaryText,
      nextActionLabel: row.nextActionLabel,
      followUpAt: toIso(row.followUpAt),
      lastContactedAt: toIso(row.lastContactedAt),
      lastQualifiedAt: toIso(row.lastQualifiedAt),
      isSuppressed: row.isSuppressed,
      suppressedAt: toIso(row.suppressedAt),
      suppressedReason: row.suppressedReason,
      suppressedSource: row.suppressedSource,
      currentAssignmentId: row.currentAssignmentId,
      tags: Array.isArray(row.tags) ? row.tags : [],
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    }));
  }

  private enrichLead(lead: Lead): Lead {
    const workflow = this.toWorkflowView(lead);

    return {
      ...lead,
      reminderBucket: workflow.reminder.bucket,
      reminderLabel: workflow.reminder.label,
      suggestedNextAction: workflow.suggestedNextAction,
      effectiveNextAction: workflow.effectiveNextAction,
      playbookKey: workflow.playbook.key,
      playbookTitle: workflow.playbook.title,
      playbookDescription: workflow.playbook.description,
      needsAttention: workflow.reminder.needsAttention,
    };
  }

  private async applyLeadSuppression(
    scope: {
      workspaceId: string;
      teamId: string;
      sponsorId: string;
    },
    input: {
      leadId: string;
      blockedPhone?: string | null;
      reason: string;
      source: string;
      occurredAt?: Date;
      keyword?: string | null;
    },
  ) {
    const lead = await this.prisma.lead.findFirst({
      where: this.buildLeadWhere(scope, input.leadId),
      include: {
        currentAssignment: true,
      },
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'The requested lead was not found for suppression.',
      });
    }

    const occurredAt = input.occurredAt ?? new Date();
    const nextLeadStatus = lead.status === 'won' ? 'won' : 'lost';
    const hubSync = await (async () => {
      try {
        const owner = await this.kurukinBlacklistService.resolveOwnerContext(scope);

        if (!owner.ownerPhone) {
          throw new Error('owner phone is not configured');
        }

        return await this.kurukinBlacklistService.safeAdd({
          ownerPhone: owner.ownerPhone,
          blockedPhone: input.blockedPhone ?? lead.phone ?? '',
          reason: input.reason,
          label: 'opt-out',
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'owner context resolution failed';

        this.logger.warn(
          `Lead ${lead.id} suppression could not resolve Kurukin owner context: ${message}`,
        );

        return {
          synced: false,
          errorMessage: message,
        };
      }
    })();

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          status: nextLeadStatus,
          isSuppressed: true,
          suppressedAt: lead.suppressedAt ?? occurredAt,
          suppressedReason: input.reason,
          suppressedSource: input.source,
        },
      });

      if (lead.currentAssignmentId && lead.currentAssignment?.status !== 'closed') {
        await tx.assignment.updateMany({
          where: {
            id: lead.currentAssignmentId,
            sponsorId: scope.sponsorId,
            status: {
              not: 'closed',
            },
          },
          data: {
            status: 'closed',
            resolvedAt: occurredAt,
          },
        });
      }

      if (lead.status !== nextLeadStatus) {
        await this.recordLeadDomainEvent(tx, {
          leadId: lead.id,
          workspaceId: lead.workspaceId,
          assignmentId: lead.currentAssignmentId,
          eventName: 'lead_status_updated',
          actorType: input.source.startsWith('inbound') ? 'integration' : 'user',
          occurredAt,
          payload: {
            nextStatus: nextLeadStatus,
            previousStatus: lead.status,
            actorSponsorId: scope.sponsorId,
            source: input.source,
          },
        });
      }

      await this.recordLeadDomainEvent(tx, {
        leadId: lead.id,
        workspaceId: lead.workspaceId,
        assignmentId: lead.currentAssignmentId,
        eventName: 'lead_suppressed',
        actorType: input.source.startsWith('inbound') ? 'integration' : 'user',
        occurredAt,
        payload: {
          reason: input.reason,
          source: input.source,
          keyword: input.keyword ?? null,
          blockedPhone: input.blockedPhone ?? lead.phone ?? null,
          hubSyncStatus: hubSync.synced ? 'synced' : 'failed',
          hubSyncError: hubSync.errorMessage,
        },
      });

      return record;
    });

    if (!hubSync.synced) {
      this.logger.warn(
        `Lead ${lead.id} was suppressed locally but Kurukin Hub sync failed: ${hubSync.errorMessage}`,
      );
    }

    return {
      lead: this.enrichLead(mapLeadRecord(updated)),
      hubSync,
    };
  }

  private toWorkflowView(input: {
    status: Lead['status'];
    qualificationGrade: Lead['qualificationGrade'];
    nextActionLabel: Lead['nextActionLabel'];
    followUpAt: Lead['followUpAt'];
    lastContactedAt: Lead['lastContactedAt'];
    lastQualifiedAt: Lead['lastQualifiedAt'];
  }): LeadWorkflowView {
    return buildLeadWorkflow({
      status: input.status,
      qualificationGrade: input.qualificationGrade,
      nextActionLabel: input.nextActionLabel,
      followUpAt: input.followUpAt,
      lastContactedAt: input.lastContactedAt,
      lastQualifiedAt: input.lastQualifiedAt,
    });
  }

  private buildTimeline(lead: LeadTimelineRecord): LeadTimelineItem[] {
    const noteItems = lead.notes.map<LeadTimelineItem>((note) => ({
      id: note.id,
      itemType: 'note',
      occurredAt: note.createdAt.toISOString(),
      title: 'Nota manual',
      description: note.body,
      actorLabel: note.authorName,
      statusLabel: null,
    }));

    const eventItems = lead.events
      .filter((event) => !INTERNAL_TIMELINE_EVENT_NAMES.has(event.eventName))
      .map<LeadTimelineItem>((event) => ({
        id: event.id,
        itemType: 'event',
        occurredAt: event.occurredAt.toISOString(),
        title: prettifyEventName(event.eventName),
        description: buildEventDescription(event),
        actorLabel: event.actorType,
        statusLabel: null,
        eventName: event.eventName,
      }));

    return [...noteItems, ...eventItems].sort((a, b) =>
      a.occurredAt < b.occurredAt ? 1 : -1,
    );
  }

  private async recordLeadDomainEvent(
    tx: Prisma.TransactionClient,
    input: {
      leadId: string;
      workspaceId: string;
      assignmentId: string | null;
      eventName: string;
      actorType: 'user' | 'system' | 'integration';
      occurredAt?: Date;
      payload: Record<string, unknown>;
    },
  ) {
    await tx.domainEvent.create({
      data: {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        eventId: randomUUID(),
        aggregateType: 'lead',
        aggregateId: input.leadId,
        eventName: input.eventName,
        actorType: input.actorType,
        payload: toInputJsonValue(input.payload),
        occurredAt: input.occurredAt ?? new Date(),
        visitorId: null,
        leadId: input.leadId,
        assignmentId: input.assignmentId,
      },
    });
  }
}
