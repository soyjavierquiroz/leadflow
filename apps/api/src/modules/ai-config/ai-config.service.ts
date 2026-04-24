import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WalletEngineService } from '../finance/wallet-engine.service';
import { normalizeMessagingPhone } from '../shared/messaging-channel.utils';
import { sanitizeNullableText } from '../shared/url.utils';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AiConfigEditorSnapshot,
  AiConfigRouteContextKey,
  AiRuntimeContext,
} from './ai-config.types';

type JsonRecord = Record<string, unknown>;

const AI_RUNTIME_CONTEXT_VERSION = 'leadflow.ai-runtime-context.v1' as const;
const AI_SERVICE_OWNER_KEY = 'lead-handler' as const;
const AI_RUNTIME_CHANNEL = 'whatsapp' as const;
const AI_CONFIG_PLACEHOLDERS = [
  '{{name}}',
  '{{team_name}}',
  '{{whatsapp_link}}',
] as const;
const AI_CONFIG_ROUTE_CONTEXT_KEYS = [
  'risk',
  'offer',
  'product',
  'service',
  'business',
] as const satisfies readonly AiConfigRouteContextKey[];

const isPlainObject = (value: unknown): value is JsonRecord => {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
};

const cloneJsonValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJsonValue(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        cloneJsonValue(nestedValue),
      ]),
    );
  }

  return value;
};

const mergeJsonValues = (baseValue: unknown, overrideValue: unknown): unknown => {
  if (overrideValue === null || overrideValue === undefined) {
    return cloneJsonValue(baseValue);
  }

  if (baseValue === null || baseValue === undefined) {
    return cloneJsonValue(overrideValue);
  }

  if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
    return cloneJsonValue(overrideValue);
  }

  if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
    const mergedKeys = new Set([
      ...Object.keys(baseValue),
      ...Object.keys(overrideValue),
    ]);

    return Object.fromEntries(
      [...mergedKeys].map((key) => [
        key,
        mergeJsonValues(baseValue[key], overrideValue[key]),
      ]),
    );
  }

  return cloneJsonValue(overrideValue);
};

const toJsonRecord = (value: unknown): JsonRecord => {
  return isPlainObject(value) ? (cloneJsonValue(value) as JsonRecord) : {};
};

const readStringValue = (value: unknown) => {
  if (typeof value === 'string') {
    return sanitizeNullableText(value) ?? '';
  }

  if (value === null || value === undefined) {
    return '';
  }

  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};

const readRouteContextFields = (
  value: unknown,
): Record<AiConfigRouteContextKey, string> => {
  const record = toJsonRecord(value);

  return Object.fromEntries(
    AI_CONFIG_ROUTE_CONTEXT_KEYS.map((key) => [key, readStringValue(record[key])]),
  ) as Record<AiConfigRouteContextKey, string>;
};

const mergeRouteContextFields = (input: {
  existing: unknown;
  updates: Partial<Record<AiConfigRouteContextKey, string | null | undefined>>;
}) => {
  const current = toJsonRecord(input.existing);

  for (const key of AI_CONFIG_ROUTE_CONTEXT_KEYS) {
    if (!(key in input.updates)) {
      continue;
    }

    const nextValue = sanitizeNullableText(input.updates[key]);

    if (nextValue) {
      current[key] = nextValue;
    } else {
      delete current[key];
    }
  }

  return Object.keys(current).length > 0 ? current : null;
};

const mergeDefaultCta = (input: {
  existing: unknown;
  defaultCta: string | null | undefined;
}) => {
  const current = toJsonRecord(input.existing);
  const nextDefaultCta = sanitizeNullableText(input.defaultCta);

  if (nextDefaultCta) {
    current.default_cta = nextDefaultCta;
  } else {
    delete current.default_cta;
  }

  return Object.keys(current).length > 0 ? current : null;
};

const buildMergedPrompt = (input: {
  tenantPrompt: string | null;
  memberPrompt: string | null;
}) => {
  const tenantPrompt = sanitizeNullableText(input.tenantPrompt);
  const memberPrompt = sanitizeNullableText(input.memberPrompt);

  if (tenantPrompt && memberPrompt) {
    if (tenantPrompt === memberPrompt) {
      return tenantPrompt;
    }

    return `${tenantPrompt}\n\n${memberPrompt}`;
  }

  return memberPrompt ?? tenantPrompt ?? null;
};

const replacePromptPlaceholders = (
  prompt: string,
  placeholders: {
    name: string;
    team_name: string;
    whatsapp_link: string | null;
  },
) => {
  return prompt
    .replace(/\{\{\s*name\s*\}\}/gi, placeholders.name)
    .replace(/\{\{\s*team_name\s*\}\}/gi, placeholders.team_name)
    .replace(
      /\{\{\s*whatsapp_link\s*\}\}/gi,
      placeholders.whatsapp_link ?? '',
    );
};

