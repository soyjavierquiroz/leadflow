import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeMessagingPhone } from '../shared/messaging-channel.utils';
import {
  joinUrlPath,
  normalizeBaseUrl,
  normalizeUrl,
  normalizeUrlPath,
  sanitizeNullableText,
} from '../shared/url.utils';

type OwnershipContextUpsertPayload = {
  schema_version: 'leadflow.ownership_context.v1';
  event: 'OWNERSHIP_CONTEXT_UPSERT';
  idempotency_key: string;
  ownership: {
    ownership_key: string;
    entity: 'assignment';
    visitor_id: string | null;
    lead_id: string;
    assignment_id: string;
    workspace_id: string;
    team_id: string;
    owner_sponsor_id: string;
    owner_public_slug: string | null;
    assigned_at: string;
    status: string;
  };
  routing: {
    provider: 'evolution';
    channel: 'whatsapp';
    instance_name: string | null;
    remote_jid: string | null;
    service_owner_key: 'lead-handler';
  };
  attribution: {
    publication_id: string | null;
    funnel_instance_id: string | null;
    traffic_layer: string | null;
    source_url: string | null;
    ad_wheel_id: string | null;
  };
};

const ownershipContextAssignmentInclude = {
  lead: {
    include: {
      visitor: true,
    },
  },
  sponsor: {
    include: {
      messagingConnection: true,
    },
  },
} satisfies Prisma.AssignmentInclude;

