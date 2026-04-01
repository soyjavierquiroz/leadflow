import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
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
import type { Lead, LeadRepository } from './interfaces/lead.interface';
import { buildLeadWorkflow, type LeadWorkflowView } from './leads-workflows';
import type {
  LeadNoteView,
  LeadReminderSummary,
  LeadTimelineDetail,
  LeadTimelineItem,
  LeadTimelineScope,
} from './leads.types';

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
    default:
      return typeof payload.message === 'string'
        ? payload.message
        : 'Evento de dominio registrado para este lead.';
  }
};

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
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
