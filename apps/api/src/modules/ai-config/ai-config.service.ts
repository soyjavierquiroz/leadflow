import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { WalletEngineService } from '../finance/wallet-engine.service';
import { normalizeMessagingPhone } from '../shared/messaging-channel.utils';
import {
  normalizeBaseUrl,
  sanitizeNullableText,
} from '../shared/url.utils';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type {
  AiConfigEditorSnapshot,
  AiConfigRouteContextKey,
  AiRuntimeContext,
  CloseOrchestrationSessionInput,
  CloseOrchestrationSessionResponse,
  ExecuteOrchestrationInput,
  ExecuteOrchestrationResponse,
  InitOrchestrationSessionInput,
  InitOrchestrationSessionResponse,
} from './ai-config.types';

type JsonRecord = Record<string, unknown>;

const AI_RUNTIME_CONTEXT_VERSION = 'leadflow.ai-runtime-context.v1' as const;
const AI_SERVICE_OWNER_KEY = 'lead-handler' as const;
const AI_RUNTIME_CHANNEL = 'whatsapp' as const;
const DEFAULT_GATEWAY_TIMEOUT_MS = 10_000;
const DEFAULT_GATEWAY_BASE_URL = 'http://ia_gateway:3000';
const DEFAULT_DEVELOPMENT_ORCHESTRATION_INSTANCE_NAME =
  'default-constructor' as const;
const DEFAULT_DEVELOPMENT_ORCHESTRATION_PROMPT =
  'Actua como el constructor de Smart Wiring de Leadflow y responde con un contrato JSON claro, conservador y aplicable por el builder.' as const;
const IA_GATEWAY_SESSION_INIT_PATH = '/v1/session/init';
const IA_GATEWAY_EXECUTE_PATH = '/v1/execute';
const IA_GATEWAY_SESSION_CLOSE_PATH = '/v1/session/close';
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

