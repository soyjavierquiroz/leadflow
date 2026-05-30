import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { CrmOutreachStatus, Prisma } from '@prisma/client';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { redactSensitiveData } from '../shared/redact-sensitive-data';
import type {
  CrmExternalCancelResult,
  CrmExternalDeliveryStatus,
  CrmExternalDispatcherPort,
  CrmExternalHandoffResult,
  CrmExternalOutreachHandoffPayload,
} from './crm-external-dispatcher.port';

const DEFAULT_TIMEOUT_MS = 3_000;
const CALLBACK_MAX_SKEW_MS = 5 * 60 * 1000;
const KLOSER_SOURCE = 'leadflow';

export type KloserMissionCallbackPayload = {
  mission_id?: string;
  status?: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  dispatch_id?: string;
  reason?: string;
};

type KloserMissionBody = {
  tenant_id: string;
  lead_id: string;
  remote_jid: string;
  strategy_id: string;
  strategy_version: number;
  due_at: string;
  metadata: {
    source: 'leadflow_crm';
    workspace_id: string;
    team_id: string;
    sponsor_id: string;
    assignment_id: string;
    outreach_id: string;
    mlm_safe: true;
    conversation_owner_locked: true;
  };
};

@Injectable()
export class CrmKloserMissionService implements CrmExternalDispatcherPort {
  private readonly logger = new Logger(CrmKloserMissionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handoffOutreach(
    payload: CrmExternalOutreachHandoffPayload,
  ): Promise<CrmExternalHandoffResult> {
    const config = readKloserMissionConfig();
    const missionPayload = this.buildMissionPayload(payload);

    if (!missionPayload) {
      this.logger.warn(
        JSON.stringify({
          event: 'kloser_mission_blocked_invalid_phone',
          outreach_id: payload.outreach_id,
          lead_id: payload.lead.id,
          sponsor_id: payload.sponsor_id,
          team_id: payload.team_id,
        }),
      );

      return {
        accepted: false,
        reason: 'invalid_phone',
      };
    }

    if (!config.enabled) {
      return {
        accepted: true,
        external_id: null,
        reason: 'kloser_disabled_noop',
      };
    }

    if (config.dryRun) {
      return {
        accepted: true,
        external_id: `dry-run-${payload.outreach_id}-${randomUUID()}`,
        reason: 'kloser_dry_run',
      };
    }

    if (!config.apiUrl || !config.hmacSecret) {
      this.logger.warn(
        JSON.stringify({
          event: 'kloser_mission_config_missing',
          outreach_id: payload.outreach_id,
          has_api_url: Boolean(config.apiUrl),
          has_hmac_secret: Boolean(config.hmacSecret),
        }),
      );

      return {
        accepted: false,
        reason: 'kloser_config_missing',
      };
    }

    const rawBody = JSON.stringify(missionPayload);
    const headers = signKloserRequest(rawBody, config.hmacSecret);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(`${config.apiUrl}/missions`, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body: rawBody,
      });
      const responseBody = await readResponseBody(response);

      if (response.status !== 201) {
        this.logger.warn(
          JSON.stringify(
            redactSensitiveData({
              event: 'kloser_mission_rejected',
              outreach_id: payload.outreach_id,
              lead_id: payload.lead.id,
              team_id: payload.team_id,
              status: response.status,
              reason: readResponseReason(responseBody) ?? 'kloser_rejected',
            }),
          ),
        );

        return {
          accepted: false,
          reason: `kloser_http_${response.status}`,
        };
      }

      const missionId = readMissionId(responseBody);

      this.logger.log(
        JSON.stringify({
          event: 'kloser_mission_created',
          outreach_id: payload.outreach_id,
          lead_id: payload.lead.id,
          team_id: payload.team_id,
          mission_id: missionId,
        }),
      );

      return {
        accepted: true,
        external_id: missionId,
        reason: 'kloser_created',
      };
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'kloser_mission_delivery_failed',
          outreach_id: payload.outreach_id,
          lead_id: payload.lead.id,
          team_id: payload.team_id,
          error_name: error instanceof Error ? error.name : 'UnknownError',
        }),
      );

      return {
        accepted: false,
        reason:
          error instanceof Error && error.name === 'AbortError'
            ? 'kloser_timeout'
            : 'kloser_unavailable',
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async cancelOutreach(_input: {
    outreach_id: string;
    workspace_id: string;
    reason?: string | null;
  }): Promise<CrmExternalCancelResult> {
    return {
      accepted: true,
      reason: 'kloser_cancel_noop',
    };
  }

  async getDeliveryStatus(_input: {
    outreach_id: string;
    workspace_id: string;
  }): Promise<{
    status: CrmExternalDeliveryStatus;
    external_id?: string | null;
    reason?: string | null;
  }> {
    return {
      status: 'unknown',
      external_id: null,
      reason: 'kloser_observational_callback_only',
    };
  }

  buildMissionPayload(
    payload: CrmExternalOutreachHandoffPayload,
  ): KloserMissionBody | null {
    const remoteJid = buildWhatsappRemoteJid(payload.lead.phone_e164);

    if (!remoteJid) {
      return null;
    }

    return {
      tenant_id: payload.workspace_id,
      lead_id: payload.lead.id,
      remote_jid: remoteJid,
      strategy_id: readKloserMissionConfig().initialContactStrategy,
      strategy_version: 1,
      due_at: payload.dispatch.scheduled_for ?? new Date().toISOString(),
      metadata: {
        source: 'leadflow_crm',
        workspace_id: payload.workspace_id,
        team_id: payload.team_id,
        sponsor_id: payload.sponsor_id,
        assignment_id: payload.assignment_id,
        outreach_id: payload.outreach_id,
        mlm_safe: true,
        conversation_owner_locked: true,
      },
    };
  }

  async verifyCallbackSignature(input: {
    headers: Record<string, string | string[] | undefined>;
    rawBody: string;
  }) {
    const config = readKloserMissionConfig();

    if (!config.hmacSecret) {
      throw new ServiceUnavailableException({
        code: 'KLOSER_HMAC_SECRET_REQUIRED',
        message: 'Kloser callback signing is not configured.',
      });
    }

    const signature = readHeader(input.headers, 'x-kurukin-signature');
    const timestamp = readHeader(input.headers, 'x-kurukin-timestamp');
    const source = readHeader(input.headers, 'x-kurukin-source');

    if (!signature || !timestamp || source !== KLOSER_SOURCE) {
      throw new UnauthorizedException({
        code: 'KLOSER_CALLBACK_SIGNATURE_INVALID',
        message: 'The Kloser callback signature is invalid.',
      });
    }

    const timestampMs = Number(timestamp) * 1000;

    if (
      !Number.isFinite(timestampMs) ||
      Math.abs(Date.now() - timestampMs) > CALLBACK_MAX_SKEW_MS
    ) {
      throw new UnauthorizedException({
        code: 'KLOSER_CALLBACK_TIMESTAMP_INVALID',
        message: 'The Kloser callback timestamp is outside the allowed window.',
      });
    }

    const expected = createKloserSignature(
      `${timestamp}.${input.rawBody}`,
      config.hmacSecret,
    );

    if (!safeEqual(signature, expected)) {
      throw new UnauthorizedException({
        code: 'KLOSER_CALLBACK_SIGNATURE_INVALID',
        message: 'The Kloser callback signature is invalid.',
      });
    }
  }

  async handleMissionCallback(
    payload: KloserMissionCallbackPayload,
    now = new Date(),
  ) {
    const missionId = normalizeString(payload.mission_id);
    const status = payload.status;

    if (!missionId || !status) {
      await this.recordCallbackFailure(null, 'invalid_callback_payload', now);
      throw new UnauthorizedException({
        code: 'KLOSER_CALLBACK_PAYLOAD_INVALID',
        message: 'The Kloser callback payload is invalid.',
      });
    }

    const row = await this.prisma.crmOutreachQueue.findFirst({
      where: {
        externalMissionId: missionId,
      },
      select: {
        id: true,
        payloadJson: true,
      },
    });

    if (!row) {
      await this.recordCallbackFailure(missionId, 'mission_not_found', now);
      return {
        accepted: false,
        reason: 'mission_not_found',
      };
    }

    const mappedStatus = mapKloserStatus(status);
    await this.prisma.crmOutreachQueue.update({
      where: {
        id: row.id,
      },
      data: {
        status: mappedStatus,
        externalHandoffStatus: mappedStatus,
        lastHandoffError:
          status === 'failed'
            ? toInputJsonValue({
                reason: normalizeString(payload.reason) ?? 'kloser_failed',
                source: 'kloser_callback',
                checked_at: now.toISOString(),
              })
            : Prisma.JsonNull,
        payloadJson: toInputJsonValue({
          ...readPayload(row.payloadJson),
          kloser_callback: {
            mission_id: missionId,
            status,
            dispatch_id: normalizeString(payload.dispatch_id),
            reason: normalizeString(payload.reason),
            received_at: now.toISOString(),
          },
        }),
      },
    });

    this.logger.log(
      JSON.stringify({
        event: 'kloser_mission_callback_received',
        mission_id: missionId,
        status,
        mapped_status: mappedStatus,
      }),
    );

    return {
      accepted: true,
      status: mappedStatus,
    };
  }

  async getHealth(scope: { workspaceId: string; teamId: string }) {
    const config = readKloserMissionConfig();
    const baseWhere = {
      workspaceId: scope.workspaceId,
      teamId: scope.teamId,
    };
    const [
      pendingHandoffs,
      failedHandoffs,
      lastSuccess,
      lastFailure,
      apiReachable,
    ] = await Promise.all([
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          status: {
            in: [
              CrmOutreachStatus.queued,
              CrmOutreachStatus.ready,
              CrmOutreachStatus.processing,
            ],
          },
        },
      }),
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          OR: [
            { status: CrmOutreachStatus.failed },
            { externalHandoffStatus: CrmOutreachStatus.failed },
          ],
        },
      }),
      this.prisma.crmOutreachQueue.findFirst({
        where: {
          ...baseWhere,
          lastHandoffAt: {
            not: null,
          },
        },
        orderBy: {
          lastHandoffAt: 'desc',
        },
        select: {
          lastHandoffAt: true,
        },
      }),
      this.prisma.crmOutreachQueue.findFirst({
        where: {
          ...baseWhere,
          lastHandoffError: {
            not: Prisma.JsonNull,
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        select: {
          updatedAt: true,
        },
      }),
      this.probeApiReachable(config),
    ]);

    return {
      enabled: config.enabled,
      dry_run: config.dryRun,
      api_reachable: apiReachable,
      pending_handoffs: pendingHandoffs,
      failed_handoffs: failedHandoffs,
      last_success_at: lastSuccess?.lastHandoffAt?.toISOString() ?? null,
      last_failure_at: lastFailure?.updatedAt.toISOString() ?? null,
    };
  }

  async getMetrics(scope: { workspaceId: string; teamId: string }) {
    const baseWhere = {
      workspaceId: scope.workspaceId,
      teamId: scope.teamId,
    };
    const [
      handoffAttempts,
      handoffSuccess,
      handoffFailures,
      callbackReceived,
      callbackFailures,
      dryRunHandoffs,
      blockedOutreach,
      retryDepth,
    ] = await Promise.all([
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          lastAttemptAt: {
            not: null,
          },
        },
      }),
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          status: {
            in: [
              CrmOutreachStatus.handed_off,
              CrmOutreachStatus.processing,
              CrmOutreachStatus.dispatched,
              CrmOutreachStatus.completed,
            ],
          },
          lastHandoffAt: {
            not: null,
          },
        },
      }),
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          OR: [
            { status: CrmOutreachStatus.failed },
            { lastHandoffError: { not: Prisma.JsonNull } },
          ],
        },
      }),
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          payloadJson: {
            path: ['kloser_callback', 'received_at'],
            not: Prisma.JsonNull,
          },
        },
      }),
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          lastHandoffError: {
            path: ['source'],
            equals: 'kloser_callback',
          },
        },
      }),
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          externalHandoffStatus: 'dry_run',
        },
      }),
      this.prisma.crmOutreachQueue.count({
        where: {
          ...baseWhere,
          status: CrmOutreachStatus.blocked,
        },
      }),
      this.prisma.crmOutreachQueue.aggregate({
        where: baseWhere,
        _max: {
          retryCount: true,
        },
        _avg: {
          retryCount: true,
        },
      }),
    ]);

    return {
      handoff_attempts: handoffAttempts,
      handoff_success: handoffSuccess,
      handoff_failures: handoffFailures,
      callback_received: callbackReceived,
      callback_failures: callbackFailures,
      dry_run_handoffs: dryRunHandoffs,
      retry_depth: {
        max: retryDepth._max.retryCount ?? 0,
        avg: retryDepth._avg.retryCount ?? 0,
      },
      blocked_outreach: blockedOutreach,
    };
  }

  private async probeApiReachable(config = readKloserMissionConfig()) {
    if (!config.enabled) {
      return false;
    }

    if (config.dryRun) {
      return true;
    }

    if (!config.apiUrl) {
      return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

    try {
      const response = await fetch(`${config.apiUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async recordCallbackFailure(
    missionId: string | null,
    reason: string,
    now: Date,
  ) {
    this.logger.warn(
      JSON.stringify({
        event: 'kloser_mission_callback_failed',
        mission_id: missionId,
        reason,
        checked_at: now.toISOString(),
      }),
    );
  }
}

export const buildWhatsappRemoteJid = (phoneE164: string | null) => {
  const digits = phoneE164?.replace(/\D/g, '') ?? '';

  if (!/^[1-9]\d{7,14}$/.test(digits)) {
    return null;
  }

  return `${digits}@s.whatsapp.net`;
};

export const signKloserRequest = (
  rawBody: string,
  secret: string,
): Record<string, string> => {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  return {
    'Content-Type': 'application/json',
    'X-Kurukin-Signature': createKloserSignature(
      `${timestamp}.${rawBody}`,
      secret,
    ),
    'X-Kurukin-Timestamp': timestamp,
    'X-Kurukin-Source': KLOSER_SOURCE,
  };
};

const createKloserSignature = (value: string, secret: string) =>
  createHmac('sha256', secret).update(value).digest('hex');

const safeEqual = (provided: string, expected: string) => {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
};

const readKloserMissionConfig = () => ({
  apiUrl: normalizeBaseUrl(process.env.KLOSER_API_URL),
  timeoutMs: parsePositiveInt(
    process.env.KLOSER_API_TIMEOUT_MS ??
      process.env.KLOSER_REQUEST_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  ),
  hmacSecret: normalizeString(process.env.KLOSER_HMAC_SECRET),
  enabled: parseBoolean(process.env.KLOSER_MISSION_ENABLED, false),
  dryRun: parseBoolean(process.env.KLOSER_MISSION_DRY_RUN, true),
  initialContactStrategy:
    normalizeString(process.env.KLOSER_STRATEGY_INITIAL_CONTACT) ??
    'initial_contact_v1',
});

const normalizeBaseUrl = (value: string | undefined) => {
  const normalized = normalizeString(value);

  return normalized?.replace(/\/+$/, '') ?? null;
};

const normalizeString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  return value.trim().toLowerCase() === 'true';
};

const readResponseBody = async (response: Response) => {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const readMissionId = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  return (
    normalizeString(record.mission_id) ??
    normalizeString(record.id) ??
    normalizeString(record.external_mission_id)
  );
};

const readResponseReason = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return typeof value === 'string' ? value.slice(0, 120) : null;
  }

  const record = value as Record<string, unknown>;

  return normalizeString(record.reason) ?? normalizeString(record.message);
};

const readHeader = (
  headers: Record<string, string | string[] | undefined>,
  name: string,
) => {
  const value = headers[name] ?? headers[name.toLowerCase()];

  return Array.isArray(value) ? value[0] : value;
};

const readPayload = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
};

const mapKloserStatus = (
  status: NonNullable<KloserMissionCallbackPayload['status']>,
) => {
  switch (status) {
    case 'queued':
      return CrmOutreachStatus.handed_off;
    case 'running':
      return CrmOutreachStatus.processing;
    case 'completed':
      return CrmOutreachStatus.dispatched;
    case 'failed':
      return CrmOutreachStatus.failed;
    case 'cancelled':
      return CrmOutreachStatus.cancelled;
  }
};

const toInputJsonValue = (value: unknown): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;
