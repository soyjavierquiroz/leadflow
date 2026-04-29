import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  normalizeBaseUrl,
  sanitizeNullableText,
} from '../shared/url.utils';

const DEFAULT_TIMEOUT_MS = 5_000;
const RUNTIME_CONTEXT_CONFIG_SYNC_PATH = '/v1/config/sync';
const RUNTIME_CONTEXT_SERVICE_KEY = 'leadflow_api' as const;
const FUNNEL_HANDLER_MEMBER_PREFIX = 'lead-handler' as const;

type JsonRecord = Record<string, Prisma.JsonValue>;

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const isJsonRecord = (
  value: Prisma.JsonValue | null | undefined,
): value is JsonRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const cloneJsonValue = (value: Prisma.JsonValue): Prisma.JsonValue => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item as Prisma.JsonValue));
  }

  if (isJsonRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        cloneJsonValue(nestedValue),
      ]),
    ) as JsonRecord;
  }

  return value;
};

const toJsonRecord = (value: Prisma.JsonValue | null | undefined): JsonRecord =>
  isJsonRecord(value) ? (cloneJsonValue(value) as JsonRecord) : {};

@Injectable()
export class RuntimeContextConfigSyncService {
  private readonly logger = new Logger(RuntimeContextConfigSyncService.name);
  private readonly baseUrl = normalizeBaseUrl(
    process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL,
  );
  private readonly apiKey = sanitizeNullableText(
    process.env.RUNTIME_CONTEXT_CENTRAL_API_KEY ??
      process.env.RUNTIME_CONTEXT_INTERNAL_KEY,
  );
  private readonly timeoutMs = parsePositiveInt(
    process.env.RUNTIME_CONTEXT_REQUEST_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );

  constructor(private readonly prisma: PrismaService) {}

  async syncFunnelContextForInstance(input: {
    tenantId: string;
    funnelInstanceId: string;
  }): Promise<void> {
    try {
      if (!this.isConfigured()) {
        this.logger.warn(
          `Skipping runtime context sync for funnel ${input.funnelInstanceId}: runtime context is not configured.`,
        );
        return;
      }

      const [funnelInstance, tenantConfig] = await Promise.all([
        this.prisma.funnelInstance.findFirst({
          where: {
            id: input.funnelInstanceId,
            teamId: input.tenantId,
          },
          include: {
            publications: {
              where: {
                teamId: input.tenantId,
                status: 'active',
                isActive: true,
              },
              include: {
                domain: {
                  select: {
                    host: true,
                    normalizedHost: true,
                  },
                },
              },
              orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
            },
          },
        }),
        this.prisma.aiAgentConfig.findFirst({
          where: {
            tenantId: input.tenantId,
            memberId: null,
            isActive: true,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        }),
      ]);

      if (!funnelInstance) {
        this.logger.warn(
          `Skipping runtime context sync: funnel instance ${input.funnelInstanceId} was not found for tenant ${input.tenantId}.`,
        );
        return;
      }

      if (funnelInstance.publications.length === 0) {
        this.logger.debug(
          `Skipping runtime context sync for funnel ${input.funnelInstanceId}: no active publications found.`,
        );
        return;
      }

      if (!tenantConfig) {
        this.logger.warn(
          `Skipping runtime context sync for tenant ${input.tenantId}: no active tenant AI config found to preserve base_prompt.`,
        );
        return;
      }

      const memberId = `${FUNNEL_HANDLER_MEMBER_PREFIX}:${funnelInstance.id}`;
      const routeContexts = toJsonRecord(
        tenantConfig.routeContexts as Prisma.JsonValue,
      );
      const funnelContext = {
        funnel_instance_id: funnelInstance.id,
        funnel_name: funnelInstance.name,
        funnel_code: funnelInstance.code,
        structural_type: funnelInstance.structuralType,
        conversion_contract: cloneJsonValue(
          funnelInstance.conversionContract as Prisma.JsonValue,
        ),
        active_publications: funnelInstance.publications.map((publication) => ({
          publication_id: publication.id,
          domain_host: publication.domain.host,
          normalized_host: publication.domain.normalizedHost,
          path_prefix: publication.pathPrefix,
          is_primary: publication.isPrimary,
          status: publication.status,
        })),
        synced_at: new Date().toISOString(),
        synced_by: RUNTIME_CONTEXT_SERVICE_KEY,
      };

      await this.request({
        tenant_id: input.tenantId,
        member_id: memberId,
        base_prompt: tenantConfig.basePrompt,
        route_contexts: routeContexts,
        funnel_context: funnelContext,
        cta_policy: toJsonRecord(tenantConfig.ctaPolicy as Prisma.JsonValue),
        ai_policy: toJsonRecord(tenantConfig.aiPolicy as Prisma.JsonValue),
        status: tenantConfig.isActive ? 'active' : 'inactive',
      });

      this.logger.log(
        `Runtime context synced for tenant ${input.tenantId}, funnel ${input.funnelInstanceId}, member ${memberId}.`,
      );
    } catch (error) {
      this.logger.warn(
        `Runtime context sync failed for tenant ${input.tenantId} and funnel ${input.funnelInstanceId}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  private isConfigured() {
    return Boolean(this.baseUrl && this.apiKey);
  }

  private async request(body: {
    tenant_id: string;
    member_id: string | null;
    base_prompt: string;
    route_contexts: JsonRecord;
    funnel_context: JsonRecord;
    cta_policy: JsonRecord;
    ai_policy: JsonRecord;
    status: 'active' | 'inactive';
  }) {
    const baseUrl = this.baseUrl!;
    const apiKey = this.apiKey!;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        `${baseUrl.replace(/\/+$/, '')}${RUNTIME_CONTEXT_CONFIG_SYNC_PATH}`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'x-internal-api-key': apiKey,
            'x-service-key': RUNTIME_CONTEXT_SERVICE_KEY,
          },
          body: JSON.stringify(body),
        },
      );

      if (response.ok) {
        return;
      }

      const responseBody = await response.text();

      throw new Error(
        `Runtime context config sync failed with HTTP ${response.status}: ${responseBody || 'Empty response body'}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
