import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { MessagingConnectionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CrmConversationOwnershipService } from '../crm/crm-conversation-ownership.service';
import { KloserApiClient } from '../kloser/kloser-api.client';
import {
  normalizeMessagingPhone,
  resolveMessagingConnectionStatus,
} from '../shared/messaging-channel.utils';
import { redactSensitiveData } from '../shared/redact-sensitive-data';
import {
  detectOptOutKeyword,
  extractInboundMessagePhone,
  extractInboundMessageText,
  matchesIncomingWebhookSecret,
  readIncomingWebhookSecret,
} from './incoming-webhooks.utils';

const toInputJsonValue = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const stringifyForLogs = (value: unknown) => {
  try {
    return JSON.stringify(redactSensitiveData(value));
  } catch {
    return '[unserializable payload]';
  }
};

const toDateOrNull = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
};

const toWhatsappRemoteJid = (phone: string | null | undefined) => {
  const normalizedPhone = normalizeMessagingPhone(phone ?? null);

  return normalizedPhone ? `${normalizedPhone}@s.whatsapp.net` : null;
};

const extractConnectionWebhookPayload = (input: {
  queryInstanceId?: string;
  payload?: unknown;
}) => {
  const payload = asRecord(input.payload);
  const data = asRecord(payload?.data);
  const instance = asRecord(payload?.instance) ?? asRecord(data?.instance);
  const instanceId =
    readString(input.queryInstanceId) ??
    readString(payload?.instanceId) ??
    readString(payload?.instanceName) ??
    readString(payload?.instance) ??
    readString(data?.instanceId) ??
    readString(data?.instanceName) ??
    readString(instance?.instanceId) ??
    readString(instance?.instanceName);
  const status =
    readString(payload?.status) ??
    readString(payload?.state) ??
    readString(payload?.connectionStatus) ??
    readString(data?.status) ??
    readString(data?.state) ??
    readString(instance?.status) ??
    readString(instance?.state);
  const phone =
    readString(payload?.phone) ??
    readString(payload?.number) ??
    readString(data?.phone) ??
    readString(data?.number) ??
    readString(instance?.owner) ??
    readString(instance?.number);

  return {
    instanceId,
    status,
    phone: phone?.split('@')[0] ?? null,
    occurredAt:
      readString(payload?.occurredAt) ??
      readString(payload?.createdAt) ??
      readString(data?.occurredAt),
    externalEventId:
      readString(payload?.eventId) ??
      readString(payload?.id) ??
      readString(data?.eventId),
    payload,
  };
};

const extractInboundWhatsappId = (payload: unknown): string | null => {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const key = asRecord(root?.key) ?? asRecord(data?.key);

  return (
    readString(root?.whatsappId) ??
    readString(root?.whatsapp_id) ??
    readString(data?.whatsappId) ??
    readString(data?.whatsapp_id) ??
    readString(key?.remoteJid) ??
    readString(key?.participant) ??
    null
  );
};

