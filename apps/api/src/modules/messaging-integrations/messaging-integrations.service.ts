import {
  BadGatewayException,
  GatewayTimeoutException,
  GoneException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  MessagingConnectionStatus,
  MessagingRuntimeContextStatus,
  MessagingProvider,
  type MessagingConnection,
  type Prisma,
  type Sponsor,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ConnectMemberMessagingDto } from './dto/connect-member-messaging.dto';
import {
  SponsorDashboardDto,
  type SponsorDashboardStatus,
} from './dto/sponsor-dashboard.dto';
import {
  EvolutionApiClient,
  EvolutionApiClientError,
} from './evolution-api.client';
import {
  buildAutomationWebhookUrl,
  buildEvolutionInstanceId,
  isQrExpired,
  normalizeMessagingPhone,
  resolveMessagingConnectionStatus,
  sanitizeNullableText,
} from './messaging-integrations.utils';
import { RuntimeContextCentralService } from '../runtime-context/runtime-context-central.service';

type MemberMessagingScope = {
  workspaceId: string;
  teamId: string;
  sponsorId: string;
};

type MemberScopedSponsor = Sponsor & {
  team: {
    code: string;
  };
};

type PreparedConnectionInput = {
  instanceId: string;
  phone: string | null;
  normalizedPhone: string | null;
  automationWebhookUrl: string | null;
  automationEnabled: boolean;
};

type ProvisionFlowOptions = {
  fetchQr: boolean;
  resetRemoteFirst?: boolean;
};

