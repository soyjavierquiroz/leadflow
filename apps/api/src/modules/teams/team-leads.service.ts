import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LeadDispatcherService } from '../messaging-automation/lead-dispatcher.service';
import { lockLeadRowForUpdate } from '../shared/lead-row-lock.utils';
import type { ReassignTeamLeadDto } from './dto/reassign-team-lead.dto';

const teamLeadInboxInclude = {
  currentAssignment: {
    include: {
      sponsor: {
        select: {
          id: true,
          displayName: true,
          availabilityStatus: true,
          status: true,
        },
      },
    },
  },
  assignments: {
    select: {
      id: true,
      status: true,
      assignedAt: true,
      acceptedAt: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { assignedAt: 'desc' }],
    take: 1,
  },
  notes: {
    select: {
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    take: 1,
  },
  funnelInstance: {
    select: {
      name: true,
    },
  },
  funnelPublication: {
    select: {
      pathPrefix: true,
      domain: {
        select: {
          host: true,
        },
      },
    },
  },
} satisfies Prisma.LeadInclude;

type TeamLeadInboxRecord = Prisma.LeadGetPayload<{
  include: typeof teamLeadInboxInclude;
}>;

type TeamLeadSupervisionStatus = 'orphaned' | 'stagnant' | 'active' | 'closed';

export type TeamLeadInboxItem = {
  id: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  companyName: string | null;
  sourceChannel: string;
  leadStatus: string;
  assignmentStatus: string | null;
  supervisionStatus: TeamLeadSupervisionStatus;
  currentAssignmentId: string | null;
  assignedAt: string | null;
  lastActivity: string;
  updatedAt: string;
  funnelName: string | null;
  publicationPath: string | null;
  domainHost: string | null;
  sponsor: {
    id: string;
    displayName: string;
    availabilityStatus: string;
    status: string;
  } | null;
};

export type TeamLeadReassignResult = {
  lead: TeamLeadInboxItem;
  automationTriggered: boolean;
};

const toIso = (value: Date) => value.toISOString();
const toInputJsonValue = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const byNewestFirst = (left: string, right: string) =>
  left < right ? 1 : left > right ? -1 : 0;

const resolveSupervisionPriority = (value: TeamLeadSupervisionStatus) => {
  switch (value) {
    case 'orphaned':
      return 0;
    case 'stagnant':
      return 1;
    case 'active':
      return 2;
    case 'closed':
      return 3;
  }
};

@Injectable()
export class TeamLeadsService {
  private readonly logger = new Logger(TeamLeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leadDispatcherService: LeadDispatcherService,
  ) {}

  async list(scope: {
    workspaceId: string;
    teamId: string;
  }): Promise<TeamLeadInboxItem[]> {
    const records = await this.prisma.lead.findMany({
      where: this.buildTeamLeadWhere(scope),
      include: teamLeadInboxInclude,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return records
      .map((record) => this.mapTeamLeadInboxItem(record))
      .sort((left, right) => {
        const supervisionDelta =
          resolveSupervisionPriority(left.supervisionStatus) -
          resolveSupervisionPriority(right.supervisionStatus);

        if (supervisionDelta !== 0) {
          return supervisionDelta;
        }

        return byNewestFirst(left.lastActivity, right.lastActivity);
      });
  }

  async reassign(
    scope: {
      workspaceId: string;
      teamId: string;
    },
    leadId: string,
    dto: ReassignTeamLeadDto,
  ): Promise<TeamLeadReassignResult> {
    const targetSponsorId = dto.targetSponsorId?.trim();

    if (!targetSponsorId) {
      throw new BadRequestException({
        code: 'TARGET_SPONSOR_REQUIRED',
        message: 'A target sponsor is required to reassign the lead.',
      });
    }

    const targetSponsor = await this.prisma.sponsor.findFirst({
      where: {
        id: targetSponsorId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
      select: {
        id: true,
        displayName: true,
        isActive: true,
        status: true,
        availabilityStatus: true,
      },
    });

    if (!targetSponsor) {
      throw new NotFoundException({
        code: 'TARGET_SPONSOR_NOT_FOUND',
        message: 'The selected sponsor does not belong to this team.',
      });
    }

    if (targetSponsor.status !== 'active') {
      throw new BadRequestException({
        code: 'TARGET_SPONSOR_INACTIVE',
        message: 'The selected sponsor is not active for reassignment.',
      });
    }

    if (!targetSponsor.isActive) {
      throw new BadRequestException({
        code: 'TARGET_SPONSOR_SEAT_INACTIVE',
        message: 'The selected sponsor does not have an active seat.',
      });
    }

    if (targetSponsor.availabilityStatus !== 'available') {
      throw new BadRequestException({
        code: 'TARGET_SPONSOR_UNAVAILABLE',
        message: 'The selected sponsor is not available to receive leads.',
      });
    }

    const { assignmentId } = await this.prisma.$transaction(async (tx) => {
      const lockedLead = await lockLeadRowForUpdate(tx, {
        leadId,
        workspaceId: scope.workspaceId,
      });

      if (!lockedLead) {
        throw new NotFoundException({
          code: 'TEAM_LEAD_NOT_FOUND',
          message: 'The requested lead was not found for this team.',
        });
      }

      const lead = await tx.lead.findFirst({
        where: this.buildTeamLeadWhere(scope, leadId),
        include: {
          currentAssignment: true,
        },
      });

      if (!lead) {
        throw new NotFoundException({
          code: 'TEAM_LEAD_NOT_FOUND',
          message: 'The requested lead was not found for this team.',
        });
      }

      if (lead.currentAssignment?.sponsorId === targetSponsor.id) {
        throw new BadRequestException({
          code: 'TARGET_SPONSOR_ALREADY_ASSIGNED',
          message: 'The lead is already assigned to the selected sponsor.',
        });
      }

      const now = new Date();

      if (lead.currentAssignment) {
        await tx.assignment.update({
          where: {
            id: lead.currentAssignment.id,
          },
          data: {
            status: 'reassigned',
            resolvedAt: now,
          },
        });

        await this.recordDomainEvent(tx, {
          workspaceId: scope.workspaceId,
          aggregateType: 'assignment',
          aggregateId: lead.currentAssignment.id,
          eventName: 'assignment_reassigned',
          actorType: 'user',
          occurredAt: now,
          leadId: lead.id,
          assignmentId: lead.currentAssignment.id,
          payload: {
            previousSponsorId: lead.currentAssignment.sponsorId,
            targetSponsorId: targetSponsor.id,
          },
        });
      }

      const assignment = await tx.assignment.create({
        data: {
          workspaceId: lead.workspaceId,
          leadId: lead.id,
          sponsorId: targetSponsor.id,
          teamId: scope.teamId,
          funnelId: lead.funnelId,
          funnelInstanceId: lead.funnelInstanceId,
          funnelPublicationId: lead.funnelPublicationId,
          rotationPoolId: null,
          status: 'assigned',
          reason: 'manual',
          assignedAt: now,
          acceptedAt: null,
          resolvedAt: null,
        },
      });

      await tx.lead.update({
        where: {
          id: lead.id,
        },
        data: {
          status: 'assigned',
          currentAssignmentId: assignment.id,
        },
      });

      await this.recordDomainEvent(tx, {
        workspaceId: scope.workspaceId,
        aggregateType: 'lead',
        aggregateId: lead.id,
        eventName: 'lead_reassigned',
        actorType: 'user',
        occurredAt: now,
        leadId: lead.id,
        assignmentId: assignment.id,
        payload: {
          targetSponsorId: targetSponsor.id,
          previousAssignmentId: lead.currentAssignment?.id ?? null,
          previousSponsorId: lead.currentAssignment?.sponsorId ?? null,
          nextAssignmentId: assignment.id,
        },
      });

      await this.recordDomainEvent(tx, {
        workspaceId: scope.workspaceId,
        aggregateType: 'assignment',
        aggregateId: assignment.id,
        eventName: 'assignment_created',
        actorType: 'user',
        occurredAt: now,
        leadId: lead.id,
        assignmentId: assignment.id,
        payload: {
          sponsorId: targetSponsor.id,
          assignmentReason: 'manual',
          reassignedFromAssignmentId: lead.currentAssignment?.id ?? null,
        },
      });

      return {
        assignmentId: assignment.id,
      };
    });

    let automationTriggered = false;

    try {
      automationTriggered = Boolean(
        await this.leadDispatcherService.dispatchLeadContextUpsert({
          assignmentId,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Lead ${leadId} was reassigned to sponsor ${targetSponsor.id}, but LEAD_CONTEXT_UPSERT failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    const refreshed = await this.prisma.lead.findFirst({
      where: this.buildTeamLeadWhere(scope, leadId),
      include: teamLeadInboxInclude,
    });

    if (!refreshed) {
      throw new NotFoundException({
        code: 'TEAM_LEAD_NOT_FOUND',
        message: 'The reassigned lead could not be reloaded.',
      });
    }

    return {
      lead: this.mapTeamLeadInboxItem(refreshed),
      automationTriggered,
    };
  }

  private buildTeamLeadWhere(
    scope: {
      workspaceId: string;
      teamId: string;
    },
    leadId?: string,
  ): Prisma.LeadWhereInput {
    return {
      ...(leadId ? { id: leadId } : {}),
      workspaceId: scope.workspaceId,
      OR: [
        {
          assignments: {
            some: {
              teamId: scope.teamId,
            },
          },
        },
        {
          currentAssignment: {
            is: {
              teamId: scope.teamId,
            },
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
    };
  }

  private mapTeamLeadInboxItem(record: TeamLeadInboxRecord): TeamLeadInboxItem {
    const supervisionStatus = this.resolveSupervisionStatus(record);
    const sponsor = record.currentAssignment?.sponsor ?? null;
    const lastActivity = this.resolveLastActivity(record);

    return {
      id: record.id,
      fullName: record.fullName,
      phone: record.phone,
      email: record.email,
      companyName: record.companyName,
      sourceChannel: record.sourceChannel,
      leadStatus: record.status,
      assignmentStatus: record.currentAssignment?.status ?? null,
      supervisionStatus,
      currentAssignmentId: record.currentAssignment?.id ?? null,
      assignedAt: record.currentAssignment?.assignedAt
        ? toIso(record.currentAssignment.assignedAt)
        : null,
      lastActivity,
      updatedAt: toIso(record.updatedAt),
      funnelName: record.funnelInstance?.name ?? null,
      publicationPath: record.funnelPublication?.pathPrefix ?? null,
      domainHost: record.funnelPublication?.domain?.host ?? null,
      sponsor: sponsor
        ? {
            id: sponsor.id,
            displayName: sponsor.displayName,
            availabilityStatus: sponsor.availabilityStatus,
            status: sponsor.status,
          }
        : null,
    };
  }

  private resolveSupervisionStatus(
    record: TeamLeadInboxRecord,
  ): TeamLeadSupervisionStatus {
    if (!record.currentAssignment) {
      return 'orphaned';
    }

    switch (record.currentAssignment.status) {
      case 'accepted':
        return 'active';
      case 'closed':
      case 'reassigned':
        return 'closed';
      case 'pending':
      case 'assigned':
      default:
        return 'stagnant';
    }
  }

  private resolveLastActivity(record: TeamLeadInboxRecord) {
    const candidates = [
      record.currentAssignment?.acceptedAt ?? null,
      record.currentAssignment?.updatedAt ?? null,
      record.currentAssignment?.assignedAt ?? null,
      record.assignments[0]?.acceptedAt ?? null,
      record.assignments[0]?.updatedAt ?? null,
      record.assignments[0]?.assignedAt ?? null,
      record.notes[0]?.updatedAt ?? null,
      record.notes[0]?.createdAt ?? null,
      record.updatedAt,
      record.createdAt,
    ].filter((value): value is Date => Boolean(value));

    const [firstCandidate, ...remainingCandidates] = candidates;
    const latest = remainingCandidates.reduce<Date>(
      (current, candidate) =>
        candidate.getTime() > current.getTime() ? candidate : current,
      firstCandidate,
    );

    return toIso(latest);
  }

  private async recordDomainEvent(
    tx: Prisma.TransactionClient,
    input: {
      workspaceId: string;
      aggregateType: Prisma.DomainEventUncheckedCreateInput['aggregateType'];
      aggregateId: string;
      eventName: string;
      actorType: Prisma.DomainEventUncheckedCreateInput['actorType'];
      occurredAt: Date;
      leadId: string;
      assignmentId: string | null;
      payload: Record<string, unknown>;
    },
  ) {
    await tx.domainEvent.create({
      data: {
        id: randomUUID(),
        workspaceId: input.workspaceId,
        eventId: randomUUID(),
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventName: input.eventName,
        actorType: input.actorType,
        payload: toInputJsonValue(input.payload),
        occurredAt: input.occurredAt,
        visitorId: null,
        leadId: input.leadId,
        assignmentId: input.assignmentId,
      },
    });
  }
}
