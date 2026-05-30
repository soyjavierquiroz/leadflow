import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CrmAssignmentEventType,
  CrmAssignmentSource,
  CrmAssignmentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CrmOutreachSchedulerService } from './crm-outreach-scheduler.service';

const OWNERSHIP_LOCK_MS = 72 * 60 * 60 * 1000;
const ACTIVE_ASSIGNMENT_STATUSES = [
  CrmAssignmentStatus.pending_assignment,
  CrmAssignmentStatus.accepted,
  CrmAssignmentStatus.auto_accepted,
] as const;

type AssignmentTx = Prisma.TransactionClient | PrismaService;

const toInputJsonValue = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const addOwnershipLock = (from: Date) =>
  new Date(from.getTime() + OWNERSHIP_LOCK_MS);

const isLocked = (
  assignment: { ownershipLockedUntil: Date | null },
  now: Date,
) =>
  Boolean(
    assignment.ownershipLockedUntil &&
      assignment.ownershipLockedUntil.getTime() > now.getTime(),
  );

@Injectable()
export class CrmAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outreachScheduler?: CrmOutreachSchedulerService,
  ) {}

  async createAssignment(input: {
    workspaceId: string;
    teamId: string;
    leadId: string;
    attributedSponsorId?: string | null;
    assignedSponsorId?: string | null;
    assignmentSource: CrmAssignmentSource;
    metadata?: Record<string, unknown>;
    now?: Date;
  }) {
    const now = input.now ?? new Date();

    return this.prisma.$transaction(async (tx) => {
      const activeAssignment = await tx.crmLeadAssignment.findFirst({
        where: {
          workspaceId: input.workspaceId,
          teamId: input.teamId,
          leadId: input.leadId,
          assignmentStatus: {
            in: [...ACTIVE_ASSIGNMENT_STATUSES],
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      if (activeAssignment) {
        const sameAssignedSponsor =
          activeAssignment.assignedSponsorId ===
          (input.assignedSponsorId ?? null);

        if (
          sameAssignedSponsor &&
          activeAssignment.assignmentStatus ===
            CrmAssignmentStatus.pending_assignment
        ) {
          return activeAssignment;
        }

        if (isLocked(activeAssignment, now) && !sameAssignedSponsor) {
          throw new ConflictException({
            code: 'CRM_ASSIGNMENT_LOCKED',
            message: 'The current CRM assignment is ownership locked.',
            ownershipLockedUntil: activeAssignment.ownershipLockedUntil,
          });
        }

        await tx.crmLeadAssignment.update({
          where: {
            id: activeAssignment.id,
          },
          data: {
            assignmentStatus: CrmAssignmentStatus.reassigned,
          },
        });

        await this.emitAssignmentEvent(
          {
            workspaceId: activeAssignment.workspaceId,
            teamId: activeAssignment.teamId,
            leadId: activeAssignment.leadId,
            eventType: CrmAssignmentEventType.assignment_reassigned,
            actorSponsorId: input.assignedSponsorId ?? null,
            source: CrmAssignmentSource.reassignment,
            metadata: {
              previousAssignmentId: activeAssignment.id,
              previousAssignedSponsorId: activeAssignment.assignedSponsorId,
              nextAssignedSponsorId: input.assignedSponsorId ?? null,
            },
          },
          tx,
        );
      }

      const assignment = await tx.crmLeadAssignment.create({
        data: {
          workspaceId: input.workspaceId,
          teamId: input.teamId,
          leadId: input.leadId,
          attributedSponsorId: input.attributedSponsorId ?? null,
          assignedSponsorId: input.assignedSponsorId ?? null,
          assignmentStatus: CrmAssignmentStatus.pending_assignment,
          assignmentSource: input.assignmentSource,
          ownershipLockedUntil: addOwnershipLock(now),
          assignedAt: now,
          metadataJson: toInputJsonValue(input.metadata ?? {}),
        },
      });

      await this.emitAssignmentEvent(
        {
          workspaceId: assignment.workspaceId,
          teamId: assignment.teamId,
          leadId: assignment.leadId,
          eventType: CrmAssignmentEventType.assignment_created,
          actorSponsorId: assignment.assignedSponsorId,
          source: assignment.assignmentSource,
          metadata: {
            assignmentId: assignment.id,
            attributedSponsorId: assignment.attributedSponsorId,
            assignedSponsorId: assignment.assignedSponsorId,
          },
        },
        tx,
      );

      return assignment;
    });
  }

  async acceptAssignment(input: {
    workspaceId: string;
    teamId: string;
    sponsorId: string;
    assignmentId: string;
    now?: Date;
  }) {
    const now = input.now ?? new Date();

    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.crmLeadAssignment.findFirst({
        where: {
          id: input.assignmentId,
          workspaceId: input.workspaceId,
          teamId: input.teamId,
        },
      });

      if (!assignment || assignment.assignedSponsorId !== input.sponsorId) {
        throw new NotFoundException({
          code: 'CRM_ASSIGNMENT_NOT_FOUND',
          message: 'The requested CRM assignment was not found for this sponsor.',
        });
      }

      if (
        assignment.assignmentStatus === CrmAssignmentStatus.accepted &&
        assignment.acceptedBySponsorId === input.sponsorId
      ) {
        return assignment;
      }

      if (
        assignment.assignmentStatus !==
        CrmAssignmentStatus.pending_assignment
      ) {
        throw new BadRequestException({
          code: 'CRM_ASSIGNMENT_NOT_PENDING',
          message: 'Only pending CRM assignments can be accepted.',
        });
      }

      const updated = await tx.crmLeadAssignment.update({
        where: {
          id: assignment.id,
        },
        data: {
          assignmentStatus: CrmAssignmentStatus.accepted,
          acceptedAt: assignment.acceptedAt ?? now,
          acceptedBySponsorId: input.sponsorId,
          ownershipLockedUntil: addOwnershipLock(now),
        },
      });

      await this.emitAssignmentEvent(
        {
          workspaceId: updated.workspaceId,
          teamId: updated.teamId,
          leadId: updated.leadId,
          eventType: CrmAssignmentEventType.assignment_accepted,
          actorSponsorId: input.sponsorId,
          source: updated.assignmentSource,
          metadata: {
            assignmentId: updated.id,
            ownershipLockedUntil: updated.ownershipLockedUntil,
          },
        },
        tx,
      );

      await this.scheduleInitialContact(updated, input.sponsorId, tx, now);

      return updated;
    });
  }

  async autoAcceptAssignment(input: {
    assignmentId: string;
    sponsorId: string;
    source?: CrmAssignmentSource;
    metadata?: Record<string, unknown>;
    now?: Date;
  }) {
    const now = input.now ?? new Date();

    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.crmLeadAssignment.findUnique({
        where: {
          id: input.assignmentId,
        },
      });

      if (!assignment) {
        throw new NotFoundException({
          code: 'CRM_ASSIGNMENT_NOT_FOUND',
          message: 'The requested CRM assignment was not found.',
        });
      }

      if (assignment.assignmentStatus === CrmAssignmentStatus.closed) {
        return {
          applied: false,
          reason: 'closed',
          assignment,
        };
      }

      const lockedByAnotherSponsor =
        isLocked(assignment, now) &&
        [
          assignment.conversationOwnerSponsorId,
          assignment.acceptedBySponsorId,
          assignment.assignedSponsorId,
          assignment.attributedSponsorId,
        ].some((sponsorId) => sponsorId && sponsorId !== input.sponsorId);

      if (lockedByAnotherSponsor) {
        return {
          applied: false,
          reason: 'lock_conflict',
          assignment,
        };
      }

      if (
        assignment.assignmentStatus === CrmAssignmentStatus.auto_accepted &&
        assignment.conversationOwnerSponsorId === input.sponsorId
      ) {
        return {
          applied: true,
          reason: 'idempotent',
          assignment,
        };
      }

      const updated = await tx.crmLeadAssignment.update({
        where: {
          id: assignment.id,
        },
        data: {
          assignedSponsorId: assignment.assignedSponsorId ?? input.sponsorId,
          conversationOwnerSponsorId: input.sponsorId,
          assignmentStatus: CrmAssignmentStatus.auto_accepted,
          acceptedAt: assignment.acceptedAt ?? now,
          lastConversationAt: now,
          ownershipLockedUntil: addOwnershipLock(now),
          metadataJson: toInputJsonValue({
            ...(this.readMetadata(assignment.metadataJson) ?? {}),
            ...(input.metadata ?? {}),
          }),
        },
      });

      await this.emitAssignmentEvent(
        {
          workspaceId: updated.workspaceId,
          teamId: updated.teamId,
          leadId: updated.leadId,
          eventType: CrmAssignmentEventType.assignment_auto_accepted,
          actorSponsorId: input.sponsorId,
          source: input.source ?? CrmAssignmentSource.whatsapp_inbound,
          metadata: {
            assignmentId: updated.id,
            ownershipLockedUntil: updated.ownershipLockedUntil,
          },
        },
        tx,
      );

      return {
        applied: true,
        reason: 'auto_accepted',
        assignment: updated,
      };
    });
  }

  async reassignAssignment(input: {
    assignmentId: string;
    targetSponsorId: string;
    actorSponsorId?: string | null;
    overrideLock?: boolean;
    metadata?: Record<string, unknown>;
    now?: Date;
  }) {
    const now = input.now ?? new Date();

    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.crmLeadAssignment.findUnique({
        where: {
          id: input.assignmentId,
        },
      });

      if (!assignment) {
        throw new NotFoundException({
          code: 'CRM_ASSIGNMENT_NOT_FOUND',
          message: 'The requested CRM assignment was not found.',
        });
      }

      if (isLocked(assignment, now) && !input.overrideLock) {
        throw new ConflictException({
          code: 'CRM_ASSIGNMENT_LOCKED',
          message: 'The current CRM assignment is ownership locked.',
          ownershipLockedUntil: assignment.ownershipLockedUntil,
        });
      }

      const updated = await tx.crmLeadAssignment.update({
        where: {
          id: assignment.id,
        },
        data: {
          assignedSponsorId: input.targetSponsorId,
          acceptedBySponsorId: null,
          conversationOwnerSponsorId: null,
          assignmentStatus: CrmAssignmentStatus.pending_assignment,
          assignmentSource: CrmAssignmentSource.reassignment,
          assignedAt: now,
          acceptedAt: null,
          ownershipLockedUntil: addOwnershipLock(now),
          metadataJson: toInputJsonValue({
            ...(this.readMetadata(assignment.metadataJson) ?? {}),
            ...(input.metadata ?? {}),
          }),
        },
      });

      await this.emitAssignmentEvent(
        {
          workspaceId: updated.workspaceId,
          teamId: updated.teamId,
          leadId: updated.leadId,
          eventType: CrmAssignmentEventType.assignment_reassigned,
          actorSponsorId: input.actorSponsorId ?? input.targetSponsorId,
          source: CrmAssignmentSource.reassignment,
          metadata: {
            assignmentId: updated.id,
            previousAssignedSponsorId: assignment.assignedSponsorId,
            nextAssignedSponsorId: input.targetSponsorId,
            overrideLock: Boolean(input.overrideLock),
          },
        },
        tx,
      );

      return updated;
    });
  }

  async lockOwnership(input: {
    assignmentId: string;
    until?: Date;
    now?: Date;
  }) {
    const now = input.now ?? new Date();

    return this.prisma.crmLeadAssignment.update({
      where: {
        id: input.assignmentId,
      },
      data: {
        ownershipLockedUntil: input.until ?? addOwnershipLock(now),
      },
    });
  }

  async emitAssignmentEvent(
    input: {
      workspaceId: string;
      teamId: string;
      leadId: string;
      eventType: CrmAssignmentEventType;
      actorSponsorId?: string | null;
      source: CrmAssignmentSource;
      metadata?: Record<string, unknown>;
    },
    tx: AssignmentTx = this.prisma,
  ) {
    return tx.crmAssignmentEvent.create({
      data: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        leadId: input.leadId,
        eventType: input.eventType,
        actorSponsorId: input.actorSponsorId ?? null,
        source: input.source,
        metadataJson: toInputJsonValue(input.metadata ?? {}),
      },
    });
  }

  private async scheduleInitialContact(
    assignment: {
      id: string;
      workspaceId: string;
      teamId: string;
      leadId: string;
      conversationOwnerSponsorId?: string | null;
      lastConversationAt?: Date | null;
    },
    sponsorId: string,
    tx: AssignmentTx,
    now: Date,
  ) {
    await this.outreachScheduler?.scheduleInitialContact({
      workspaceId: assignment.workspaceId,
      teamId: assignment.teamId,
      leadId: assignment.leadId,
      sponsorId,
      assignmentId: assignment.id,
      conversationStartedAt: assignment.lastConversationAt ?? null,
      conversationOwnerSponsorId: assignment.conversationOwnerSponsorId ?? null,
      now,
      tx,
      metadata: {
        source: 'manual_accept',
      },
    });
  }

  private readMetadata(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }
}
