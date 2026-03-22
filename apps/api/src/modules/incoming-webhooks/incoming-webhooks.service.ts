import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  type AssignmentStatus,
  type ConversationSignal,
  ConversationSignalProcessingStatus,
  type LeadStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ReceiveMessagingSignalDto } from './dto/receive-messaging-signal.dto';
import type {
  ConversationSignalView,
  LeadConversationSignalScope,
} from './incoming-webhooks.types';
import {
  matchesIncomingWebhookSecret,
  parseConversationSignalLimit,
  readIncomingWebhookSecret,
  resolveConversationSignalTransition,
} from './incoming-webhooks.utils';

const assignmentContextInclude = {
  lead: true,
  sponsor: {
    include: {
      messagingConnection: true,
    },
  },
} satisfies Prisma.AssignmentInclude;

const leadContextInclude = {
  currentAssignment: {
    include: {
      sponsor: {
        include: {
          messagingConnection: true,
        },
      },
    },
  },
  assignments: {
    orderBy: {
      assignedAt: 'desc',
    },
    take: 1,
    include: {
      sponsor: {
        include: {
          messagingConnection: true,
        },
      },
    },
  },
  funnelInstance: true,
  funnelPublication: true,
} satisfies Prisma.LeadInclude;

const sponsorContextInclude = {
  messagingConnection: true,
} satisfies Prisma.SponsorInclude;

type SponsorContextRecord = Prisma.SponsorGetPayload<{
  include: typeof sponsorContextInclude;
}>;

type ResolvedSignalContext = {
  workspaceId: string;
  teamId: string;
  sponsorId: string | null;
  leadId: string | null;
  assignmentId: string | null;
  messagingConnectionId: string | null;
  automationDispatchId: string | null;
};

const toIso = (value: Date | null) => (value ? value.toISOString() : null);

const toInputJsonValue = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

@Injectable()
export class IncomingWebhooksService {
  private readonly incomingWebhookSecret =
    process.env.INCOMING_MESSAGING_WEBHOOK_SECRET?.trim() || null;

  constructor(private readonly prisma: PrismaService) {}