@Injectable()
export class IncomingWebhooksService {
  private readonly logger = new Logger(IncomingWebhooksService.name);
  private readonly incomingWebhookSecret =
    process.env.INCOMING_MESSAGING_WEBHOOK_SECRET?.trim() || null;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly kloserApiClient?: KloserApiClient,
    @Optional()
    private readonly crmConversationOwnershipService?: CrmConversationOwnershipService,
  ) {}

  async ingestMessagingConnection(
    headers: Record<string, string | string[] | undefined>,
    query: {
      instanceId?: string;
      secret?: string;
    },
    payload?: unknown,
  ) {
    this.logger.log(
      `Inbound messaging webhook received before validation: headers=${stringifyForLogs(
        headers,
      )} query=${stringifyForLogs({
        instanceId: query.instanceId ?? null,
        secret: query.secret ?? null,
      })} body=${stringifyForLogs(payload)}`,
    );

    this.assertWebhookSecret(headers, query.secret ?? null);

    const parsed = extractConnectionWebhookPayload({
      queryInstanceId: query.instanceId,
      payload,
    });

    this.logger.log(
      `Inbound messaging webhook parsed payload: ${stringifyForLogs(parsed)}`,
    );

    if (!parsed.instanceId || !parsed.status) {
      this.logger.warn(
        `Rejecting inbound messaging webhook because instanceId or status is missing. Parsed=${stringifyForLogs(
          parsed,
        )}`,
      );
      throw new BadRequestException({
        code: 'CONNECTION_WEBHOOK_INVALID',
        message: 'The connection webhook must include instanceId and status.',
      });
    }

    const connection = await this.prisma.messagingConnection.findUnique({
      where: {
        externalInstanceId: parsed.instanceId,
      },
      include: {
        sponsor: true,
      },
    });

    if (!connection) {
      this.logger.warn(
        `Rejecting inbound messaging webhook because instance ${parsed.instanceId} was not found.`,
      );
      throw new BadRequestException({
        code: 'MESSAGING_INSTANCE_NOT_FOUND',
        message: `The instance ${parsed.instanceId} could not be resolved.`,
      });
    }

    const nextStatus = resolveMessagingConnectionStatus({
      state: parsed.status,
    });
    this.logger.log(
      `Resolved inbound messaging webhook instance=${parsed.instanceId} rawStatus=${parsed.status} nextStatus=${nextStatus}`,
    );
    const occurredAt = toDateOrNull(parsed.occurredAt) ?? new Date();
    const normalizedPhone =
      normalizeMessagingPhone(parsed.phone) ?? connection.normalizedPhone;
    const notificationMessage =
      nextStatus === MessagingConnectionStatus.connected
        ? `¡Asesor ${connection.sponsor.displayName} conectado con éxito!`
        : null;

    const updatedConnection = await this.prisma.$transaction(async (tx) => {
      const messagingConnection = await tx.messagingConnection.update({
        where: {
          id: connection.id,
        },
        data: {
          status: nextStatus,
          phone: parsed.phone ?? connection.phone,
          normalizedPhone,
          qrCodeData:
            nextStatus === MessagingConnectionStatus.connected ||
            nextStatus === MessagingConnectionStatus.disconnected
              ? null
              : connection.qrCodeData,
          pairingCode:
            nextStatus === MessagingConnectionStatus.connected ||
            nextStatus === MessagingConnectionStatus.disconnected
              ? null
              : connection.pairingCode,
          pairingExpiresAt:
            nextStatus === MessagingConnectionStatus.connected ||
            nextStatus === MessagingConnectionStatus.disconnected
              ? null
              : connection.pairingExpiresAt,
          metadataJson: this.buildConnectionMetadata(connection.metadataJson, {
            lastKnownState: parsed.status,
            lastConnectionWebhookPayload: parsed.payload ?? null,
            lastConnectionWebhookEventId: parsed.externalEventId,
          }),
          lastSyncedAt: occurredAt,
          lastConnectedAt:
            nextStatus === MessagingConnectionStatus.connected
              ? occurredAt
              : connection.lastConnectedAt,
          lastDisconnectedAt:
            nextStatus === MessagingConnectionStatus.disconnected
              ? occurredAt
              : connection.lastDisconnectedAt,
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });

      if (nextStatus === MessagingConnectionStatus.connected) {
        await tx.sponsor.update({
          where: {
            id: connection.sponsorId,
          },
          data: {
            availabilityStatus: 'available',
          },
        });
      } else if (nextStatus === MessagingConnectionStatus.disconnected) {
        await tx.sponsor.update({
          where: {
            id: connection.sponsorId,
          },
          data: {
            availabilityStatus: 'offline',
          },
        });
      }

      if (notificationMessage) {
        await tx.domainEvent.create({
          data: {
            id: randomUUID(),
            workspaceId: connection.workspaceId,
            eventId: randomUUID(),
            aggregateType: 'sponsor',
            aggregateId: connection.sponsorId,
            eventName: 'system_notification',
            actorType: 'system',
            payload: toInputJsonValue({
              kind: 'messaging_connection_connected',
              message: notificationMessage,
              sponsorId: connection.sponsorId,
              messagingConnectionId: connection.id,
              instanceId: connection.externalInstanceId,
              status: nextStatus,
            }),
            occurredAt,
            visitorId: null,
            leadId: null,
            assignmentId: null,
          },
        });
      }

      await tx.domainEvent.create({
        data: {
          id: randomUUID(),
          workspaceId: connection.workspaceId,
          eventId: randomUUID(),
          aggregateType: 'sponsor',
          aggregateId: connection.sponsorId,
          eventName: 'messaging_connection_status_updated',
          actorType: 'integration',
          payload: toInputJsonValue({
            sponsorId: connection.sponsorId,
            messagingConnectionId: connection.id,
            instanceId: connection.externalInstanceId,
            status: nextStatus,
            rawStatus: parsed.status,
            externalEventId: parsed.externalEventId,
          }),
          occurredAt,
          visitorId: null,
          leadId: null,
          assignmentId: null,
        },
      });

      return messagingConnection;
    });

    return {
      ok: true,
      sponsorId: connection.sponsorId,
      instanceId: connection.externalInstanceId,
      status: updatedConnection.status,
      availabilityStatus:
        updatedConnection.status === MessagingConnectionStatus.connected
          ? 'available'
          : updatedConnection.status === MessagingConnectionStatus.disconnected
            ? 'offline'
            : connection.sponsor.availabilityStatus,
      notification: notificationMessage,
    };
  }

  async ingestMessagingSignal(
    headers: Record<string, string | string[] | undefined>,
    query: {
      instanceId?: string;
      secret?: string;
    },
    payload?: unknown,
  ) {
    this.assertWebhookSecret(headers, query.secret ?? null);

    const root = asRecord(payload);
    const data = asRecord(root?.data);
    const leadId =
      readString(root?.leadId) ??
      readString(data?.leadId) ??
      readString(root?.lead_id) ??
      null;
    const assignmentId =
      readString(root?.assignmentId) ??
      readString(data?.assignmentId) ??
      readString(root?.assignment_id) ??
      null;
    const sponsorId =
      readString(root?.sponsorId) ??
      readString(data?.sponsorId) ??
      readString(root?.sponsor_id) ??
      null;
    const instanceId =
      readString(query.instanceId) ??
      readString(root?.messagingInstanceId) ??
      readString(data?.messagingInstanceId) ??
      readString(root?.instanceId) ??
      null;
    const externalEventId =
      readString(root?.externalEventId) ??
      readString(data?.externalEventId) ??
      readString(root?.eventId) ??
      readString(data?.eventId) ??
      null;
    const messageText = extractInboundMessageText(payload);
    const keyword = detectOptOutKeyword(messageText);
    const senderPhone = normalizeMessagingPhone(
      extractInboundMessagePhone(payload),
    );
    const senderWhatsappId = extractInboundWhatsappId(payload);

    await this.detectCrmConversationOwnership({
      instanceId,
      senderPhone,
      senderWhatsappId,
      externalEventId,
    });

    const leadContext = await this.resolveLeadContext({
      leadId,
      assignmentId,
      sponsorId,
      instanceId,
      senderPhone,
    });

    if (!leadContext) {
      this.logger.warn(
        `Inbound messaging signal could not be scoped to a lead. externalEventId=${externalEventId ?? 'n/a'} leadId=${leadId ?? 'n/a'} assignmentId=${assignmentId ?? 'n/a'} sponsorId=${sponsorId ?? 'n/a'} instanceId=${instanceId ?? 'n/a'}`,
      );

      return {
        ok: true,
        applied: false,
        reason: 'lead_context_not_found',
        keyword,
      };
    }

    if (messageText) {
      this.fireKloserHardKill({
        leadContext,
        senderPhone,
        keyword,
        externalEventId,
      });
    }

    if (!keyword) {
      return {
        ok: true,
        applied: false,
        reason: 'no_opt_out_keyword_detected',
        leadId: leadContext.leadId,
      };
    }

    this.logger.log(
      `Inbound opt-out detected for lead=${leadContext.leadId} keyword=${keyword}. Leadflow no longer applies blacklist writes and delegates protection management to Kurukin Hub via SSO.`,
    );

    return {
      ok: true,
      applied: false,
      leadId: leadContext.leadId,
      keyword,
      reason: 'external_blacklist_managed_in_kurukin',
    };
  }

  private assertWebhookSecret(
    headers: Record<string, string | string[] | undefined>,
    querySecret?: string | null,
  ) {
    if (!this.incomingWebhookSecret) {
      this.logger.warn(
        'Rejecting inbound messaging webhook because INCOMING_MESSAGING_WEBHOOK_SECRET is not configured.',
      );
      throw new ServiceUnavailableException({
        code: 'WEBHOOK_SECRET_UNCONFIGURED',
        message: 'Incoming messaging webhooks are not configured yet.',
      });
    }

    const providedSecret =
      readIncomingWebhookSecret(headers) ?? querySecret ?? null;

    if (
      !matchesIncomingWebhookSecret(this.incomingWebhookSecret, providedSecret)
    ) {
      this.logger.warn(
        `Rejecting inbound messaging webhook because the provided secret is invalid. details=${stringifyForLogs(
          {
            headersSecret: readIncomingWebhookSecret(headers),
            querySecret: querySecret ?? null,
          },
        )}`,
      );
      throw new UnauthorizedException({
        code: 'WEBHOOK_SECRET_INVALID',
        message: 'The provided incoming webhook secret is invalid.',
      });
    }
  }

  private buildConnectionMetadata(
    currentMetadata: Prisma.JsonValue | null,
    patch: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    const metadata =
      currentMetadata &&
      typeof currentMetadata === 'object' &&
      !Array.isArray(currentMetadata)
        ? ({ ...currentMetadata } as Record<string, unknown>)
        : {};

    return {
      ...metadata,
      ...patch,
      updatedBy: 'leadflow-api',
    } as Prisma.InputJsonValue;
  }

  private fireKloserHardKill(input: {
    leadContext: {
      teamId: string;
      strategyId: string;
      leadPhone: string | null;
    };
    senderPhone: string | null;
    keyword: string | null;
    externalEventId: string | null;
  }) {
    if (!this.kloserApiClient) {
      return;
    }

    const remoteJid =
      toWhatsappRemoteJid(input.senderPhone) ??
      toWhatsappRemoteJid(input.leadContext.leadPhone);

    if (!remoteJid) {
      this.logger.warn(
        `Skipping Kloser hard kill because remote_jid could not be resolved. externalEventId=${input.externalEventId ?? 'n/a'}`,
      );
      return;
    }

    void this.kloserApiClient.cancelMission(
      input.leadContext.teamId,
      remoteJid,
      input.leadContext.strategyId,
      input.keyword ? `lead_inbound_${input.keyword}` : 'lead_inbound_message',
    );
  }

  private async detectCrmConversationOwnership(input: {
    instanceId: string | null;
    senderPhone: string | null;
    senderWhatsappId: string | null;
    externalEventId: string | null;
  }) {
    if (!this.crmConversationOwnershipService) {
      return;
    }

    try {
      await this.crmConversationOwnershipService.handleWhatsappConversation({
        phoneE164: input.senderPhone,
        whatsappId: input.senderWhatsappId,
        receiverInstanceId: input.instanceId,
        metadata: {
          external_event_id: input.externalEventId,
          detected_by: 'incoming_webhooks_service',
        },
      });
    } catch (error) {
      this.logger.warn(
        `CRM conversation ownership detection skipped: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private async resolveLeadContext(input: {
    leadId: string | null;
    assignmentId: string | null;
    sponsorId: string | null;
    instanceId: string | null;
    senderPhone: string | null;
  }) {
    if (input.leadId) {
      const lead = await this.prisma.lead.findUnique({
        where: {
          id: input.leadId,
        },
        include: {
          currentAssignment: {
            include: {
              funnelInstance: {
                select: {
                  handoffStrategyId: true,
                },
              },
              funnelPublication: {
                select: {
                  handoffStrategyId: true,
                },
              },
            },
          },
        },
      });

      if (lead?.currentAssignment) {
        const assignment = lead.currentAssignment;

        return {
          workspaceId: lead.workspaceId,
          teamId: assignment.teamId,
          sponsorId: assignment.sponsorId,
          leadId: lead.id,
          leadPhone: lead.phone,
          strategyId: this.resolveKloserStrategyId(assignment),
        };
      }
    }

    if (input.assignmentId) {
      const assignment = await this.prisma.assignment.findUnique({
        where: {
          id: input.assignmentId,
        },
        include: {
          lead: true,
          funnelInstance: {
            select: {
              handoffStrategyId: true,
            },
          },
          funnelPublication: {
            select: {
              handoffStrategyId: true,
            },
          },
        },
      });

      if (assignment) {
        return {
          workspaceId: assignment.workspaceId,
          teamId: assignment.teamId,
          sponsorId: assignment.sponsorId,
          leadId: assignment.leadId,
          leadPhone: assignment.lead.phone,
          strategyId: this.resolveKloserStrategyId(assignment),
        };
      }
    }

    const resolvedSponsorId =
      input.sponsorId ??
      (input.instanceId
        ? (
            await this.prisma.messagingConnection.findUnique({
              where: {
                externalInstanceId: input.instanceId,
              },
              select: {
                sponsorId: true,
              },
            })
          )?.sponsorId ??
          null
        : null);

    if (!resolvedSponsorId) {
      return null;
    }

    if (!input.senderPhone) {
      return null;
    }

    const lead = await this.prisma.lead.findFirst({
      where: {
        assignments: {
          some: {
            sponsorId: resolvedSponsorId,
          },
        },
        ...(input.senderPhone
          ? {
              OR: [
                {
                  phone: input.senderPhone,
                },
                {
                  phone: {
                    contains: input.senderPhone.slice(-8),
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        currentAssignment: {
          include: {
            funnelInstance: {
              select: {
                handoffStrategyId: true,
              },
            },
            funnelPublication: {
              select: {
                handoffStrategyId: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!lead?.currentAssignment) {
      return null;
    }

    return {
      workspaceId: lead.workspaceId,
      teamId: lead.currentAssignment.teamId,
      sponsorId: lead.currentAssignment.sponsorId,
      leadId: lead.id,
      leadPhone: lead.phone,
      strategyId: this.resolveKloserStrategyId(lead.currentAssignment),
    };
  }

  private resolveKloserStrategyId(assignment: {
    funnelPublication?: { handoffStrategyId: string | null } | null;
    funnelInstance?: { handoffStrategyId: string | null } | null;
    funnelPublicationId?: string | null;
    funnelInstanceId?: string | null;
    funnelId: string;
  }) {
    return (
      assignment.funnelPublication?.handoffStrategyId ??
      assignment.funnelInstance?.handoffStrategyId ??
      assignment.funnelPublicationId ??
      assignment.funnelInstanceId ??
      assignment.funnelId
    );
  }
}
