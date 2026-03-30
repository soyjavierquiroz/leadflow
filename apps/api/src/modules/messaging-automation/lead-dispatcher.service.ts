import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeMessagingPhone } from '../messaging-integrations/messaging-integrations.utils';
import type { LeadContextUpsertPayload } from './lead-dispatcher.types';

const DISPATCH_RETRY_DELAYS_MS = [0, 2_000, 5_000] as const;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const DISPATCH_TIMEOUT_MS = 5_000;
const LEAD_DISPATCHER_SOURCE_VERSION = '1.0.0' as const;

const assignmentLeadContextInclude = {
  lead: true,
  sponsor: {
    include: {
      messagingConnection: true,
    },
  },
  funnelInstance: true,
  funnelPublication: true,
} satisfies Prisma.AssignmentInclude;

type AssignmentLeadContextRecord = Prisma.AssignmentGetPayload<{
  include: typeof assignmentLeadContextInclude;
}>;

const delay = async (ms: number) =>
  await new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeNullableText = (value: string | null | undefined) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeDispatcherUrl = (value: string | null | undefined) => {
  const sanitized = sanitizeNullableText(value);

  if (!sanitized) {
    return null;
  }

  try {
    return new URL(sanitized).toString();
  } catch {
    return null;
  }
};

const toVerticalHint = (assignment: AssignmentLeadContextRecord) =>
  sanitizeNullableText(
    assignment.funnelPublication?.pathPrefix?.replace(/^\/+/, '') ??
      assignment.funnelInstance?.code ??
      null,
  ) ?? '';

type DispatchResponse = {
  status: number;
  data: unknown;
};

@Injectable()
export class LeadDispatcherService {
  private readonly logger = new Logger(LeadDispatcherService.name);
  private readonly dispatcherWebhookUrl = normalizeDispatcherUrl(
    process.env.N8N_DISPATCHER_WEBHOOK_URL,
  );
  private readonly dispatcherApiKey = sanitizeNullableText(
    process.env.N8N_DISPATCHER_API_KEY,
  );

  constructor(private readonly prisma: PrismaService) {
    this.logger.log(`Dispatcher URL: ${this.dispatcherWebhookUrl}`);
  }

  hasConfiguredDispatcher() {
    return Boolean(this.dispatcherWebhookUrl);
  }

  async dispatchLeadContextUpsert(input: { assignmentId: string }) {
    if (!this.dispatcherWebhookUrl) {
      return null;
    }

    const assignment = await this.prisma.assignment.findUnique({
      where: {
        id: input.assignmentId,
      },
      include: assignmentLeadContextInclude,
    });

    if (!assignment) {
      return null;
    }

    const eventId = randomUUID();
    const payload = this.buildPayload(assignment, eventId);

    return await this.postWithRetry(payload);
  }

  private buildPayload(
    assignment: AssignmentLeadContextRecord,
    eventId: string,
  ): LeadContextUpsertPayload {
    const occurredAt = new Date().toISOString();
    const normalizedLeadPhone = normalizeMessagingPhone(assignment.lead.phone);

    return {
      event: 'LEAD_CONTEXT_UPSERT',
      event_id: eventId,
      occurred_at: occurredAt,
      source: {
        app: 'leadflow',
        type: 'external_app',
        version: LEAD_DISPATCHER_SOURCE_VERSION,
      },
      routing: {
        provider: 'evolution',
        channel: 'whatsapp',
        instance_name:
          assignment.sponsor.messagingConnection?.externalInstanceId ?? '',
        number_id: '',
        remote_jid: normalizedLeadPhone
          ? `${normalizedLeadPhone}@s.whatsapp.net`
          : '',
        service_hint: 'lead-handler',
      },
      lead: {
        external_id: assignment.lead.id,
        name: assignment.lead.fullName ?? '',
        phone_e164: normalizedLeadPhone ?? '',
        email: assignment.lead.email ?? '',
      },
      assignment: {
        owner_external_id: assignment.sponsor.id,
        owner_name: assignment.sponsor.displayName,
        owner_role: 'sponsor',
        assignment_id: assignment.id,
      },
      context: {
        lead_stage: 'new',
        lead_source: 'leadflow_wheel',
        vertical_hint: toVerticalHint(assignment),
        campaign: {},
        signals: {
          detected_signal: 'lead_assigned',
          detected_objection: '',
        },
        memory: {
          summary: 'Lead asignado vía Leadflow Wheel',
          last_objection: '',
          next_action: 'Esperando primer mensaje del lead',
        },
        custom_fields: {},
        notes: '',
      },
    };
  }

  private async postWithRetry(payload: LeadContextUpsertPayload) {
    let lastError: Error | null = null;

    for (const [attempt, backoffMs] of DISPATCH_RETRY_DELAYS_MS.entries()) {
      if (backoffMs > 0) {
        await delay(backoffMs);
      }

      try {
        const response = await this.dispatchOnce(payload);

        if (
          RETRYABLE_STATUS_CODES.has(response.status) &&
          attempt < DISPATCH_RETRY_DELAYS_MS.length - 1
        ) {
          lastError = new Error(
            `Dispatcher retryable response: HTTP ${response.status}`,
          );
          continue;
        }

        if (response.status < 200 || response.status >= 300) {
          throw new Error(`Dispatcher rejected payload with HTTP ${response.status}`);
        }

        return response;
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error('Lead dispatcher failed unexpectedly.');

        if (attempt >= DISPATCH_RETRY_DELAYS_MS.length - 1) {
          break;
        }
      }
    }

    throw (
      lastError ?? new Error('Lead dispatcher failed without a reported error.')
    );
  }

  private async dispatchOnce(payload: LeadContextUpsertPayload) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);

    try {
      this.logger.log('Sending payload to n8n...');
      const response = await fetch(this.dispatcherWebhookUrl!, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(this.dispatcherApiKey
            ? {
                'x-dispatcher-api-key': this.dispatcherApiKey,
              }
            : {}),
        },
        body: JSON.stringify(payload),
      });

      const raw = await response.text();
      let data: unknown = null;

      if (raw) {
        try {
          data = JSON.parse(raw) as unknown;
        } catch {
          data = raw;
        }
      }

      return {
        status: response.status,
        data,
      } satisfies DispatchResponse;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