  async ingestMessagingSignal(
    headers: Record<string, string | string[] | undefined>,
    dto: ReceiveMessagingSignalDto,
  ): Promise<ConversationSignalView> {
    this.assertWebhookSecret(headers);
    this.assertPayload(dto);

    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();

    if (Number.isNaN(occurredAt.valueOf())) {
      throw new BadRequestException({
        code: 'INVALID_SIGNAL_OCCURRED_AT',
        message: 'The provided occurredAt timestamp is invalid.',
      });
    }

    const context = await this.resolveSignalContext(dto);
    const signal = await this.prisma.conversationSignal.create({
      data: {
        id: randomUUID(),
        workspaceId: context.workspaceId,
        teamId: context.teamId,
        sponsorId: context.sponsorId,
        leadId: context.leadId,
        assignmentId: context.assignmentId,
        messagingConnectionId: context.messagingConnectionId,
        automationDispatchId: context.automationDispatchId,
        source: dto.source,
        signalType: dto.signalType,
        processingStatus: ConversationSignalProcessingStatus.received,
        externalEventId: dto.externalEventId ?? null,
        payloadSnapshot: toInputJsonValue({
          leadId: dto.leadId ?? null,
          assignmentId: dto.assignmentId ?? null,
          sponsorId: dto.sponsorId ?? null,
          messagingInstanceId: dto.messagingInstanceId ?? null,
          payload: dto.payload ?? null,
        }),
        occurredAt,
      },
    });

    try {
      const processed = await this.prisma.$transaction(async (tx) => {
        const liveLead = context.leadId
          ? await tx.lead.findUnique({
              where: {
                id: context.leadId,
              },
            })
          : null;
        const liveAssignment = context.assignmentId
          ? await tx.assignment.findUnique({
              where: {
                id: context.assignmentId,
              },
            })
          : null;

        if (!liveLead && !liveAssignment) {
          const ignored = await tx.conversationSignal.update({
            where: {
              id: signal.id,
            },
            data: {
              processingStatus: ConversationSignalProcessingStatus.ignored,
              errorCode: 'SIGNAL_CONTEXT_UNRESOLVED',
              errorMessage:
                'The signal was received but could not be linked to a lead or assignment.',
              processedAt: new Date(),
            },
          });

          await this.recordDomainEvent(tx, ignored);
          return ignored;
        }

        const leadStatusBefore = liveLead?.status ?? null;
        const assignmentStatusBefore = liveAssignment?.status ?? null;
        const transition = resolveConversationSignalTransition({
          signalType: signal.signalType,
          currentLeadStatus: leadStatusBefore,
          currentAssignmentStatus: assignmentStatusBefore,
        });

        let leadStatusAfter = leadStatusBefore;
        let assignmentStatusAfter = assignmentStatusBefore;

        if (
          liveLead &&
          transition.leadStatusAfter &&
          transition.leadStatusAfter !== liveLead.status
        ) {
          const updatedLead = await tx.lead.update({
            where: {
              id: liveLead.id,
            },
            data: {
              status: transition.leadStatusAfter,
            },
          });

          leadStatusAfter = updatedLead.status;
        }

        if (
          liveAssignment &&
          transition.assignmentStatusAfter &&
          transition.assignmentStatusAfter !== liveAssignment.status
        ) {
          const nextResolvedAt =
            transition.assignmentStatusAfter === 'closed'
              ? (liveAssignment.resolvedAt ?? new Date())
              : liveAssignment.resolvedAt;
          const updatedAssignment = await tx.assignment.update({
            where: {
              id: liveAssignment.id,
            },
            data: {
              status: transition.assignmentStatusAfter,
              resolvedAt: nextResolvedAt,
            },
          });

          assignmentStatusAfter = updatedAssignment.status;
        }

        const updatedSignal = await tx.conversationSignal.update({
          where: {
            id: signal.id,
          },
          data: {
            processingStatus: ConversationSignalProcessingStatus.applied,
            leadStatusAfter: leadStatusAfter ?? null,
            assignmentStatusAfter: assignmentStatusAfter ?? null,
            processedAt: new Date(),
          },
        });

        await this.recordDomainEvent(tx, updatedSignal, {
          leadStatusBefore,
          assignmentStatusBefore,
        });

        return updatedSignal;
      });

      return this.mapSignal(processed);
    } catch (error) {
      const failed = await this.prisma.conversationSignal.update({
        where: {
          id: signal.id,
        },
        data: {
          processingStatus: ConversationSignalProcessingStatus.failed,
          errorCode: 'SIGNAL_PROCESSING_FAILED',
          errorMessage:
            error instanceof Error
              ? error.message
              : 'The signal processing failed unexpectedly.',
          processedAt: new Date(),
        },
      });

      return this.mapSignal(failed);
    }
  }

  async listLeadSignals(
    user: AuthenticatedUser,
    leadId: string,
    limit?: string,
  ): Promise<ConversationSignalView[]> {
    if (!leadId?.trim()) {
      throw new BadRequestException({
        code: 'LEAD_ID_REQUIRED',
        message: 'A leadId query parameter is required.',
      });
    }

    const take = parseConversationSignalLimit(limit);
    const scope = this.resolveLeadScope(user);

    const records = await this.prisma.conversationSignal.findMany({
      where: {
        leadId,
        ...(scope.workspaceId ? { workspaceId: scope.workspaceId } : {}),
        ...(scope.teamId ? { teamId: scope.teamId } : {}),
        ...(scope.sponsorId ? { sponsorId: scope.sponsorId } : {}),
      },
      orderBy: {
        occurredAt: 'desc',
      },
      take,
    });

    return records.map((record) => this.mapSignal(record));
  }

  private assertWebhookSecret(
    headers: Record<string, string | string[] | undefined>,
  ) {
    if (!this.incomingWebhookSecret) {
      throw new ServiceUnavailableException({
        code: 'WEBHOOK_SECRET_UNCONFIGURED',
        message: 'Incoming messaging webhooks are not configured yet.',
      });
    }

    const providedSecret = readIncomingWebhookSecret(headers);

    if (
      !matchesIncomingWebhookSecret(this.incomingWebhookSecret, providedSecret)
    ) {
      throw new UnauthorizedException({
        code: 'WEBHOOK_SECRET_INVALID',
        message: 'The provided incoming webhook secret is invalid.',
      });
    }
  }