type OwnershipContextAssignmentRecord = Prisma.AssignmentGetPayload<{
  include: typeof ownershipContextAssignmentInclude;
}>;

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_UPSERT_PATH = '/v1/ownership-context/upsert';
const RUNTIME_CONTEXT_SERVICE_KEY = 'leadflow_api' as const;

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const isEnabled = (value: string | undefined) => {
  const normalized = sanitizeNullableText(value)?.toLowerCase();

  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

@Injectable()
export class OwnershipContextUpsertService {
  private readonly logger = new Logger(OwnershipContextUpsertService.name);
  private readonly enabled = isEnabled(
    process.env.RUNTIME_CONTEXT_OWNERSHIP_UPSERT_ENABLED,
  );
  private readonly explicitUrl = normalizeUrl(
    process.env.RUNTIME_CONTEXT_OWNERSHIP_UPSERT_URL,
  );
  private readonly baseUrl = normalizeBaseUrl(
    process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL,
  );
  private readonly upsertPath =
    normalizeUrlPath(process.env.RUNTIME_CONTEXT_OWNERSHIP_UPSERT_PATH) ??
    DEFAULT_UPSERT_PATH;
  private readonly apiKey = sanitizeNullableText(
    process.env.RUNTIME_CONTEXT_CENTRAL_API_KEY ??
      process.env.RUNTIME_CONTEXT_INTERNAL_KEY,
  );
  private readonly timeoutMs = parsePositiveInt(
    process.env.RUNTIME_CONTEXT_REQUEST_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );

  constructor(private readonly prisma: PrismaService) {}

  async upsertForAssignment(input: {
    assignmentId: string;
    sourceUrl?: string | null;
  }): Promise<{ dispatched: boolean; reason?: string }> {
    if (!this.enabled) {
      this.logStructured('OWNERSHIP_CONTEXT_UPSERT_NOOP', {
        reason: 'feature_disabled',
        assignmentId: input.assignmentId,
      });

      return {
        dispatched: false,
        reason: 'feature_disabled',
      };
    }

    const targetUrl = this.resolveTargetUrl();

    if (!targetUrl || !this.apiKey) {
      this.logStructured('OWNERSHIP_CONTEXT_UPSERT_NOOP', {
        reason: targetUrl ? 'api_key_missing' : 'target_url_missing',
        assignmentId: input.assignmentId,
      });

      return {
        dispatched: false,
        reason: targetUrl ? 'api_key_missing' : 'target_url_missing',
      };
    }

    try {
      const assignment = await this.prisma.assignment.findUnique({
        where: {
          id: input.assignmentId,
        },
        include: ownershipContextAssignmentInclude,
      });

      if (!assignment) {
        this.logStructured('OWNERSHIP_CONTEXT_UPSERT_NOOP', {
          reason: 'assignment_not_found',
          assignmentId: input.assignmentId,
        });

        return {
          dispatched: false,
          reason: 'assignment_not_found',
        };
      }

      if (!assignment.ownershipKey) {
        this.logStructured('OWNERSHIP_CONTEXT_UPSERT_NOOP', {
          reason: 'ownership_key_missing',
          assignmentId: input.assignmentId,
        });

        return {
          dispatched: false,
          reason: 'ownership_key_missing',
        };
      }

      const payload = this.buildPayload({
        assignment,
        sourceUrl: input.sourceUrl ?? null,
      });

      await this.request(targetUrl, payload);
      this.logStructured('OWNERSHIP_CONTEXT_UPSERT_DISPATCHED', {
        assignmentId: assignment.id,
        ownershipKey: assignment.ownershipKey,
        teamId: assignment.teamId,
      });

      return {
        dispatched: true,
      };
    } catch (error) {
      this.logStructured('OWNERSHIP_CONTEXT_UPSERT_FAILED', {
        assignmentId: input.assignmentId,
        message:
          error instanceof Error
            ? error.message
            : 'Ownership context upsert failed unexpectedly.',
      });

      return {
        dispatched: false,
        reason: 'request_failed',
      };
    }
  }

  private resolveTargetUrl() {
    if (this.explicitUrl) {
      return this.explicitUrl;
    }

    if (!this.baseUrl) {
      return null;
    }

    return joinUrlPath(this.baseUrl, this.upsertPath);
  }

  private buildPayload(input: {
    assignment: OwnershipContextAssignmentRecord;
    sourceUrl: string | null;
  }): OwnershipContextUpsertPayload {
    const { assignment } = input;
    const normalizedLeadPhone = normalizeMessagingPhone(assignment.lead.phone);
    const remoteJid = normalizedLeadPhone
      ? `${normalizedLeadPhone}@s.whatsapp.net`
      : null;

    return {
      schema_version: 'leadflow.ownership_context.v1',
      event: 'OWNERSHIP_CONTEXT_UPSERT',
      idempotency_key: `leadflow:assignment:${assignment.id}`,
      ownership: {
        ownership_key: assignment.ownershipKey!,
        entity: 'assignment',
        visitor_id: assignment.lead.visitorId,
        lead_id: assignment.leadId,
        assignment_id: assignment.id,
        workspace_id: assignment.workspaceId,
        team_id: assignment.teamId,
        owner_sponsor_id: assignment.sponsorId,
        owner_public_slug:
          sanitizeNullableText(assignment.sponsor.publicSlug) ?? null,
        assigned_at: assignment.assignedAt.toISOString(),
        status: assignment.status,
      },
      routing: {
        provider: 'evolution',
        channel: 'whatsapp',
        instance_name:
          sanitizeNullableText(
            assignment.sponsor.messagingConnection?.externalInstanceId,
          ) ?? null,
        remote_jid: remoteJid,
        service_owner_key: 'lead-handler',
      },
      attribution: {
        publication_id: assignment.funnelPublicationId,
        funnel_instance_id: assignment.funnelInstanceId,
        traffic_layer: assignment.trafficLayer,
        source_url: sanitizeNullableText(input.sourceUrl) ?? null,
        ad_wheel_id: assignment.originAdWheelId,
      },
    };
  }

  private async request(
    targetUrl: string,
    payload: OwnershipContextUpsertPayload,
  ) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-internal-api-key': this.apiKey ?? '',
          'x-service-key': RUNTIME_CONTEXT_SERVICE_KEY,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        return;
      }

      const responseBody = await response.text();
      throw new Error(
        `Runtime Context ownership upsert failed with HTTP ${response.status}: ${responseBody || 'Empty response body'}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private logStructured(event: string, details: Record<string, unknown>) {
    this.logger.log(
      JSON.stringify({
        event,
        source_system: 'leadflow',
        service_owner_key: 'lead-handler',
        ...details,
      }),
    );
  }
}