const stringifyJsonForPrompt = (value: unknown) => {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return '{}';
  }
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

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
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
  private readonly gatewayBaseUrl = normalizeBaseUrl(
    process.env.IA_GATEWAY_BASE_URL ?? DEFAULT_GATEWAY_BASE_URL,
  );
  private readonly gatewayAuthToken = sanitizeNullableText(
    process.env.GATEWAY_AUTH_TOKEN,
  );
  private readonly gatewayTimeoutMs = parsePositiveInt(
    process.env.IA_GATEWAY_REQUEST_TIMEOUT_MS,
    DEFAULT_GATEWAY_TIMEOUT_MS,
  );

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

  async initOrchestrationSession(
    input: InitOrchestrationSessionInput,
  ): Promise<InitOrchestrationSessionResponse> {
    this.ensureGatewayConfigured();

    const instanceName = sanitizeNullableText(input.instanceName);
    const funnelId = sanitizeNullableText(input.funnelId);

    if (!instanceName) {
      throw new BadRequestException({
        code: 'AI_ORCHESTRATION_INSTANCE_REQUIRED',
        message: 'instanceName is required to initialize the orchestration session.',
      });
    }

    if (!funnelId) {
      throw new BadRequestException({
        code: 'AI_ORCHESTRATION_FUNNEL_REQUIRED',
        message: 'funnelId is required to initialize the orchestration session.',
      });
    }

    const runtimeContext = await this.resolveRuntimeContext(instanceName);
    return this.initOrchestrationSessionWithRuntimeContext(runtimeContext, input);
  }

  async executeOrchestration(
    input: ExecuteOrchestrationInput,
  ): Promise<ExecuteOrchestrationResponse> {
    this.ensureGatewayConfigured();

    const instanceName = sanitizeNullableText(input.instanceName);
    const sessionId = sanitizeNullableText(input.sessionId);

    if (!instanceName) {
      throw new BadRequestException({
        code: 'AI_ORCHESTRATION_INSTANCE_REQUIRED',
        message: 'instanceName is required to execute the orchestration.',
      });
    }

    if (!sessionId) {
      throw new BadRequestException({
        code: 'AI_ORCHESTRATION_SESSION_REQUIRED',
        message: 'sessionId is required to execute the orchestration.',
      });
    }

    const runtimeContext = await this.resolveRuntimeContext(instanceName);
    return this.executeOrchestrationWithRuntimeContext(runtimeContext, input);
  }

  async closeOrchestrationSession(
    input: CloseOrchestrationSessionInput,
  ): Promise<CloseOrchestrationSessionResponse> {
    this.ensureGatewayConfigured();

    const instanceName = sanitizeNullableText(input.instanceName);
    const sessionId = sanitizeNullableText(input.sessionId);

    if (!instanceName) {
      throw new BadRequestException({
        code: 'AI_ORCHESTRATION_INSTANCE_REQUIRED',
        message: 'instanceName is required to close the orchestration session.',
      });
    }

    if (!sessionId) {
      throw new BadRequestException({
        code: 'AI_ORCHESTRATION_SESSION_REQUIRED',
        message: 'sessionId is required to close the orchestration session.',
      });
    }

    const runtimeContext = await this.resolveRuntimeContext(instanceName);
    return this.closeOrchestrationSessionWithRuntimeContext(runtimeContext, input);
  }

  private async initOrchestrationSessionWithRuntimeContext(
    runtimeContext: AiRuntimeContext,
    input: InitOrchestrationSessionInput,
  ): Promise<InitOrchestrationSessionResponse> {
    const funnelId = sanitizeNullableText(input.funnelId);

    if (!funnelId) {
      throw new BadRequestException({
        code: 'AI_ORCHESTRATION_FUNNEL_REQUIRED',
        message: 'funnelId is required to initialize the orchestration session.',
      });
    }

    const sessionId = this.buildOrchestrationSessionId({
      instanceName: runtimeContext.routing.instance_name,
      funnelId,
    });

    try {
      const { response, data } = await this.sendGatewayRequest({
        path: IA_GATEWAY_SESSION_INIT_PATH,
        runtimeContext,
        body: {
          sessionId,
          system_prompt: this.buildGatewaySystemPrompt({
            runtimeContext,
            funnelContext: input.funnelContext ?? null,
            metadata: input.metadata ?? null,
          }),
        },
        errorCode: 'AI_GATEWAY_SESSION_INIT_FAILED',
        errorMessage: 'IA Gateway session initialization failed.',
      });

      return {
        status: response.status,
        sessionId,
        runtimeContext,
        data,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError'
      ) {
        throw new GatewayTimeoutException({
          code: 'AI_GATEWAY_TIMEOUT',
          message: 'IA Gateway session initialization timed out.',
        });
      }

      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException({
        code: 'AI_GATEWAY_UNREACHABLE',
        message: 'IA Gateway session initialization request failed.',
        details: error instanceof Error ? error.message : 'Unknown upstream error.',
      });
    }
  }

  private async executeOrchestrationWithRuntimeContext(
    runtimeContext: AiRuntimeContext,
    input: ExecuteOrchestrationInput,
  ): Promise<ExecuteOrchestrationResponse> {
    const sessionId = sanitizeNullableText(input.sessionId);

    if (!sessionId) {
      throw new BadRequestException({
        code: 'AI_ORCHESTRATION_SESSION_REQUIRED',
        message: 'sessionId is required to execute the orchestration.',
      });
    }

    const prompt =
      sanitizeNullableText(input.intent) ??
      sanitizeNullableText(input.prompt) ??
      runtimeContext.ai_agent.base_prompt;

    try {
      const { response, data } = await this.sendGatewayRequest({
        path: IA_GATEWAY_EXECUTE_PATH,
        runtimeContext,
        body: {
          sessionId,
          prompt,
        },
        errorCode: 'AI_GATEWAY_EXECUTE_FAILED',
        errorMessage: 'IA Gateway orchestration failed.',
      });

      return {
        status: response.status,
        sessionId,
        runtimeContext,
        data,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError'
      ) {
        throw new GatewayTimeoutException({
          code: 'AI_GATEWAY_TIMEOUT',
          message: 'IA Gateway orchestration request timed out.',
        });
      }

      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException({
        code: 'AI_GATEWAY_UNREACHABLE',
        message: 'IA Gateway orchestration request failed.',
        details: error instanceof Error ? error.message : 'Unknown upstream error.',
      });
    }
  }

  private async closeOrchestrationSessionWithRuntimeContext(
    runtimeContext: AiRuntimeContext,
    input: CloseOrchestrationSessionInput,
  ): Promise<CloseOrchestrationSessionResponse> {
    const sessionId = sanitizeNullableText(input.sessionId);

    if (!sessionId) {
      throw new BadRequestException({
        code: 'AI_ORCHESTRATION_SESSION_REQUIRED',
        message: 'sessionId is required to close the orchestration session.',
      });
    }

    try {
      const { response, data } = await this.sendGatewayRequest({
        path: IA_GATEWAY_SESSION_CLOSE_PATH,
        runtimeContext,
        body: {
          sessionId,
        },
        errorCode: 'AI_GATEWAY_SESSION_CLOSE_FAILED',
        errorMessage: 'IA Gateway session close failed.',
      });

      return {
        status: response.status,
        sessionId,
        runtimeContext,
        data,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError'
      ) {
        throw new GatewayTimeoutException({
          code: 'AI_GATEWAY_TIMEOUT',
          message: 'IA Gateway session close timed out.',
        });
      }

      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException({
        code: 'AI_GATEWAY_UNREACHABLE',
        message: 'IA Gateway session close request failed.',
        details: error instanceof Error ? error.message : 'Unknown upstream error.',
      });
    }
  }

  async executeOrchestrationForUser(
    user: AuthenticatedUser,
    input: Omit<ExecuteOrchestrationInput, 'instanceName'> & {
      instanceName?: string | null;
    },
  ): Promise<ExecuteOrchestrationResponse> {
    const runtimeContext = await this.resolveRuntimeContextForUser(user, input);
    return this.executeOrchestrationWithRuntimeContext(runtimeContext, {
      ...input,
      instanceName: runtimeContext.routing.instance_name,
    });
  }

  async initOrchestrationSessionForUser(
    user: AuthenticatedUser,
    input: Omit<InitOrchestrationSessionInput, 'instanceName'> & {
      instanceName?: string | null;
    },
  ): Promise<InitOrchestrationSessionResponse> {
    const runtimeContext = await this.resolveRuntimeContextForUser(user, input);
    return this.initOrchestrationSessionWithRuntimeContext(runtimeContext, {
      ...input,
      instanceName: runtimeContext.routing.instance_name,
    });
  }

  async closeOrchestrationSessionForUser(
    user: AuthenticatedUser,
    input: Omit<CloseOrchestrationSessionInput, 'instanceName'> & {
      instanceName?: string | null;
    },
  ): Promise<CloseOrchestrationSessionResponse> {
    const runtimeContext = await this.resolveRuntimeContextForUser(user, input);
    return this.closeOrchestrationSessionWithRuntimeContext(runtimeContext, {
      ...input,
      instanceName: runtimeContext.routing.instance_name,
    });
  }

  private async resolveRuntimeContextForUser(
    user: AuthenticatedUser,
    input: {
      instanceName?: string | null;
      teamId?: string | null;
    },
  ) {
    const explicitInstanceName = sanitizeNullableText(input.instanceName);

    if (!explicitInstanceName) {
      const resolvedInstanceName = await this.resolveInstanceNameForUser(user);
      return this.resolveRuntimeContext(resolvedInstanceName);
    }

    try {
      return await this.resolveRuntimeContext(explicitInstanceName);
    } catch (error) {
      if (!this.shouldUseDevelopmentRuntimeFallback(user, explicitInstanceName, error)) {
        throw error;
      }

      return this.buildDevelopmentRuntimeContextForUser({
        user,
        instanceName: explicitInstanceName,
        teamId: input.teamId ?? null,
      });
    }
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

  private async resolveInstanceNameForUser(user: AuthenticatedUser) {
    const sponsorId = user.sponsorId;
    const teamId = user.teamId;

    if (!sponsorId || !teamId) {
      throw new BadRequestException({
        code: 'AI_ORCHESTRATION_INSTANCE_NOT_RESOLVABLE',
        message:
          'The current authenticated user is missing sponsor or team context required for orchestration.',
      });
    }

    const channelInstance = await this.prisma.channelInstance.findFirst({
      where: {
        tenantId: teamId,
        memberId: sponsorId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        instanceName: true,
      },
    });

    if (!channelInstance?.instanceName) {
      throw new NotFoundException({
        code: 'AI_ORCHESTRATION_CHANNEL_INSTANCE_NOT_FOUND',
        message:
          'No active channel instance was found for the current team admin to execute orchestration.',
      });
    }

    return channelInstance.instanceName;
  }

  private shouldUseDevelopmentRuntimeFallback(
    user: AuthenticatedUser,
    instanceName: string,
    error: unknown,
  ) {
    if (instanceName !== DEFAULT_DEVELOPMENT_ORCHESTRATION_INSTANCE_NAME) {
      return false;
    }

    if (!(error instanceof NotFoundException)) {
      return false;
    }

    return user.role === UserRole.SUPER_ADMIN || Boolean(user.teamId);
  }

  private async buildDevelopmentRuntimeContextForUser(input: {
    user: AuthenticatedUser;
    instanceName: string;
    teamId: string | null;
  }): Promise<AiRuntimeContext> {
    const teamId =
      sanitizeNullableText(input.teamId) ??
      sanitizeNullableText(input.user.teamId) ??
      null;

    if (!teamId) {
      throw new BadRequestException({
        code: 'AI_ORCHESTRATION_TEAM_CONTEXT_REQUIRED',
        message:
          'teamId is required to build a development orchestration context when no channel instance is available.',
      });
    }

    const sponsor =
      sanitizeNullableText(input.user.sponsorId) &&
      input.user.teamId === teamId
        ? await this.prisma.sponsor.findFirst({
            where: {
              id: input.user.sponsorId ?? undefined,
              teamId,
            },
            include: {
              team: true,
            },
          })
        : null;

    const team =
      sponsor?.team ??
      (await this.prisma.team.findUnique({
        where: {
          id: teamId,
        },
        select: {
          id: true,
          name: true,
          code: true,
        },
      }));

    if (!team) {
      throw new NotFoundException({
        code: 'AI_ORCHESTRATION_TEAM_NOT_FOUND',
        message:
          'No team could be resolved to build the development orchestration context.',
      });
    }

    const [memberConfig, tenantConfig] = await Promise.all([
      sponsor
        ? this.prisma.aiAgentConfig.findFirst({
            where: {
              tenantId: team.id,
              memberId: sponsor.id,
              isActive: true,
            },
            orderBy: {
              updatedAt: 'desc',
            },
          })
        : Promise.resolve(null),
      this.prisma.aiAgentConfig.findFirst({
        where: {
          tenantId: team.id,
          memberId: null,
          isActive: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
    ]);

    const placeholders = this.buildPlaceholders({
      name:
        sanitizeNullableText(sponsor?.displayName) ??
        sanitizeNullableText(input.user.fullName) ??
        'Constructor Leadflow',
      teamName: team.name,
      phone: sanitizeNullableText(sponsor?.phone) ?? null,
    });
    const basePrompt =
      buildMergedPrompt({
        tenantPrompt: tenantConfig?.basePrompt ?? null,
        memberPrompt: memberConfig?.basePrompt ?? null,
      }) ?? DEFAULT_DEVELOPMENT_ORCHESTRATION_PROMPT;

    return {
      version: AI_RUNTIME_CONTEXT_VERSION,
      routing: {
        provider: 'leadflow_builder',
        channel: AI_RUNTIME_CHANNEL,
        instance_name: input.instanceName,
        service_owner_key: AI_SERVICE_OWNER_KEY,
      },
      tenant: {
        id: team.id,
        name: team.name,
        code: team.code,
      },
      member: {
        id: sponsor?.id ?? input.user.id,
        name:
          sanitizeNullableText(sponsor?.displayName) ??
          sanitizeNullableText(input.user.fullName) ??
          'Constructor Leadflow',
        email:
          sanitizeNullableText(sponsor?.email) ??
          sanitizeNullableText(input.user.email) ??
          null,
        phone: sanitizeNullableText(sponsor?.phone) ?? null,
        public_slug: sanitizeNullableText(sponsor?.publicSlug) ?? null,
        whatsapp_link: placeholders.whatsapp_link,
      },
      placeholders,
      wallet: sponsor
        ? await this.resolveWalletContext(sponsor.id)
        : {
            account_id: null,
            balance: null,
            status: 'unavailable',
            reason:
              'Development orchestration fallback does not bind a sponsor wallet.',
          },
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
        strategy: memberConfig
          ? 'member_override'
          : tenantConfig
            ? 'tenant_default'
            : 'development_fallback',
        tenant_config_id: tenantConfig?.id ?? null,
        member_config_id: memberConfig?.id ?? null,
      },
    };
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

  private ensureGatewayConfigured() {
    if (this.gatewayBaseUrl && this.gatewayAuthToken) {
      return;
    }

    throw new ServiceUnavailableException({
      code: 'AI_GATEWAY_NOT_CONFIGURED',
      message:
        'IA Gateway is not configured. Set GATEWAY_AUTH_TOKEN to execute orchestrations.',
    });
  }

  private buildOrchestrationSessionId(input: {
    instanceName: string;
    funnelId: string;
  }) {
    return `${input.instanceName}-${input.funnelId}`;
  }

  private buildGatewaySystemPrompt(input: {
    runtimeContext: AiRuntimeContext;
    funnelContext: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
  }) {
    const sections = [
      input.runtimeContext.ai_agent.base_prompt,
      'Contexto operativo del runtime:',
      stringifyJsonForPrompt({
        tenant: input.runtimeContext.tenant,
        member: input.runtimeContext.member,
        placeholders: input.runtimeContext.placeholders,
        route_contexts: input.runtimeContext.ai_agent.route_contexts,
        cta_policy: input.runtimeContext.ai_agent.cta_policy,
        ai_policy: input.runtimeContext.ai_agent.ai_policy,
      }),
    ];

    if (input.funnelContext) {
      sections.push(
        'Estado actual del funnel:',
        stringifyJsonForPrompt(input.funnelContext),
      );
    }

    if (input.metadata) {
      sections.push(
        'Metadata de la sesión:',
        stringifyJsonForPrompt(input.metadata),
      );
    }

    sections.push(
      'Responde con un contrato JSON aplicable por Leadflow para Smart Wiring.',
    );

    return sections.join('\n\n');
  }

  private async sendGatewayRequest(input: {
    path: string;
    runtimeContext: AiRuntimeContext;
    body: Record<string, unknown>;
    errorCode: string;
    errorMessage: string;
  }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.gatewayTimeoutMs);

    try {
      const response = await fetch(
        `${this.gatewayBaseUrl!.replace(/\/+$/, '')}${input.path}`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${this.gatewayAuthToken}`,
            'Content-Type': 'application/json',
            'x-service-key': input.runtimeContext.routing.service_owner_key,
          },
          body: JSON.stringify(input.body),
        },
      );
      const rawBody = await response.text();
      const data = this.parseGatewayResponse(rawBody);

      if (!response.ok) {
        throw new BadGatewayException({
          code: input.errorCode,
          message: `${input.errorMessage} HTTP ${response.status}.`,
          details: data,
          upstreamStatus: response.status,
        });
      }

      return {
        response,
        data,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseGatewayResponse(rawBody: string) {
    if (!rawBody) {
      return null;
    }

    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      return rawBody;
    }
  }
}