  private assertPayload(dto: ReceiveMessagingSignalDto) {
    if (!dto.source || !dto.signalType) {
      throw new BadRequestException({
        code: 'SIGNAL_PAYLOAD_INVALID',
        message: 'Both source and signalType are required.',
      });
    }

    if (
      !dto.leadId &&
      !dto.assignmentId &&
      !dto.sponsorId &&
      !dto.messagingInstanceId
    ) {
      throw new BadRequestException({
        code: 'SIGNAL_CONTEXT_REQUIRED',
        message:
          'Provide at least one identifier: leadId, assignmentId, sponsorId or messagingInstanceId.',
      });
    }
  }

  private async resolveSignalContext(
    dto: ReceiveMessagingSignalDto,
  ): Promise<ResolvedSignalContext> {
    if (dto.assignmentId) {
      const assignment = await this.prisma.assignment.findUnique({
        where: {
          id: dto.assignmentId,
        },
        include: assignmentContextInclude,
      });

      if (!assignment) {
        throw new BadRequestException({
          code: 'ASSIGNMENT_NOT_FOUND',
          message: 'The provided assignmentId could not be resolved.',
        });
      }

      return {
        workspaceId: assignment.workspaceId,
        teamId: assignment.teamId,
        sponsorId: assignment.sponsorId,
        leadId: assignment.leadId,
        assignmentId: assignment.id,
        messagingConnectionId:
          assignment.sponsor.messagingConnection?.id ?? null,
        automationDispatchId: await this.resolveAutomationDispatchId(dto),
      };
    }

    if (dto.leadId) {
      const lead = await this.prisma.lead.findUnique({
        where: {
          id: dto.leadId,
        },
        include: leadContextInclude,
      });

      if (!lead) {
        throw new BadRequestException({
          code: 'LEAD_NOT_FOUND',
          message: 'The provided leadId could not be resolved.',
        });
      }

      const assignment = lead.currentAssignment ?? lead.assignments[0] ?? null;

      return {
        workspaceId: lead.workspaceId,
        teamId:
          assignment?.teamId ??
          lead.funnelInstance?.teamId ??
          lead.funnelPublication?.teamId ??
          (() => {
            throw new BadRequestException({
              code: 'SIGNAL_TEAM_UNRESOLVED',
              message: 'The signal could not resolve a team for this lead.',
            });
          })(),
        sponsorId: assignment?.sponsorId ?? dto.sponsorId ?? null,
        leadId: lead.id,
        assignmentId: assignment?.id ?? null,
        messagingConnectionId:
          assignment?.sponsor.messagingConnection?.id ?? null,
        automationDispatchId: await this.resolveAutomationDispatchId(dto),
      };
    }

    const sponsor = await this.resolveSponsorContext(dto);

    return {
      workspaceId: sponsor.workspaceId,
      teamId: sponsor.teamId,
      sponsorId: sponsor.id,
      leadId: null,
      assignmentId: null,
      messagingConnectionId: sponsor.messagingConnection?.id ?? null,
      automationDispatchId: await this.resolveAutomationDispatchId(dto),
    };
  }

  private async resolveSponsorContext(
    dto: ReceiveMessagingSignalDto,
  ): Promise<SponsorContextRecord> {
    if (dto.sponsorId) {
      const sponsor = await this.prisma.sponsor.findUnique({
        where: {
          id: dto.sponsorId,
        },
        include: sponsorContextInclude,
      });

      if (!sponsor) {
        throw new BadRequestException({
          code: 'SPONSOR_NOT_FOUND',
          message: 'The provided sponsorId could not be resolved.',
        });
      }

      return sponsor;
    }

    const connection = await this.prisma.messagingConnection.findUnique({
      where: {
        externalInstanceId: dto.messagingInstanceId ?? undefined,
      },
      include: {
        sponsor: {
          include: sponsorContextInclude,
        },
      },
    });

    if (!connection) {
      throw new BadRequestException({
        code: 'MESSAGING_INSTANCE_NOT_FOUND',
        message: 'The provided messagingInstanceId could not be resolved.',
      });
    }

    return connection.sponsor;
  }