@Injectable()
export class MessagingIntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evolutionClient: EvolutionApiClient,
    private readonly runtimeContextCentralService: RuntimeContextCentralService,
  ) {}

  async getCurrentForMember(
    scope: MemberMessagingScope,
  ): Promise<SponsorDashboardDto> {
    const sponsor = await this.requireMemberSponsor(scope);
    const connection = await this.findConnection(scope);

    return this.buildDashboardDto(sponsor, connection);
  }

  async connectForMember(
    scope: MemberMessagingScope,
    dto?: ConnectMemberMessagingDto,
  ): Promise<SponsorDashboardDto> {
    this.ensureProviderConfigured();

    const sponsor = await this.requireMemberSponsor(scope);
    const existingConnection = await this.findConnection(scope);

    try {
      const connection = await this.runProvisionFlow(
        scope,
        sponsor,
        existingConnection,
        dto,
        {
          fetchQr: true,
        },
      );

      return this.buildDashboardDto(sponsor, connection);
    } catch (error) {
      await this.persistProviderError({
        scope,
        sponsor,
        existingConnection,
        preparedInput: this.prepareConnectionInput(
          sponsor,
          existingConnection,
          dto,
        ),
        message: this.extractErrorMessage(error),
      });

      throw this.toHttpException(error);
    }
  }

  async getQrForMember(
    scope: MemberMessagingScope,
    dto?: ConnectMemberMessagingDto,
  ): Promise<SponsorDashboardDto> {
    this.ensureProviderConfigured();

    const sponsor = await this.requireMemberSponsor(scope);
    const existingConnection = await this.findConnection(scope);

    try {
      const connection = await this.runProvisionFlow(
        scope,
        sponsor,
        existingConnection,
        dto,
        {
          fetchQr: true,
        },
      );

      return this.buildDashboardDto(sponsor, connection);
    } catch (error) {
      await this.persistProviderError({
        scope,
        sponsor,
        existingConnection,
        preparedInput: this.prepareConnectionInput(
          sponsor,
          existingConnection,
          dto,
        ),
        message: this.extractErrorMessage(error),
      });

      throw this.toHttpException(error);
    }
  }

  async refreshForMember(
    scope: MemberMessagingScope,
  ): Promise<SponsorDashboardDto> {
    const sponsor = await this.requireMemberSponsor(scope);
    const existingConnection = await this.findConnection(scope);

    if (!existingConnection) {
      return this.buildDashboardDto(sponsor, null);
    }

    if (!this.evolutionClient.isConfigured()) {
      return this.buildDashboardDto(sponsor, existingConnection);
    }

    try {
      if (!existingConnection.externalInstanceId) {
        const healedConnection = await this.runProvisionFlow(
          scope,
          sponsor,
          existingConnection,
          undefined,
          {
            fetchQr: true,
          },
        );

        return this.buildDashboardDto(sponsor, healedConnection);
      }

      const statusPayload = await this.evolutionClient.getConnectionState(
        existingConnection.externalInstanceId,
      );

      if (
        !statusPayload.exists ||
        this.evolutionClient.shouldRegenerateQrSession({
          state: statusPayload.state,
          qrExpiresAt: existingConnection.pairingExpiresAt,
        })
      ) {
        const healedConnection = await this.runProvisionFlow(
          scope,
          sponsor,
          existingConnection,
          undefined,
          {
            fetchQr: true,
          },
        );

        return this.buildDashboardDto(sponsor, healedConnection);
      }

      const status = statusPayload.exists
        ? resolveMessagingConnectionStatus({
            state: statusPayload.state,
            qrCodeData: existingConnection.qrCodeData,
            pairingCode: existingConnection.pairingCode,
          })
        : MessagingConnectionStatus.disconnected;

      const connection = await this.prisma.messagingConnection.update({
        where: {
          id: existingConnection.id,
        },
        data: {
          status,
          normalizedPhone:
            statusPayload.normalizedPhone ??
            existingConnection.normalizedPhone ??
            normalizeMessagingPhone(existingConnection.phone),
          qrCodeData:
            status === MessagingConnectionStatus.connected ||
            status === MessagingConnectionStatus.disconnected
              ? null
              : existingConnection.qrCodeData,
          pairingCode:
            status === MessagingConnectionStatus.connected ||
            status === MessagingConnectionStatus.disconnected
              ? null
              : existingConnection.pairingCode,
          pairingExpiresAt:
            status === MessagingConnectionStatus.qr_ready
              ? (existingConnection.pairingExpiresAt ?? this.inFiveMinutes())
              : null,
          metadataJson: this.buildMetadata(existingConnection.metadataJson, {
            lastKnownState: statusPayload.state,
            lastStatusResponse: statusPayload.raw,
          }),
          lastSyncedAt: new Date(),
          lastConnectedAt:
            status === MessagingConnectionStatus.connected
              ? (existingConnection.lastConnectedAt ?? new Date())
              : existingConnection.lastConnectedAt,
          lastDisconnectedAt:
            status === MessagingConnectionStatus.disconnected
              ? new Date()
              : existingConnection.lastDisconnectedAt,
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });

      return this.buildDashboardDto(sponsor, connection);
    } catch (error) {
      await this.prisma.messagingConnection.update({
        where: {
          id: existingConnection.id,
        },
        data: {
          status: MessagingConnectionStatus.error,
          lastSyncedAt: new Date(),
          lastErrorAt: new Date(),
          lastErrorMessage: this.extractErrorMessage(error),
        },
      });

      throw this.toHttpException(error);
    }
  }

  async resetForMember(
    scope: MemberMessagingScope,
    dto?: ConnectMemberMessagingDto,
  ): Promise<SponsorDashboardDto> {
    this.ensureProviderConfigured();

    const sponsor = await this.requireMemberSponsor(scope);
    const existingConnection = await this.findConnection(scope);

    try {
      const connection = await this.runProvisionFlow(
        scope,
        sponsor,
        existingConnection,
        dto,
        {
          fetchQr: true,
          resetRemoteFirst: true,
        },
      );

      return this.buildDashboardDto(sponsor, connection);
    } catch (error) {
      await this.persistProviderError({
        scope,
        sponsor,
        existingConnection,
        preparedInput: this.prepareConnectionInput(
          sponsor,
          existingConnection,
          dto,
        ),
        message: this.extractErrorMessage(error),
      });

      throw this.toHttpException(error);
    }
  }

  async disconnectForMember(
    scope: MemberMessagingScope,
  ): Promise<SponsorDashboardDto> {
    const sponsor = await this.requireMemberSponsor(scope);
    const existingConnection = await this.findConnection(scope);

    if (!existingConnection) {
      return this.buildDashboardDto(sponsor, null);
    }

    if (
      this.evolutionClient.isConfigured() &&
      existingConnection.externalInstanceId
    ) {
      try {
        await this.evolutionClient.deleteInstance(
          existingConnection.externalInstanceId,
        );
      } catch (error) {
        await this.prisma.messagingConnection.update({
          where: {
            id: existingConnection.id,
          },
          data: {
            lastErrorAt: new Date(),
            lastErrorMessage: this.extractErrorMessage(error),
          },
        });
      }
    }

    const connection = await this.prisma.messagingConnection.update({
      where: {
        id: existingConnection.id,
      },
      data: {
        status: MessagingConnectionStatus.disconnected,
        runtimeContextStatus: null,
        runtimeContextTenantId: existingConnection.workspaceId,
        runtimeContextRegisteredAt: null,
        runtimeContextReadyAt: null,
        runtimeContextLastCheckedAt: null,
        runtimeContextLastErrorAt: null,
        runtimeContextLastErrorMessage: null,
        qrCodeData: null,
        pairingCode: null,
        pairingExpiresAt: null,
        metadataJson: this.buildMetadata(existingConnection.metadataJson, {
          lastKnownState: 'disconnected',
        }),
        lastSyncedAt: new Date(),
        lastDisconnectedAt: new Date(),
      },
    });

    return this.buildDashboardDto(sponsor, connection);
  }

  private async runProvisionFlow(
    scope: MemberMessagingScope,
    sponsor: MemberScopedSponsor,
    existingConnection: MessagingConnection | null,
    dto: ConnectMemberMessagingDto | undefined,
    options: ProvisionFlowOptions,
  ) {
    const preparedInput = this.prepareConnectionInput(
      sponsor,
      existingConnection,
      dto,
    );

    const baseConnection = await this.upsertBaseConnection(
      scope,
      sponsor,
      existingConnection,
      preparedInput,
      options.resetRemoteFirst
        ? MessagingConnectionStatus.provisioning
        : MessagingConnectionStatus.provisioning,
    );

    if (options.resetRemoteFirst && preparedInput.instanceId) {
      await this.evolutionClient.deleteInstance(preparedInput.instanceId);
    }

    const currentState = await this.evolutionClient.ensureInstanceExists(
      preparedInput.instanceId,
    );
    const connectionWebhookUrl = this.evolutionClient.buildInboundWebhookUrl(
      preparedInput.instanceId,
    );

    if (
      !options.resetRemoteFirst &&
      options.fetchQr &&
      currentState.exists &&
      this.evolutionClient.shouldRegenerateQrSession({
        state: currentState.state,
        qrExpiresAt: existingConnection?.pairingExpiresAt ?? null,
      })
    ) {
      await this.recreateQrSession(
        preparedInput.instanceId,
        connectionWebhookUrl,
      );
    }

    let qrPayload = options.fetchQr
      ? await this.fetchQrWithRecovery({
          instanceId: preparedInput.instanceId,
          webhookUrl: connectionWebhookUrl,
        })
      : {
          qrCodeData: baseConnection.qrCodeData,
          pairingCode: baseConnection.pairingCode,
          expiresAt: baseConnection.pairingExpiresAt,
          raw: null,
        };

    const webhookRegistered = await this.evolutionClient.setWebhook(
      preparedInput.instanceId,
      connectionWebhookUrl,
    );
    await this.runtimeContextCentralService.markConnectionProvisioned({
      connectionId: baseConnection.id,
      tenantId: scope.workspaceId,
    });

    if (webhookRegistered) {
      await this.runtimeContextCentralService.ensureConnectionReady({
        id: baseConnection.id,
        workspaceId: scope.workspaceId,
        externalInstanceId: preparedInput.instanceId,
        runtimeContextStatus: MessagingRuntimeContextStatus.PROVISIONED,
        runtimeContextTenantId: scope.workspaceId,
      });
    }

    let statusPayload = await this.evolutionClient.getConnectionState(
      preparedInput.instanceId,
    );

    if (!statusPayload.exists) {
      const healed = await this.selfHealMissingInstance({
        instanceId: preparedInput.instanceId,
        webhookUrl: connectionWebhookUrl,
        fetchQr: options.fetchQr,
      });

      statusPayload = healed.state;
      if (healed.qrPayload) {
        qrPayload = healed.qrPayload;
      }
    }

    const resolvedStatus = statusPayload.exists
      ? resolveMessagingConnectionStatus({
          state: statusPayload.state,
          qrCodeData: qrPayload.qrCodeData,
          pairingCode: qrPayload.pairingCode,
          assumeProvisioning: true,
        })
      : MessagingConnectionStatus.disconnected;
    const status =
      !webhookRegistered && resolvedStatus !== MessagingConnectionStatus.connected
        ? MessagingConnectionStatus.provisioning
        : resolvedStatus;
    const shouldKeepQrPayload =
      status !== MessagingConnectionStatus.connected &&
      status !== MessagingConnectionStatus.disconnected;

    return await this.prisma.messagingConnection.update({
      where: {
        id: baseConnection.id,
      },
      data: {
        status,
        normalizedPhone:
          statusPayload.normalizedPhone ?? preparedInput.normalizedPhone,
        qrCodeData: shouldKeepQrPayload ? qrPayload.qrCodeData : null,
        pairingCode: shouldKeepQrPayload ? qrPayload.pairingCode : null,
        pairingExpiresAt:
          shouldKeepQrPayload && (qrPayload.qrCodeData || qrPayload.pairingCode)
            ? (qrPayload.expiresAt ?? this.inFiveMinutes())
            : null,
        metadataJson: this.buildMetadata(baseConnection.metadataJson, {
          lastKnownState: statusPayload.state,
          lastConnectResponse: qrPayload.raw,
          lastQrExpiresAt: qrPayload.expiresAt?.toISOString() ?? null,
          lastStatusResponse: statusPayload.raw,
          webhookRegistered,
          inboundWebhookUrl: connectionWebhookUrl,
          routingMode: this.evolutionClient.getRoutingMode(),
        }),
        lastSyncedAt: new Date(),
        lastConnectedAt:
          status === MessagingConnectionStatus.connected
            ? new Date()
            : baseConnection.lastConnectedAt,
        lastDisconnectedAt:
          status === MessagingConnectionStatus.disconnected
            ? new Date()
            : baseConnection.lastDisconnectedAt,
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });
  }

  private prepareConnectionInput(
    sponsor: MemberScopedSponsor,
    existingConnection: MessagingConnection | null,
    dto?: ConnectMemberMessagingDto,
  ): PreparedConnectionInput {
    const canonicalInstanceId = buildEvolutionInstanceId({
      prefix: this.evolutionClient.getInstancePrefix(),
      teamCode: sponsor.team.code,
      sponsorDisplayName: sponsor.displayName,
      sponsorId: sponsor.id,
    });
    const shouldReuseExistingInstanceId = Boolean(
      existingConnection?.externalInstanceId &&
        existingConnection.status === MessagingConnectionStatus.connected,
    );
    const instanceId = shouldReuseExistingInstanceId
      ? existingConnection!.externalInstanceId!
      : canonicalInstanceId;
    const submittedPhone =
      dto?.phone !== undefined ? sanitizeNullableText(dto.phone) : undefined;
    const phone =
      submittedPhone !== undefined
        ? submittedPhone
        : (existingConnection?.phone ?? sponsor.phone ?? null);
    const automationWebhookUrl = this.resolveAutomationWebhookUrl(
      existingConnection,
      dto,
      instanceId,
    );

    return {
      instanceId,
      phone,
      normalizedPhone: normalizeMessagingPhone(phone),
      automationWebhookUrl,
      automationEnabled: Boolean(automationWebhookUrl),
    };
  }

  private async upsertBaseConnection(
    scope: MemberMessagingScope,
    sponsor: MemberScopedSponsor,
    existingConnection: MessagingConnection | null,
    preparedInput: PreparedConnectionInput,
    status: MessagingConnectionStatus,
  ) {
    return await this.prisma.messagingConnection.upsert({
      where: {
        sponsorId: sponsor.id,
      },
      update: {
        provider: MessagingProvider.EVOLUTION,
        status,
        runtimeContextStatus: null,
        runtimeContextTenantId: scope.workspaceId,
        runtimeContextRegisteredAt: null,
        runtimeContextReadyAt: null,
        runtimeContextLastCheckedAt: null,
        runtimeContextLastErrorAt: null,
        runtimeContextLastErrorMessage: null,
        externalInstanceId: preparedInput.instanceId,
        phone: preparedInput.phone,
        normalizedPhone: preparedInput.normalizedPhone,
        automationWebhookUrl: preparedInput.automationWebhookUrl,
        automationEnabled: preparedInput.automationEnabled,
        qrCodeData:
          status === MessagingConnectionStatus.provisioning
            ? null
            : existingConnection?.qrCodeData,
        pairingCode:
          status === MessagingConnectionStatus.provisioning
            ? null
            : existingConnection?.pairingCode,
        pairingExpiresAt: null,
        lastSyncedAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: null,
      },
      create: {
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
        sponsorId: sponsor.id,
        provider: MessagingProvider.EVOLUTION,
        status,
        runtimeContextStatus: null,
        runtimeContextTenantId: scope.workspaceId,
        externalInstanceId: preparedInput.instanceId,
        phone: preparedInput.phone,
        normalizedPhone: preparedInput.normalizedPhone,
        automationWebhookUrl: preparedInput.automationWebhookUrl,
        automationEnabled: preparedInput.automationEnabled,
        lastSyncedAt: new Date(),
      },
    });
  }

  private async requireMemberSponsor(scope: MemberMessagingScope) {
    const sponsor = await this.prisma.sponsor.findFirst({
      where: {
        id: scope.sponsorId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
      include: {
        team: {
          select: {
            code: true,
          },
        },
      },
    });

    if (!sponsor) {
      throw new NotFoundException({
        code: 'SPONSOR_NOT_FOUND',
        message: 'The requested sponsor was not found for this member.',
      });
    }

    return sponsor;
  }

  private async findConnection(scope: MemberMessagingScope) {
    return await this.prisma.messagingConnection.findFirst({
      where: {
        sponsorId: scope.sponsorId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
    });
  }

  private buildDashboardDto(
    sponsor: MemberScopedSponsor,
    connection: MessagingConnection | null,
  ): SponsorDashboardDto {
    const status = this.resolveDashboardStatus(connection);
    const isConnected = status === 'READY';
    const qrExpired = isQrExpired(connection?.pairingExpiresAt);
    const blacklistSsoAvailable = Boolean(process.env.SSO_BLACKLIST_SECRET);

    return new SponsorDashboardDto({
      status,
      qrCode: isConnected || qrExpired ? null : connection?.qrCodeData ?? null,
      sponsorName: sponsor.displayName,
      sponsorPhone: sponsor.phone,
      isConnected,
      connectionStatus: connection?.status ?? null,
      qrExpiresAt: connection?.pairingExpiresAt?.toISOString() ?? null,
      qrExpired,
      blacklistSsoAvailable,
    });
  }

  private resolveDashboardStatus(
    connection: MessagingConnection | null,
  ): SponsorDashboardStatus {
    if (connection?.status === MessagingConnectionStatus.connected) {
      return 'READY';
    }

    if (
      connection?.status === MessagingConnectionStatus.qr_ready ||
      connection?.status === MessagingConnectionStatus.connecting
    ) {
      return 'REGISTERED';
    }

    return 'PROVISIONED';
  }

  private resolveAutomationWebhookUrl(
    existingConnection: MessagingConnection | null,
    dto: ConnectMemberMessagingDto | undefined,
    instanceId: string,
  ) {
    if (dto?.automationWebhookUrl !== undefined) {
      return sanitizeNullableText(dto.automationWebhookUrl);
    }

    if (existingConnection?.automationWebhookUrl) {
      return existingConnection.automationWebhookUrl;
    }

    return buildAutomationWebhookUrl(
      this.evolutionClient.getAutomationWebhookBaseUrl(),
      instanceId,
    );
  }

  private buildMetadata(
    currentMetadata: Prisma.JsonValue | null,
    patch: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    const metadata =
      currentMetadata &&
      typeof currentMetadata === 'object' &&
      !Array.isArray(currentMetadata)
        ? ({ ...currentMetadata } as Record<string, unknown>)
        : {};

    return {
      ...metadata,
      ...patch,
      updatedBy: 'leadflow-api',
    } as Prisma.InputJsonValue;
  }

  private async persistProviderError(input: {
    scope: MemberMessagingScope;
    sponsor: Sponsor;
    existingConnection: MessagingConnection | null;
    preparedInput: PreparedConnectionInput;
    message: string;
  }) {
    const updateData = {
      workspaceId: input.scope.workspaceId,
      teamId: input.scope.teamId,
      sponsorId: input.scope.sponsorId,
      provider: MessagingProvider.EVOLUTION,
      status: MessagingConnectionStatus.error,
      externalInstanceId: input.preparedInput.instanceId,
      phone: input.preparedInput.phone,
      normalizedPhone: input.preparedInput.normalizedPhone,
      automationWebhookUrl: input.preparedInput.automationWebhookUrl,
      automationEnabled: input.preparedInput.automationEnabled,
      lastSyncedAt: new Date(),
      lastErrorAt: new Date(),
      lastErrorMessage: input.message,
    };

    await this.prisma.messagingConnection.upsert({
      where: {
        sponsorId: input.sponsor.id,
      },
      update: updateData,
      create: {
        ...updateData,
        runtimeContextStatus: null,
        runtimeContextTenantId: input.scope.workspaceId,
      },
    });
  }

  private extractErrorMessage(error: unknown) {
    if (error instanceof EvolutionApiClientError) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown messaging integration error.';
  }

  private ensureProviderConfigured() {
    if (this.evolutionClient.isConfigured()) {
      return;
    }

    throw new ServiceUnavailableException({
      code: 'EVOLUTION_NOT_CONFIGURED',
      message:
        'Evolution API is not configured yet. The WhatsApp fallback via wa.me remains active.',
    });
  }

  private toHttpException(error: unknown) {
    if (error instanceof EvolutionApiClientError) {
      if (error.status === 410) {
        return new GoneException({
          code: 'EVOLUTION_QR_EXPIRED',
          message: error.message,
          details: error.details ?? null,
        });
      }

      if (error.status === 503) {
        return new ServiceUnavailableException({
          code: 'EVOLUTION_UNAVAILABLE',
          message:
            'Evolution API is unavailable or not configured. The commercial fallback via wa.me remains active.',
          details: error.details ?? null,
        });
      }

      if (error.status === 408 || error.status === 504) {
        return new GatewayTimeoutException({
          code: 'EVOLUTION_TIMEOUT',
          message: error.message,
          details: error.details ?? null,
        });
      }

      return new BadGatewayException({
        code: 'EVOLUTION_UPSTREAM_ERROR',
        message: error.message,
        details: error.details ?? null,
      });
    }

    return new BadGatewayException({
      code: 'MESSAGING_INTEGRATION_ERROR',
      message: this.extractErrorMessage(error),
    });
  }

  private inFiveMinutes() {
    return new Date(Date.now() + 5 * 60 * 1000);
  }

  private async fetchQrWithRecovery(input: {
    instanceId: string;
    webhookUrl: string | null;
  }) {
    try {
      return await this.evolutionClient.fetchQr(input.instanceId);
    } catch (error) {
      if (
        error instanceof EvolutionApiClientError &&
        (error.status === 404 || error.status === 410)
      ) {
        const healed = await this.selfHealMissingInstance({
          instanceId: input.instanceId,
          webhookUrl: input.webhookUrl,
          fetchQr: true,
          recreate: error.status === 410,
        });

        if (healed.qrPayload) {
          return healed.qrPayload;
        }
      }

      throw error;
    }
  }

  private async selfHealMissingInstance(input: {
    instanceId: string;
    webhookUrl: string | null;
    fetchQr: boolean;
    recreate?: boolean;
  }) {
    if (input.recreate) {
      await this.recreateQrSession(input.instanceId, input.webhookUrl);
    } else {
      await this.ensureEvolutionInstanceSession(
        input.instanceId,
        input.webhookUrl,
      );
    }

    return {
      qrPayload: input.fetchQr
        ? await this.evolutionClient.fetchQr(input.instanceId)
        : null,
      state: await this.evolutionClient.getConnectionState(input.instanceId),
    };
  }

  private async recreateQrSession(
    instanceId: string,
    webhookUrl: string | null,
  ) {
    await this.evolutionClient.recreateInstance(instanceId);
    await this.evolutionClient.setWebhook(instanceId, webhookUrl);
  }

  private async ensureEvolutionInstanceSession(
    instanceId: string,
    webhookUrl: string | null,
  ) {
    await this.evolutionClient.createInstance(instanceId);
    await this.evolutionClient.ensureInstanceExists(instanceId);
    await this.evolutionClient.setWebhook(instanceId, webhookUrl);
  }
}