@Injectable()
export class AiConfigService {
  private readonly logger = new Logger(AiConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletEngineService: WalletEngineService,
  ) {}

  async getMemberEditorSnapshot(scope: {
    workspaceId: string;
    teamId: string;
    sponsorId: string;
  }): Promise<AiConfigEditorSnapshot> {
    const sponsor = await this.requireScopedSponsor(scope);
    const [memberConfig, tenantConfig] = await Promise.all([
      this.prisma.aiAgentConfig.findFirst({
        where: {
          tenantId: sponsor.teamId,
          memberId: sponsor.id,
          isActive: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
      this.prisma.aiAgentConfig.findFirst({
        where: {
          tenantId: sponsor.teamId,
          memberId: null,
          isActive: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
    ]);

    const effectiveConfig = memberConfig ?? tenantConfig;

    return {
      configId: memberConfig?.id ?? null,
      tenantId: sponsor.team.id,
      memberId: sponsor.id,
      tenantName: sponsor.team.name,
      memberName: sponsor.displayName,
      basePrompt:
        sanitizeNullableText(memberConfig?.basePrompt) ??
        sanitizeNullableText(tenantConfig?.basePrompt) ??
        '',
      routeContexts: readRouteContextFields(effectiveConfig?.routeContexts),
      ctaPolicy: {
        defaultCta:
          sanitizeNullableText(
            toJsonRecord(effectiveConfig?.ctaPolicy).default_cta as
              | string
              | null
              | undefined,
          ) ?? null,
      },
      resolution: {
        strategy: memberConfig
          ? 'member_override'
          : tenantConfig
            ? 'tenant_default'
            : 'empty',
        tenantConfigId: tenantConfig?.id ?? null,
        memberConfigId: memberConfig?.id ?? null,
      },
      availablePlaceholders: [...AI_CONFIG_PLACEHOLDERS],
      updatedAt: memberConfig?.updatedAt?.toISOString() ?? null,
    };
  }

  async updateMemberSettings(
    scope: {
      workspaceId: string;
      teamId: string;
      sponsorId: string;
    },
    input: {
      basePrompt: string;
      routeContexts?: Partial<Record<AiConfigRouteContextKey, string | null>>;
      defaultCta?: string | null;
    },
  ): Promise<AiConfigEditorSnapshot> {
    const sponsor = await this.requireScopedSponsor(scope);
    const normalizedBasePrompt = sanitizeNullableText(input.basePrompt);

    if (!normalizedBasePrompt) {
      throw new BadRequestException({
        code: 'AI_CONFIG_BASE_PROMPT_REQUIRED',
        message: 'basePrompt is required to persist the AI configuration.',
      });
    }

    const existingConfig = await this.prisma.aiAgentConfig.findUnique({
      where: {
        tenantId_memberId: {
          tenantId: sponsor.teamId,
          memberId: sponsor.id,
        },
      },
    });

    await this.prisma.aiAgentConfig.upsert({
      where: {
        tenantId_memberId: {
          tenantId: sponsor.teamId,
          memberId: sponsor.id,
        },
      },
      update: {
        basePrompt: normalizedBasePrompt,
        routeContexts: (mergeRouteContextFields({
          existing: existingConfig?.routeContexts,
          updates: input.routeContexts ?? {},
        }) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        ctaPolicy: (mergeDefaultCta({
          existing: existingConfig?.ctaPolicy,
          defaultCta: input.defaultCta,
        }) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        aiPolicy: existingConfig?.aiPolicy ?? undefined,
        isActive: true,
      },
      create: {
        tenantId: sponsor.teamId,
        memberId: sponsor.id,
        basePrompt: normalizedBasePrompt,
        routeContexts: (mergeRouteContextFields({
          existing: null,
          updates: input.routeContexts ?? {},
        }) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        ctaPolicy: (mergeDefaultCta({
          existing: null,
          defaultCta: input.defaultCta,
        }) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        aiPolicy: Prisma.JsonNull,
        isActive: true,
      },
    });

    return await this.getMemberEditorSnapshot(scope);
  }

  async resolveRuntimeContext(instanceName: string): Promise<AiRuntimeContext> {
    const normalizedInstanceName = sanitizeNullableText(instanceName);

    if (!normalizedInstanceName) {
      throw new NotFoundException({
        code: 'AI_CHANNEL_INSTANCE_REQUIRED',
        message: 'instanceName is required to resolve the AI runtime context.',
      });
    }

    const channelInstance = await this.prisma.channelInstance.findUnique({
      where: {
        instanceName: normalizedInstanceName,
      },
      include: {
        tenant: true,
        member: true,
      },
    });

    if (!channelInstance) {
      throw new NotFoundException({
        code: 'AI_CHANNEL_INSTANCE_NOT_FOUND',
        message: `No ChannelInstance was found for instance ${normalizedInstanceName}.`,
      });
    }

    if (channelInstance.member.teamId !== channelInstance.tenantId) {
      throw new InternalServerErrorException({
        code: 'AI_CHANNEL_INSTANCE_OWNERSHIP_MISMATCH',
        message:
          'The resolved ChannelInstance points to a member that does not belong to the same tenant.',
      });
    }

    const [memberConfig, tenantConfig] = await Promise.all([
      this.prisma.aiAgentConfig.findFirst({
        where: {
          tenantId: channelInstance.tenantId,
          memberId: channelInstance.memberId,
          isActive: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
      this.prisma.aiAgentConfig.findFirst({
        where: {
          tenantId: channelInstance.tenantId,
          memberId: null,
          isActive: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
    ]);

    if (!memberConfig && !tenantConfig) {
      throw new NotFoundException({
        code: 'AI_AGENT_CONFIG_NOT_FOUND',
        message:
          'No active AI agent configuration was found for this member or tenant.',
      });
    }

    const placeholders = this.buildPlaceholders({
      name: channelInstance.member.displayName,
      teamName: channelInstance.tenant.name,
      phone: channelInstance.member.phone,
    });
    const basePrompt = buildMergedPrompt({
      tenantPrompt: tenantConfig?.basePrompt ?? null,
      memberPrompt: memberConfig?.basePrompt ?? null,
    });

    if (!basePrompt) {
      throw new NotFoundException({
        code: 'AI_AGENT_BASE_PROMPT_NOT_FOUND',
        message:
          'No base prompt could be resolved from the active AI agent configuration.',
      });
    }

    const wallet = await this.resolveWalletContext(channelInstance.memberId);

    return {
      version: AI_RUNTIME_CONTEXT_VERSION,
      routing: {
        provider: channelInstance.provider,
        channel: AI_RUNTIME_CHANNEL,
        instance_name: channelInstance.instanceName,
        service_owner_key: AI_SERVICE_OWNER_KEY,
      },
      tenant: {
        id: channelInstance.tenant.id,
        name: channelInstance.tenant.name,
        code: channelInstance.tenant.code,
      },
      member: {
        id: channelInstance.member.id,
        name: channelInstance.member.displayName,
        email: sanitizeNullableText(channelInstance.member.email),
        phone: sanitizeNullableText(channelInstance.member.phone),
        public_slug: sanitizeNullableText(channelInstance.member.publicSlug),
        whatsapp_link: placeholders.whatsapp_link,
      },
      placeholders,
      wallet,
      ai_agent: {
        base_prompt: replacePromptPlaceholders(basePrompt, placeholders),
        route_contexts: toJsonRecord(
          mergeJsonValues(
            tenantConfig?.routeContexts,
            memberConfig?.routeContexts,
          ),
        ),
        cta_policy: toJsonRecord(
          mergeJsonValues(tenantConfig?.ctaPolicy, memberConfig?.ctaPolicy),
        ),
        ai_policy: toJsonRecord(
          mergeJsonValues(tenantConfig?.aiPolicy, memberConfig?.aiPolicy),
        ),
      },
      resolution: {
        strategy: memberConfig ? 'member_override' : 'tenant_default',
        tenant_config_id: tenantConfig?.id ?? null,
        member_config_id: memberConfig?.id ?? null,
      },
    };
  }

  private async requireScopedSponsor(scope: {
    workspaceId: string;
    teamId: string;
    sponsorId: string;
  }) {
    const sponsor = await this.prisma.sponsor.findFirst({
      where: {
        id: scope.sponsorId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
      include: {
        team: true,
      },
    });

    if (!sponsor) {
      throw new NotFoundException({
        code: 'AI_CONFIG_MEMBER_NOT_FOUND',
        message: 'The requested sponsor was not found for this AI config scope.',
      });
    }

    return sponsor;
  }

  private buildPlaceholders(input: {
    name: string;
    teamName: string;
    phone: string | null;
  }) {
    const normalizedPhone = normalizeMessagingPhone(input.phone);

    return {
      name: sanitizeNullableText(input.name) ?? '',
      team_name: sanitizeNullableText(input.teamName) ?? '',
      whatsapp_link: normalizedPhone
        ? `https://wa.me/${normalizedPhone}`
        : null,
    };
  }

  private async resolveWalletContext(memberId: string): Promise<AiRuntimeContext['wallet']> {
    if (!this.walletEngineService.isConfigured()) {
      return {
        account_id: null,
        balance: null,
        status: 'unavailable',
        reason: 'Wallet engine is not configured for this environment.',
      };
    }

    try {
      const account = await this.walletEngineService.upsertSponsorAccount(
        memberId,
      );
      const balance = await this.walletEngineService.getSponsorKredits(
        account.accountId,
      );

      return {
        account_id: account.accountId,
        balance,
        status: 'resolved',
        reason: null,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown wallet error.';

      this.logger.warn(
        `Wallet context resolution failed for sponsor ${memberId}: ${message}`,
      );

      return {
        account_id: null,
        balance: null,
        status: 'unavailable',
        reason: message,
      };
    }
  }
}