  private async resolveAutomationDispatchId(
    dto: ReceiveMessagingSignalDto,
  ): Promise<string | null> {
    if (!dto.automationDispatchId) {
      return null;
    }

    const dispatch = await this.prisma.automationDispatch.findUnique({
      where: {
        id: dto.automationDispatchId,
      },
      select: {
        id: true,
      },
    });

    return dispatch?.id ?? null;
  }

  private resolveLeadScope(
    user: AuthenticatedUser,
  ): LeadConversationSignalScope {
    switch (user.role) {
      case 'SUPER_ADMIN':
        return {
          workspaceId: user.workspaceId ?? undefined,
        };
      case 'TEAM_ADMIN':
        return {
          workspaceId: user.workspaceId ?? undefined,
          teamId: user.teamId ?? undefined,
        };
      case 'MEMBER':
        return {
          workspaceId: user.workspaceId ?? undefined,
          teamId: user.teamId ?? undefined,
          sponsorId: user.sponsorId ?? undefined,
        };
      default:
        return {};
    }
  }

  private async recordDomainEvent(
    tx: Prisma.TransactionClient,
    signal: ConversationSignal,
    previous?: {
      leadStatusBefore: LeadStatus | null;
      assignmentStatusBefore: AssignmentStatus | null;
    },
  ) {
    const aggregateType = signal.leadId
      ? 'lead'
      : signal.assignmentId
        ? 'assignment'
        : signal.sponsorId
          ? 'sponsor'
          : 'event';
    const aggregateId =
      signal.leadId ?? signal.assignmentId ?? signal.sponsorId ?? signal.id;

    await tx.domainEvent.create({
      data: {
        id: randomUUID(),
        workspaceId: signal.workspaceId,
        eventId: randomUUID(),
        aggregateType,
        aggregateId,
        eventName: signal.signalType,
        actorType: 'integration',
        payload: toInputJsonValue({
          signalId: signal.id,
          source: signal.source,
          processingStatus: signal.processingStatus,
          externalEventId: signal.externalEventId,
          leadStatusBefore: previous?.leadStatusBefore ?? null,
          leadStatusAfter: signal.leadStatusAfter ?? null,
          assignmentStatusBefore: previous?.assignmentStatusBefore ?? null,
          assignmentStatusAfter: signal.assignmentStatusAfter ?? null,
          errorCode: signal.errorCode ?? null,
          errorMessage: signal.errorMessage ?? null,
        }),
        occurredAt: signal.occurredAt,
        visitorId: null,
        leadId: signal.leadId,
        assignmentId: signal.assignmentId,
      },
    });
  }

  private mapSignal(signal: ConversationSignal): ConversationSignalView {
    return {
      id: signal.id,
      workspaceId: signal.workspaceId,
      teamId: signal.teamId,
      sponsorId: signal.sponsorId ?? null,
      leadId: signal.leadId ?? null,
      assignmentId: signal.assignmentId ?? null,
      messagingConnectionId: signal.messagingConnectionId ?? null,
      automationDispatchId: signal.automationDispatchId ?? null,
      source: signal.source,
      signalType: signal.signalType,
      processingStatus: signal.processingStatus,
      externalEventId: signal.externalEventId ?? null,
      errorCode: signal.errorCode ?? null,
      errorMessage: signal.errorMessage ?? null,
      leadStatusAfter: signal.leadStatusAfter ?? null,
      assignmentStatusAfter: signal.assignmentStatusAfter ?? null,
      occurredAt: signal.occurredAt.toISOString(),
      processedAt: toIso(signal.processedAt),
      createdAt: signal.createdAt.toISOString(),
      updatedAt: signal.updatedAt.toISOString(),
    };
  }
}
