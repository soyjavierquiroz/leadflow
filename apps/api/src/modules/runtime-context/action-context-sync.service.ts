import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeMessagingPhone } from '../shared/messaging-channel.utils';
import {
  joinUrlPath,
  normalizeBaseUrl,
  sanitizeNullableText,
} from '../shared/url.utils';

type ActionContextStatus = 'active' | 'inactive';

type ActionContextUpsertPayloadInput = {
  tenantId: string;
  remoteJid: string;
  leadId: string;
  assignmentId: string | null;
  publicationId: string | null;
  status: ActionContextStatus;
  metadata?: Record<string, unknown>;
};

type ActionContextUpsertPayload = {
  tenant_id: string;
  channel: 'whatsapp';
  remote_jid: string;
  provider: 'leadflow';
  lead_id: string;
  assignment_id: string | null;
  publication_id: string | null;
  status: ActionContextStatus;
  metadata: Record<string, unknown>;
};

const actionContextAssignmentInclude = {
  lead: true,
} satisfies Prisma.AssignmentInclude;

type ActionContextAssignmentRecord = Prisma.AssignmentGetPayload<{
  include: typeof actionContextAssignmentInclude;
}>;

const DEFAULT_TIMEOUT_MS = 5_000;
const ACTION_CONTEXT_UPSERT_PATH = '/v1/admin/action-contexts/upsert';
const ACTION_CONTEXT_UPSERT_PATH_WITHOUT_VERSION =
  '/admin/action-contexts/upsert';
const RUNTIME_CONTEXT_SERVICE_KEY = 'leadflow_api' as const;

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

export const buildActionContextUpsertPayload = (
  input: ActionContextUpsertPayloadInput,
): ActionContextUpsertPayload => ({
  tenant_id: input.tenantId,
  channel: 'whatsapp',
  remote_jid: input.remoteJid,
  provider: 'leadflow',
  lead_id: input.leadId,
  assignment_id: input.assignmentId,
  publication_id: input.publicationId,
  status: input.status,
  metadata: input.metadata ?? {},
});

@Injectable()
export class ActionContextSyncService {
  private readonly logger = new Logger(ActionContextSyncService.name);
  private readonly baseUrl =
    normalizeBaseUrl(process.env.RUNTIME_CONTEXT_BASE_URL) ??
    normalizeBaseUrl(process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL);
  private readonly apiKey =
    sanitizeNullableText(process.env.RUNTIME_CONTEXT_INTERNAL_API_KEY) ??
    sanitizeNullableText(process.env.RUNTIME_CONTEXT_CENTRAL_API_KEY) ??
    sanitizeNullableText(process.env.RUNTIME_CONTEXT_INTERNAL_KEY);
  private readonly timeoutMs = parsePositiveInt(
    process.env.RUNTIME_CONTEXT_REQUEST_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );

  constructor(private readonly prisma: PrismaService) {}

  async upsertForAssignment(input: {
    assignmentId: string;
    source?: string | null;
  }): Promise<{ dispatched: boolean; reason?: string }> {
    if (!this.baseUrl || !this.apiKey) {
      this.logStructured('ACTION_CONTEXT_SYNC_NOOP', {
        reason: this.baseUrl ? 'api_key_missing' : 'base_url_missing',
        assignmentId: input.assignmentId,
      });

      return {
        dispatched: false,
        reason: this.baseUrl ? 'api_key_missing' : 'base_url_missing',
      };
    }

    try {
      const assignment = await this.prisma.assignment.findUnique({
        where: {
          id: input.assignmentId,
        },
        include: actionContextAssignmentInclude,
      });

      if (!assignment) {
        this.logStructured('ACTION_CONTEXT_SYNC_NOOP', {
          reason: 'assignment_not_found',
          assignmentId: input.assignmentId,
        });

        return {
          dispatched: false,
          reason: 'assignment_not_found',
        };
      }

      const payload = this.buildPayload({
        assignment,
        source: input.source ?? null,
      });

      if (!payload) {
        return {
          dispatched: false,
          reason: 'remote_jid_missing',
        };
      }

      await this.request(payload);
      this.logStructured('ACTION_CONTEXT_SYNC_DISPATCHED', {
        tenantId: payload.tenant_id,
        leadId: payload.lead_id,
        assignmentId: payload.assignment_id,
        publicationId: payload.publication_id,
      });

      return {
        dispatched: true,
      };
    } catch (error) {
      this.logger.warn(
        `Runtime Context action_context sync failed for assignment ${input.assignmentId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );

      return {
        dispatched: false,
        reason: 'request_failed',
      };
    }
  }

  private buildPayload(input: {
    assignment: ActionContextAssignmentRecord;
    source: string | null;
  }): ActionContextUpsertPayload | null {
    const normalizedLeadPhone = normalizeMessagingPhone(
      input.assignment.lead.phone,
    );
    const remoteJid = normalizedLeadPhone
      ? `${normalizedLeadPhone}@s.whatsapp.net`
      : null;

    if (!remoteJid) {
      this.logStructured('ACTION_CONTEXT_SYNC_NOOP', {
        reason: 'remote_jid_missing',
        assignmentId: input.assignment.id,
        leadId: input.assignment.leadId,
      });

      return null;
    }

    return buildActionContextUpsertPayload({
      tenantId: input.assignment.teamId,
      remoteJid,
      leadId: input.assignment.leadId,
      assignmentId: input.assignment.id,
      publicationId: input.assignment.funnelPublicationId,
      status: 'active',
      metadata: {
        workspace_id: input.assignment.workspaceId,
        team_id: input.assignment.teamId,
        funnel_id: input.assignment.funnelId,
        funnel_instance_id: input.assignment.funnelInstanceId,
        funnel_publication_id: input.assignment.funnelPublicationId,
        lead_status: input.assignment.lead.status,
        assignment_status: input.assignment.status,
        assignment_reason: input.assignment.reason,
        traffic_layer:
          input.assignment.trafficLayer ??
          input.assignment.lead.trafficLayer ??
          null,
        origin_ad_wheel_id:
          input.assignment.originAdWheelId ??
          input.assignment.lead.originAdWheelId ??
          null,
        synced_by: RUNTIME_CONTEXT_SERVICE_KEY,
        synced_at: new Date().toISOString(),
        sync_source: input.source ?? 'leadflow_assignment',
      },
    });
  }

  private resolveTargetUrl() {
    const baseUrl = this.baseUrl!;
    const pathname = new URL(baseUrl).pathname.replace(/\/+$/, '');

    return joinUrlPath(
      baseUrl,
      pathname.endsWith('/v1')
        ? ACTION_CONTEXT_UPSERT_PATH_WITHOUT_VERSION
        : ACTION_CONTEXT_UPSERT_PATH,
    );
  }

  private async request(payload: ActionContextUpsertPayload) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.resolveTargetUrl(), {
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
        `Runtime Context action_context upsert failed with HTTP ${response.status}${
          responseBody ? ' (non-empty response body)' : ''
        }`,
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
