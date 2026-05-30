import { Injectable, Logger } from '@nestjs/common';
import {
  CrmAssignmentEventType,
  CrmAssignmentSource,
  CrmAssignmentStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeMessagingPhone } from '../shared/messaging-channel.utils';
import { CrmAssignmentService } from './crm-assignment.service';

const readWhatsappPhone = (value: string | null | undefined) =>
  normalizeMessagingPhone(value?.split('@')[0] ?? null);

const ACTIVE_ASSIGNMENT_STATUSES = new Set<CrmAssignmentStatus>([
  CrmAssignmentStatus.pending_assignment,
  CrmAssignmentStatus.accepted,
  CrmAssignmentStatus.auto_accepted,
]);

@Injectable()
export class CrmConversationOwnershipService {
  private readonly logger = new Logger(CrmConversationOwnershipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crmAssignmentService: CrmAssignmentService,
  ) {}

  async handleWhatsappConversation(input: {
    phoneE164?: string | null;
    whatsappId?: string | null;
    receiverSponsorId?: string | null;
    receiverInstanceId?: string | null;
    metadata?: Record<string, unknown>;
    occurredAt?: Date;
  }) {
    const sponsor = await this.resolveReceiverSponsor(input);

    if (!sponsor) {
      return {
        applied: false,
        reason: 'receiver_sponsor_not_found',
      };
    }

    const normalizedPhone =
      normalizeMessagingPhone(input.phoneE164) ??
      readWhatsappPhone(input.whatsappId);

    if (!normalizedPhone) {
      return {
        applied: false,
        reason: 'conversation_identity_not_found',
      };
    }

    const lead = await this.findLeadByPhone({
      workspaceId: sponsor.workspaceId,
      phone: normalizedPhone,
    });

    if (!lead) {
      return {
        applied: false,
        reason: 'lead_not_found',
      };
    }

    const existingAssignment = await this.prisma.crmLeadAssignment.findFirst({
      where: {
        workspaceId: sponsor.workspaceId,
        teamId: sponsor.teamId,
        leadId: lead.id,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (existingAssignment?.assignmentStatus === CrmAssignmentStatus.closed) {
      return {
        applied: false,
        reason: 'closed',
        leadId: lead.id,
        assignmentId: existingAssignment.id,
      };
    }

    const activeAssignment =
      existingAssignment &&
      ACTIVE_ASSIGNMENT_STATUSES.has(existingAssignment.assignmentStatus)
        ? existingAssignment
        : null;
    const assignment =
      activeAssignment ??
      (await this.crmAssignmentService.createAssignment({
        workspaceId: sponsor.workspaceId,
        teamId: sponsor.teamId,
        leadId: lead.id,
        assignedSponsorId: sponsor.id,
        assignmentSource: CrmAssignmentSource.whatsapp_inbound,
        metadata: {
          created_by: 'crm_conversation_ownership',
          phone_e164: normalizedPhone,
          receiver_instance_id: input.receiverInstanceId ?? null,
        },
        now: input.occurredAt,
      }));

    await this.crmAssignmentService.emitAssignmentEvent({
      workspaceId: assignment.workspaceId,
      teamId: assignment.teamId,
      leadId: assignment.leadId,
      eventType: CrmAssignmentEventType.conversation_detected,
      actorSponsorId: sponsor.id,
      source: CrmAssignmentSource.whatsapp_inbound,
      metadata: {
        assignmentId: assignment.id,
        phone_e164: normalizedPhone,
        whatsapp_id: input.whatsappId ?? null,
        receiver_instance_id: input.receiverInstanceId ?? null,
        ...(input.metadata ?? {}),
      },
    });

    const result = await this.crmAssignmentService.autoAcceptAssignment({
      assignmentId: assignment.id,
      sponsorId: sponsor.id,
      source: CrmAssignmentSource.whatsapp_inbound,
      metadata: {
        auto_accept_reason: 'whatsapp_conversation_detected',
        phone_e164: normalizedPhone,
        whatsapp_id: input.whatsappId ?? null,
      },
      now: input.occurredAt,
    });

    return {
      ...result,
      leadId: lead.id,
    };
  }

  private async resolveReceiverSponsor(input: {
    receiverSponsorId?: string | null;
    receiverInstanceId?: string | null;
  }) {
    if (input.receiverSponsorId) {
      return this.prisma.sponsor.findUnique({
        where: {
          id: input.receiverSponsorId,
        },
        select: {
          id: true,
          workspaceId: true,
          teamId: true,
        },
      });
    }

    if (!input.receiverInstanceId) {
      return null;
    }

    const connection = await this.prisma.messagingConnection.findUnique({
      where: {
        externalInstanceId: input.receiverInstanceId,
      },
      select: {
        sponsor: {
          select: {
            id: true,
            workspaceId: true,
            teamId: true,
          },
        },
      },
    });

    return connection?.sponsor ?? null;
  }

  private async findLeadByPhone(input: { workspaceId: string; phone: string }) {
    const lastEight = input.phone.slice(-8);

    try {
      return await this.prisma.lead.findFirst({
        where: {
          workspaceId: input.workspaceId,
          OR: [
            {
              phone: input.phone,
            },
            {
              phone: {
                contains: lastEight,
              },
            },
          ],
        },
        orderBy: {
          updatedAt: 'desc',
        },
        select: {
          id: true,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Could not resolve CRM conversation lead by phone: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );

      return null;
    }
  }
}
