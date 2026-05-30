import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeBaseUrl, sanitizeNullableText } from '../shared/url.utils';
import {
  DEFAULT_TENANT_AI_BASE_PROMPT,
  resolveAiRuntimeRoutingMetadata,
} from '../ai-config/ai-config.defaults';

const DEFAULT_TIMEOUT_MS = 5_000;
const RUNTIME_CONTEXT_CONFIG_SYNC_PATH = '/v1/config/sync';
const RUNTIME_CONTEXT_SERVICE_KEY = 'leadflow_api' as const;
const FUNNEL_HANDLER_MEMBER_PREFIX = 'lead-handler' as const;

type JsonRecord = Record<string, Prisma.JsonValue>;
type TenantAiAgentConfig = Prisma.AiAgentConfigGetPayload<
  Record<string, never>
>;
type AiAgentConfigRecord = Prisma.AiAgentConfigGetPayload<
  Record<string, never>
>;

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

const toJsonRecord = (
  value: Prisma.JsonValue | null | undefined,
): JsonRecord =>
  isJsonRecord(value) ? (cloneJsonValue(value) as JsonRecord) : {};

const isValidBasePrompt = (value: string | null | undefined) =>
  Boolean(sanitizeNullableText(value));

const isCustomTenantBasePrompt = (value: string | null | undefined) => {
  const prompt = sanitizeNullableText(value);

  return Boolean(prompt && prompt !== DEFAULT_TENANT_AI_BASE_PROMPT);
};

const selectTenantConfigByPromptPriority = (configs: TenantAiAgentConfig[]) => {
  return (
    configs.find((config) => isCustomTenantBasePrompt(config.basePrompt)) ??
    configs.find((config) => isValidBasePrompt(config.basePrompt)) ??
    configs[0] ??
    null
  );
};

type RuntimeContextConfigSyncPayloadInput = {
  tenantId: string;
  memberId: string | null;
  basePrompt: string;
  verticalKey: string;
  brandKey: string;
  businessModelType: string;
  routeContexts: JsonRecord;
  funnelContext: JsonRecord;
  ctaPolicy: JsonRecord;
  aiPolicy: JsonRecord;
  status: 'active' | 'inactive';
};

type RuntimeContextConfigSyncPayload = {
  tenant_id: string;
  member_id: string | null;
  base_prompt: string;
  vertical_key: string;
  brand_key: string;
  business_model_type: string;
  route_contexts: JsonRecord;
  funnel_context: JsonRecord;
  cta_policy: JsonRecord;
  ai_policy: JsonRecord;
  status: 'active' | 'inactive';
};

export const buildRuntimeContextConfigSyncPayload = (
  input: RuntimeContextConfigSyncPayloadInput,
): RuntimeContextConfigSyncPayload => ({
  tenant_id: input.tenantId,
  member_id: input.memberId,
  base_prompt: input.basePrompt,
  vertical_key: input.verticalKey,
  brand_key: input.brandKey,
  business_model_type: input.businessModelType,
  route_contexts: input.routeContexts,
  funnel_context: input.funnelContext,
  cta_policy: input.ctaPolicy,
  ai_policy: input.aiPolicy,
  status: input.status,
});

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

  private async findActiveTenantConfig(tenantId: string) {
    const configs = await this.prisma.aiAgentConfig.findMany({
      where: {
        tenantId,
        memberId: null,
        isActive: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    return selectTenantConfigByPromptPriority(configs);
  }

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
            team: {
              select: {
                code: true,
              },
            },
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
        this.findActiveTenantConfig(input.tenantId),
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
      const aiPolicy = toJsonRecord(tenantConfig.aiPolicy as Prisma.JsonValue);
      const routingMetadata = resolveAiRuntimeRoutingMetadata({
        tenantCode: funnelInstance.team.code,
        routeContexts,
        aiPolicy,
      });
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

      await this.request(
        buildRuntimeContextConfigSyncPayload({
          tenantId: input.tenantId,
          memberId,
          basePrompt: tenantConfig.basePrompt,
          verticalKey: routingMetadata.vertical_key,
          brandKey: routingMetadata.brand_key,
          businessModelType: routingMetadata.business_model_type,
          routeContexts,
          funnelContext,
          ctaPolicy: toJsonRecord(tenantConfig.ctaPolicy as Prisma.JsonValue),
          aiPolicy,
          status: tenantConfig.isActive ? 'active' : 'inactive',
        }),
      );

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

  async syncAiAgentConfig(input: {
    config: AiAgentConfigRecord;
    tenantCode?: string | null;
  }): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        `Skipping runtime context AI config sync for tenant ${input.config.tenantId}, config ${input.config.id}: runtime context is not configured.`,
      );
      return;
    }

    const routeContexts = toJsonRecord(input.config.routeContexts);
    const aiPolicy = toJsonRecord(input.config.aiPolicy);
    const ctaPolicy = toJsonRecord(input.config.ctaPolicy);
    const routingMetadata = resolveAiRuntimeRoutingMetadata({
      tenantCode: input.tenantCode,
      routeContexts,
      aiPolicy,
    });
    const aiPolicyWithRoutingMetadata = {
      ...aiPolicy,
      ...routingMetadata,
    } satisfies JsonRecord;

    await this.request(
      buildRuntimeContextConfigSyncPayload({
        tenantId: input.config.tenantId,
        memberId: input.config.memberId,
        basePrompt: input.config.basePrompt,
        verticalKey: routingMetadata.vertical_key,
        brandKey: routingMetadata.brand_key,
        businessModelType: routingMetadata.business_model_type,
        routeContexts,
        funnelContext: {},
        ctaPolicy,
        aiPolicy: aiPolicyWithRoutingMetadata,
        status: input.config.isActive ? 'active' : 'inactive',
      }),
    );

    this.logger.log(
      `Runtime context AI config synced for tenant ${input.config.tenantId}, config ${input.config.id}, member ${input.config.memberId ?? 'global'}.`,
    );
  }

  private isConfigured() {
    return Boolean(this.baseUrl && this.apiKey);
  }

  private async request(body: RuntimeContextConfigSyncPayload) {
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
