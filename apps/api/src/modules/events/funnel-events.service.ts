import { randomUUID } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type JsonObject = Record<string, unknown>;

export type RecordFunnelEventInput = {
  eventId?: string;
  eventName: string;
  eventVersion?: string;
  eventFamily: string;
  source: string;
  workspaceId: string;
  teamId: string;
  domainId?: string | null;
  funnelPublicationId?: string | null;
  funnelInstanceId?: string | null;
  funnelStepId?: string | null;
  leadId?: string | null;
  visitorId?: string | null;
  assignmentId?: string | null;
  trackedLinkId?: string | null;
  actionLinkKey?: string | null;
  trafficLayer: string;
  attributionJson?: JsonObject | null;
  payloadJson?: JsonObject | null;
  occurredAt?: Date;
  receivedAt?: Date;
  correlationId?: string | null;
  dedupeKey?: string | null;
};

export type FunnelEventRecord = {
  id: string;
  eventId: string;
  eventName: string;
  eventVersion: string;
  eventFamily: string;
  source: string;
  workspaceId: string;
  teamId: string;
  domainId: string | null;
  funnelPublicationId: string | null;
  funnelInstanceId: string | null;
  funnelStepId: string | null;
  leadId: string | null;
  visitorId: string | null;
  assignmentId: string | null;
  trackedLinkId: string | null;
  actionLinkKey: string | null;
  trafficLayer: string;
  attributionJson: Prisma.JsonValue | null;
  payloadJson: Prisma.JsonValue;
  occurredAt: Date;
  receivedAt: Date;
  correlationId: string | null;
  dedupeKey: string | null;
  createdAt: Date;
};

export type RecordedFunnelEvent = {
  event: FunnelEventRecord;
  deduped: boolean;
};

@Injectable()
export class FunnelEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordEvent(
    input: RecordFunnelEventInput,
  ): Promise<RecordedFunnelEvent> {
    this.assertValidInput(input);

    const dedupeKey = this.normalizeOptionalString(input.dedupeKey);
    if (dedupeKey) {
      const existing = await this.findByDedupeKey(dedupeKey);
      if (existing) {
        return {
          event: existing,
          deduped: true,
        };
      }
    }

    const eventId =
      this.normalizeOptionalString(input.eventId) ?? `evt_${randomUUID()}`;
    const now = new Date();
    const attributionJson = input.attributionJson ?? null;

    try {
      const event = await this.prisma.funnelEvent.create({
        data: {
          eventId,
          eventName: input.eventName.trim(),
          eventVersion:
            this.normalizeOptionalString(input.eventVersion) ?? '1.0',
          eventFamily: input.eventFamily.trim(),
          source: input.source.trim(),
          workspaceId: input.workspaceId,
          teamId: input.teamId,
          domainId: input.domainId ?? null,
          funnelPublicationId: input.funnelPublicationId ?? null,
          funnelInstanceId: input.funnelInstanceId ?? null,
          funnelStepId: input.funnelStepId ?? null,
          leadId: input.leadId ?? null,
          visitorId: input.visitorId ?? null,
          assignmentId: input.assignmentId ?? null,
          trackedLinkId: input.trackedLinkId ?? null,
          actionLinkKey: input.actionLinkKey ?? null,
          trafficLayer: input.trafficLayer.trim(),
          ...(attributionJson
            ? {
                attributionJson: attributionJson as Prisma.InputJsonValue,
              }
            : {}),
          payloadJson: (input.payloadJson ?? {}) as Prisma.InputJsonValue,
          occurredAt: input.occurredAt ?? now,
          receivedAt: input.receivedAt ?? now,
          correlationId: input.correlationId ?? null,
          dedupeKey,
        },
      });

      return {
        event,
        deduped: false,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        if (dedupeKey) {
          const existing = await this.findByDedupeKey(dedupeKey);
          if (existing) {
            return {
              event: existing,
              deduped: true,
            };
          }
        }

        const existing = await this.findByEventId(eventId);
        if (existing) {
          return {
            event: existing,
            deduped: false,
          };
        }
      }

      throw error;
    }
  }

  private async findByDedupeKey(
    dedupeKey: string,
  ): Promise<FunnelEventRecord | null> {
    return this.prisma.funnelEvent.findUnique({
      where: {
        dedupeKey,
      },
    });
  }

  private async findByEventId(
    eventId: string,
  ): Promise<FunnelEventRecord | null> {
    return this.prisma.funnelEvent.findUnique({
      where: {
        eventId,
      },
    });
  }

  private assertValidInput(input: RecordFunnelEventInput) {
    this.assertRequiredString(input.eventName, 'eventName');
    this.assertRequiredString(input.eventFamily, 'eventFamily');
    this.assertRequiredString(input.source, 'source');
    this.assertRequiredString(input.workspaceId, 'workspaceId');
    this.assertRequiredString(input.teamId, 'teamId');
    this.assertRequiredString(input.trafficLayer, 'trafficLayer');

    if (
      input.payloadJson !== undefined &&
      !this.isSerializableJsonObject(input.payloadJson)
    ) {
      throw new BadRequestException({
        code: 'INVALID_FUNNEL_EVENT_PAYLOAD',
        message: 'payloadJson must be a JSON-serializable object.',
      });
    }

    if (
      input.attributionJson !== undefined &&
      input.attributionJson !== null &&
      !this.isSerializableJsonObject(input.attributionJson)
    ) {
      throw new BadRequestException({
        code: 'INVALID_FUNNEL_EVENT_ATTRIBUTION',
        message: 'attributionJson must be a JSON-serializable object.',
      });
    }
  }

  private assertRequiredString(value: string | undefined, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException({
        code: 'FUNNEL_EVENT_VALIDATION_ERROR',
        message: `${field} is required.`,
      });
    }
  }

  private normalizeOptionalString(value: string | null | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private isSerializableJsonObject(value: unknown): value is JsonObject {
    if (!this.isPlainJsonObject(value)) {
      return false;
    }

    try {
      return this.isJsonValue(value);
    } catch {
      return false;
    }
  }

  private isJsonValue(value: unknown): boolean {
    if (value === null) {
      return true;
    }

    if (typeof value === 'string' || typeof value === 'boolean') {
      return true;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value);
    }

    if (Array.isArray(value)) {
      return value.every((item) => this.isJsonValue(item));
    }

    if (this.isPlainJsonObject(value)) {
      return Object.values(value).every((item) => this.isJsonValue(item));
    }

    return false;
  }

  private isPlainJsonObject(value: unknown): value is JsonObject {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }
}
