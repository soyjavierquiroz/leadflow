import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { MessagingConnectionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  normalizeMessagingPhone,
  resolveMessagingConnectionStatus,
} from '../messaging-integrations/messaging-integrations.utils';
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
    return JSON.stringify(value);
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

@Injectable()
export class IncomingWebhooksService {
  private readonly logger = new Logger(IncomingWebhooksService.name);
  private readonly incomingWebhookSecret =
    process.env.INCOMING_MESSAGING_WEBHOOK_SECRET?.trim() || null;

  constructor(private readonly prisma: PrismaService) {}

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
    const senderPhone = normalizeMessagingPhone(extractInboundMessagePhone(payload));

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
        `Rejecting inbound messaging webhook because the provided secret is invalid. headersSecret=${stringifyForLogs(
          readIncomingWebhookSecret(headers),
        )} querySecret=${querySecret ?? null}`,
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
          currentAssignment: true,
        },
      });

      if (lead?.currentAssignment) {
        return {
          workspaceId: lead.workspaceId,
          teamId: lead.currentAssignment.teamId,
          sponsorId: lead.currentAssignment.sponsorId,
          leadId: lead.id,
          leadPhone: lead.phone,
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
        },
      });

      if (assignment) {
        return {
          workspaceId: assignment.workspaceId,
          teamId: assignment.teamId,
          sponsorId: assignment.sponsorId,
          leadId: assignment.leadId,
          leadPhone: assignment.lead.phone,
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
        currentAssignment: true,
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
    };
  }
}
