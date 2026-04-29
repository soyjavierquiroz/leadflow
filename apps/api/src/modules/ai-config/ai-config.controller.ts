import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireRoles } from '../auth/roles.decorator';
import { sanitizeNullableText } from '../shared/url.utils';
import { AiConfigInternalApiGuard } from './ai-config-internal-api.guard';
import { AiConfigService } from './ai-config.service';
import type {
  CloseOrchestrationSessionResponse,
  ExecuteOrchestrationResponse,
  InitOrchestrationSessionResponse,
  ResolveFullRuntimeResponse,
} from './ai-config.types';

const APP_KEY = 'leadflow_api' as const;
const PLATFORM_KEY = 'kurukin' as const;
const PRODUCT_KEY = 'leadflow' as const;
const RUNTIME_STATUS = 'active' as const;

@Controller('runtime')
export class AiConfigController {
  constructor(private readonly aiConfigService: AiConfigService) {}

  @Post('resolve-full')
  @HttpCode(200)
  @UseGuards(AiConfigInternalApiGuard)
  async resolveFull(
    @Body()
    body?: {
      instance_name?: string | null;
    },
  ): Promise<ResolveFullRuntimeResponse> {
    const instanceName = sanitizeNullableText(body?.instance_name);

    if (!instanceName) {
      throw new BadRequestException({
        code: 'RUNTIME_RESOLVE_INVALID',
        message: 'instance_name is required.',
      });
    }

    const runtimeContext =
      await this.aiConfigService.resolveRuntimeContext(instanceName);

    return {
      tenant_id: runtimeContext.tenant.id,
      app_key: APP_KEY,
      platform_key: PLATFORM_KEY,
      product_key: PRODUCT_KEY,
      vertical_key: runtimeContext.tenant.code,
      service_owner_key: runtimeContext.routing.service_owner_key,
      wallet_subject: {
        type: 'sponsor',
        id: runtimeContext.member.id,
        account_id: runtimeContext.wallet.account_id,
        balance: runtimeContext.wallet.balance,
        status: runtimeContext.wallet.status,
        reason: runtimeContext.wallet.reason,
      },
      runtime_config: runtimeContext,
      config_version: runtimeContext.version,
      status: RUNTIME_STATUS,
    };
  }

  @Post('execute-orchestration')
  @HttpCode(200)
  @RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
  executeOrchestration(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body()
    body?: {
      instance_name?: string | null;
      team_id?: string | null;
      prompt?: string | null;
      session_id?: string | null;
      intent?: string | null;
    },
  ): Promise<ExecuteOrchestrationResponse> {
    return this.aiConfigService.executeOrchestrationForUser(user, {
      instanceName: sanitizeNullableText(body?.instance_name),
      teamId: sanitizeNullableText(body?.team_id),
      prompt: body?.prompt,
      sessionId: sanitizeNullableText(body?.session_id) ?? '',
      intent: body?.intent,
    });
  }

  @Post('session/init')
  @HttpCode(200)
  @RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
  initOrchestrationSession(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body()
    body?: {
      instance_name?: string | null;
      funnel_id?: string | null;
      team_id?: string | null;
      funnel_context?: Record<string, unknown> | null;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<InitOrchestrationSessionResponse> {
    return this.aiConfigService.initOrchestrationSessionForUser(user, {
      instanceName: sanitizeNullableText(body?.instance_name),
      teamId: sanitizeNullableText(body?.team_id),
      funnelId: sanitizeNullableText(body?.funnel_id) ?? '',
      funnelContext: body?.funnel_context,
      metadata: body?.metadata,
    });
  }

  @Post('session/close')
  @HttpCode(200)
  @RequireRoles(UserRole.SUPER_ADMIN, UserRole.TEAM_ADMIN)
  closeOrchestrationSession(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body()
    body?: {
      instance_name?: string | null;
      team_id?: string | null;
      session_id?: string | null;
    },
  ): Promise<CloseOrchestrationSessionResponse> {
    return this.aiConfigService.closeOrchestrationSessionForUser(user, {
      instanceName: sanitizeNullableText(body?.instance_name),
      teamId: sanitizeNullableText(body?.team_id),
      sessionId: sanitizeNullableText(body?.session_id) ?? '',
    });
  }
}
