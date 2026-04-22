import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentAuthUser } from '../auth/current-auth-user.decorator';
import { type AuthenticatedUser } from '../auth/auth.types';
import { RequireAuth } from '../auth/roles.decorator';
import { sanitizeNullableText } from '../shared/url.utils';
import { ConnectEvolutionDto } from './dto/connect-evolution.dto';
import { EvolutionService } from './evolution.service';
import { RuntimeContextService } from './runtime-context.service';

@Controller('evolution')
@RequireAuth()
export class EvolutionController {
  constructor(
    private readonly evolutionService: EvolutionService,
    private readonly runtimeContextService: RuntimeContextService,
  ) {}

  @Post('connect')
  async connect(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Body() dto: ConnectEvolutionDto,
  ) {
    const instanceName = this.requireBodyText(dto?.instanceName, 'instanceName');
    this.assertOwnedInstanceName(user, instanceName);
    const tenantId = this.resolveTenantId(user);
    const ownerKey = this.resolveOwnerKey(user);

    const connectionState =
      await this.evolutionService.getConnectionState(instanceName);

    if (!connectionState) {
      await this.evolutionService.createInstance(instanceName);
    }

    await this.evolutionService.setWebhook(instanceName);
    await this.runtimeContextService.registerBinding(
      tenantId,
      instanceName,
      ownerKey,
    );

    const qrCode = await this.evolutionService.getQrCode(instanceName);

    return {
      instanceName,
      tenantId,
      ownerKey,
      connectionState: connectionState?.instance?.state ?? 'created',
      base64: this.extractBase64(qrCode),
      pairingCode: sanitizeNullableText(qrCode.pairingCode),
      attempts: typeof qrCode.count === 'number' ? qrCode.count : null,
      raw: qrCode,
    };
  }

  @Get('status')
  async getStatus(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('instanceName') instanceName?: string,
  ) {
    const normalizedInstanceName = this.requireBodyText(
      instanceName,
      'instanceName',
    );
    this.assertOwnedInstanceName(user, normalizedInstanceName);
    const connectionState =
      await this.evolutionService.getConnectionState(normalizedInstanceName);
    const state = sanitizeNullableText(connectionState?.instance?.state) ?? 'close';

    return {
      instanceName: normalizedInstanceName,
      exists: Boolean(connectionState),
      state,
      connected: state.toLowerCase() === 'open',
      raw: connectionState,
    };
  }

  @Delete('restart')
  async restart(
    @CurrentAuthUser() user: AuthenticatedUser,
    @Query('instanceName') instanceName?: string,
  ) {
    const normalizedInstanceName = this.requireBodyText(
      instanceName,
      'instanceName',
    );
    this.assertOwnedInstanceName(user, normalizedInstanceName);

    await this.evolutionService.logoutInstance(normalizedInstanceName);

    return {
      success: true,
      instanceName: normalizedInstanceName,
    };
  }

  private resolveTenantId(user: AuthenticatedUser) {
    const tenantId = sanitizeNullableText(user.teamId ?? user.workspaceId);

    if (tenantId) {
      return tenantId;
    }

    throw new BadRequestException({
      code: 'EVOLUTION_TENANT_SCOPE_REQUIRED',
      message:
        'The authenticated user does not have an operational tenant scope.',
    });
  }

  private resolveOwnerKey(user: AuthenticatedUser) {
    const ownerKey = sanitizeNullableText(user.sponsorId ?? user.id);

    if (ownerKey) {
      return ownerKey;
    }

    throw new BadRequestException({
      code: 'EVOLUTION_OWNER_SCOPE_REQUIRED',
      message:
        'The authenticated user does not have an operational owner key.',
    });
  }

  private assertOwnedInstanceName(
    user: AuthenticatedUser,
    instanceName: string,
  ) {
    const normalizedInstanceName = instanceName.trim();
    const readableOwnedInstanceName = this.buildReadableInstanceName(user);
    const allowedInstanceNames = new Set(
      [readableOwnedInstanceName].concat(
        [sanitizeNullableText(user.id), sanitizeNullableText(user.sponsorId)]
          .filter((value): value is string => Boolean(value))
          .flatMap((value) => [`lf_${value}`, value]),
      ),
    );

    if (allowedInstanceNames.has(normalizedInstanceName)) {
      return;
    }

    throw new ForbiddenException({
      code: 'EVOLUTION_INSTANCE_FORBIDDEN',
      message:
        'The requested Evolution instance does not belong to the authenticated user.',
    });
  }

  private buildReadableInstanceName(user: AuthenticatedUser) {
    const teamSegment =
      this.sanitizeInstanceSegment(user.team?.name) ||
      this.sanitizeInstanceSegment(user.workspace?.name) ||
      'team';
    const firstName =
      user.fullName
        .trim()
        .split(/\s+/)
        .find((segment) => segment.trim().length > 0) ?? null;
    const userSegment = this.sanitizeInstanceSegment(firstName) || 'user';

    return `lf-${teamSegment}-${userSegment}`;
  }

  private sanitizeInstanceSegment(value: string | null | undefined) {
    if (!value) {
      return '';
    }

    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .trim();
  }

  private requireBodyText(value: string | null | undefined, field: string) {
    const normalized = sanitizeNullableText(value);

    if (normalized) {
      return normalized;
    }

    throw new BadRequestException({
      code: 'EVOLUTION_REQUEST_INVALID',
      message: `${field} is required.`,
    });
  }

  private extractBase64(qrCode: {
    base64?: string;
    code?: string;
    qrcode?: string;
    qr?: string;
  }) {
    return (
      sanitizeNullableText(qrCode.base64) ??
      sanitizeNullableText(qrCode.code) ??
      sanitizeNullableText(qrCode.qrcode) ??
      sanitizeNullableText(qrCode.qr)
    );
  }
}
