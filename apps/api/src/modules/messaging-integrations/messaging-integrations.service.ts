import {
  BadGatewayException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  MessagingConnectionStatus,
  MessagingProvider,
  type Prisma,
  type MessagingConnection,
  type Sponsor,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EvolutionApiClient,
  EvolutionApiClientError,
} from './evolution-api.client';
import type {
  MessagingConnectionView,
  MessagingIntegrationSnapshot,
} from './messaging-integrations.types';
import {
  buildAutomationWebhookUrl,
  buildEvolutionInstanceId,
  normalizeMessagingPhone,
  resolveMessagingConnectionStatus,
  sanitizeNullableText,
} from './messaging-integrations.utils';
import type { ConnectMemberMessagingDto } from './dto/connect-member-messaging.dto';

type MemberMessagingScope = {
  workspaceId: string;
  teamId: string;
  sponsorId: string;
};

const toIso = (value: Date | null) => (value ? value.toISOString() : null);

@Injectable()
export class MessagingIntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evolutionClient: EvolutionApiClient,
  ) {}

  async getCurrentForMember(
    scope: MemberMessagingScope,
  ): Promise<MessagingIntegrationSnapshot> {
    const sponsor = await this.requireMemberSponsor(scope);
    const connection = await this.findConnection(scope);

    return this.buildSnapshot(connection, {
      note: this.buildProviderNote(connection),
      sponsor,
    });
  }

  async connectForMember(
    scope: MemberMessagingScope,
    dto: ConnectMemberMessagingDto,
  ): Promise<MessagingIntegrationSnapshot> {
    if (!this.evolutionClient.isConfigured()) {
      throw new ServiceUnavailableException({
        code: 'EVOLUTION_NOT_CONFIGURED',
        message:
          'Evolution API is not configured yet. The WhatsApp fallback via wa.me remains active.',
      });
    }

    const sponsor = await this.requireMemberSponsor(scope);
    const existingConnection = await this.findConnection(scope);
    const externalInstanceId =
      existingConnection?.externalInstanceId ??
      buildEvolutionInstanceId({
        prefix: this.evolutionClient.getInstancePrefix(),
        teamCode: sponsor.team.code,
        sponsorDisplayName: sponsor.displayName,
        sponsorId: sponsor.id,
      });

    const submittedPhone =
      dto.phone !== undefined ? sanitizeNullableText(dto.phone) : undefined;
    const phone =
      submittedPhone !== undefined
        ? submittedPhone
        : (existingConnection?.phone ?? sponsor.phone ?? null);
    const automationWebhookUrl = this.resolveAutomationWebhookUrl(
      existingConnection,
      dto,
      externalInstanceId,
    );

    try {
      await this.evolutionClient.createInstance(externalInstanceId);
      await this.evolutionClient.setWebhook(
        externalInstanceId,
        automationWebhookUrl,
      );

      const connectPayload =
        await this.evolutionClient.connectInstance(externalInstanceId);
      const statusPayload =
        await this.evolutionClient.getConnectionState(externalInstanceId);
      const status = resolveMessagingConnectionStatus({
        state: statusPayload.state,
        qrCodeData: connectPayload.qrCodeData,
        pairingCode: connectPayload.pairingCode,
      });

      const connection = await this.prisma.messagingConnection.upsert({
        where: {
          sponsorId: sponsor.id,
        },
        update: {
          provider: MessagingProvider.EVOLUTION,
          status,
          externalInstanceId,
          phone,
          normalizedPhone:
            statusPayload.normalizedPhone ?? normalizeMessagingPhone(phone),
          qrCodeData:
            status === 'connected' ? null : (connectPayload.qrCodeData ?? null),
          pairingCode:
            status === 'connected'
              ? null
              : (connectPayload.pairingCode ?? null),
          pairingExpiresAt: status === 'qr_ready' ? this.inFiveMinutes() : null,
          automationWebhookUrl,
          automationEnabled: Boolean(automationWebhookUrl),
          metadataJson: {
            lastKnownState: statusPayload.state,
            lastConnectResponse: connectPayload.raw as Prisma.JsonValue,
            lastStatusResponse: statusPayload.raw as Prisma.JsonValue,
          },
          lastSyncedAt: new Date(),
          lastConnectedAt:
            status === 'connected'
              ? new Date()
              : existingConnection?.lastConnectedAt,
          lastErrorAt: null,
          lastErrorMessage: null,
        },
        create: {
          workspaceId: sponsor.workspaceId,
          teamId: sponsor.teamId,
          sponsorId: sponsor.id,
          provider: MessagingProvider.EVOLUTION,
          status,
          externalInstanceId,
          phone,
          normalizedPhone:
            statusPayload.normalizedPhone ?? normalizeMessagingPhone(phone),
          qrCodeData:
            status === 'connected' ? null : (connectPayload.qrCodeData ?? null),
          pairingCode:
            status === 'connected'
              ? null
              : (connectPayload.pairingCode ?? null),
          pairingExpiresAt: status === 'qr_ready' ? this.inFiveMinutes() : null,
          automationWebhookUrl,
          automationEnabled: Boolean(automationWebhookUrl),
          metadataJson: {
            lastKnownState: statusPayload.state,
            lastConnectResponse: connectPayload.raw as Prisma.JsonValue,
            lastStatusResponse: statusPayload.raw as Prisma.JsonValue,
          },
          lastSyncedAt: new Date(),
          lastConnectedAt: status === 'connected' ? new Date() : null,
        },
      });

      return this.buildSnapshot(connection, {
        note: null,
        sponsor,
      });
    } catch (error) {
      await this.persistProviderError({
        scope,
        sponsor,
        existingConnection,
        externalInstanceId,
        phone,
        automationWebhookUrl,
        message: this.extractErrorMessage(error),
      });

      throw this.toHttpException(error);
    }
  }

  async refreshForMember(
    scope: MemberMessagingScope,
  ): Promise<MessagingIntegrationSnapshot> {
    const sponsor = await this.requireMemberSponsor(scope);
    const existingConnection = await this.findConnection(scope);

    if (!existingConnection) {
      return this.buildSnapshot(null, {
        note: this.buildProviderNote(null),
        sponsor,
      });
    }

    if (
      !this.evolutionClient.isConfigured() ||
      !existingConnection.externalInstanceId
    ) {
      return this.buildSnapshot(existingConnection, {
        note: this.buildProviderNote(existingConnection),
        sponsor,
      });
    }

    try {
      const statusPayload = await this.evolutionClient.getConnectionState(
        existingConnection.externalInstanceId,
      );

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
            status === 'connected' ? null : existingConnection.qrCodeData,
          pairingCode:
            status === 'connected' ? null : existingConnection.pairingCode,
          pairingExpiresAt: status === 'qr_ready' ? this.inFiveMinutes() : null,
          metadataJson: {
            lastKnownState: statusPayload.state,
            lastStatusResponse: statusPayload.raw as Prisma.JsonValue,
          },
          lastSyncedAt: new Date(),
          lastConnectedAt:
            status === 'connected'
              ? (existingConnection.lastConnectedAt ?? new Date())
              : existingConnection.lastConnectedAt,
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });

      return this.buildSnapshot(connection, {
        note: null,
        sponsor,
      });
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

  async disconnectForMember(
    scope: MemberMessagingScope,
  ): Promise<MessagingIntegrationSnapshot> {
    const sponsor = await this.requireMemberSponsor(scope);
    const existingConnection = await this.findConnection(scope);

    if (!existingConnection) {
      return this.buildSnapshot(null, {
        note: this.buildProviderNote(null),
        sponsor,
      });
    }

    let note: string | null = null;

    if (
      this.evolutionClient.isConfigured() &&
      existingConnection.externalInstanceId
    ) {
      try {
        await this.evolutionClient.deleteInstance(
          existingConnection.externalInstanceId,
        );
      } catch (error) {
        note =
          'La conexión local quedó desactivada, pero Evolution devolvió un error al limpiar la instancia remota.';

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
    } else if (!this.evolutionClient.isConfigured()) {
      note =
        'La conexión quedó desactivada localmente. Evolution no está configurado en este entorno.';
    }

    const connection = await this.prisma.messagingConnection.update({
      where: {
        id: existingConnection.id,
      },
      data: {
        status: MessagingConnectionStatus.disconnected,
        qrCodeData: null,
        pairingCode: null,
        pairingExpiresAt: null,
        lastSyncedAt: new Date(),
        lastDisconnectedAt: new Date(),
      },
    });

    return this.buildSnapshot(connection, {
      note,
      sponsor,
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
    return this.prisma.messagingConnection.findFirst({
      where: {
        sponsorId: scope.sponsorId,
        workspaceId: scope.workspaceId,
        teamId: scope.teamId,
      },
    });
  }

  private buildSnapshot(
    connection: MessagingConnection | null,
    input: {
      note: string | null;
      sponsor: Sponsor & {
        team: {
          code: string;
        };
      };
    },
  ): MessagingIntegrationSnapshot {
    return {
      connection: connection ? this.mapConnection(connection) : null,
      provider: {
        provider: MessagingProvider.EVOLUTION,
        configured: this.evolutionClient.isConfigured(),
        instancePrefix: this.evolutionClient.getInstancePrefix(),
        automationBaseConfigured:
          this.evolutionClient.hasAutomationWebhookBaseUrl(),
        fallbackWaMeEnabled: true,
        note: input.note,
      },
    };
  }

  private mapConnection(
    connection: MessagingConnection,
  ): MessagingConnectionView {
    return {
      id: connection.id,
      workspaceId: connection.workspaceId,
      teamId: connection.teamId,
      sponsorId: connection.sponsorId,
      provider: connection.provider,
      status: connection.status,
      externalInstanceId: connection.externalInstanceId,
      phone: connection.phone,
      normalizedPhone: connection.normalizedPhone,
      qrCodeData: connection.qrCodeData,
      pairingCode: connection.pairingCode,
      pairingExpiresAt: toIso(connection.pairingExpiresAt),
      automationWebhookUrl: connection.automationWebhookUrl,
      automationEnabled: connection.automationEnabled,
      metadata: connection.metadataJson ?? null,
      lastSyncedAt: toIso(connection.lastSyncedAt),
      lastConnectedAt: toIso(connection.lastConnectedAt),
      lastDisconnectedAt: toIso(connection.lastDisconnectedAt),
      lastErrorAt: toIso(connection.lastErrorAt),
      lastErrorMessage: connection.lastErrorMessage,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
    };
  }

  private resolveAutomationWebhookUrl(
    existingConnection: MessagingConnection | null,
    dto: ConnectMemberMessagingDto,
    externalInstanceId: string,
  ) {
    if (dto.automationWebhookUrl !== undefined) {
      return sanitizeNullableText(dto.automationWebhookUrl);
    }

    if (existingConnection?.automationWebhookUrl) {
      return existingConnection.automationWebhookUrl;
    }

    return buildAutomationWebhookUrl(
      this.evolutionClient.getAutomationWebhookBaseUrl(),
      externalInstanceId,
    );
  }

  private buildProviderNote(connection: MessagingConnection | null) {
    if (!this.evolutionClient.isConfigured()) {
      return connection
        ? 'Evolution no está configurado en este entorno. Se muestra el último estado persistido y el fallback comercial sigue usando wa.me.'
        : 'Evolution no está configurado en este entorno. El handoff sigue funcionando vía wa.me.';
    }

    return null;
  }

  private async persistProviderError(input: {
    scope: MemberMessagingScope;
    sponsor: Sponsor;
    existingConnection: MessagingConnection | null;
    externalInstanceId: string;
    phone: string | null;
    automationWebhookUrl: string | null;
    message: string;
  }) {
    const data = {
      workspaceId: input.scope.workspaceId,
      teamId: input.scope.teamId,
      sponsorId: input.scope.sponsorId,
      provider: MessagingProvider.EVOLUTION,
      status: MessagingConnectionStatus.error,
      externalInstanceId: input.externalInstanceId,
      phone: input.phone,
      normalizedPhone: normalizeMessagingPhone(input.phone),
      automationWebhookUrl: input.automationWebhookUrl,
      automationEnabled: Boolean(input.automationWebhookUrl),
      lastSyncedAt: new Date(),
      lastErrorAt: new Date(),
      lastErrorMessage: input.message,
    };

    if (input.existingConnection) {
      await this.prisma.messagingConnection.update({
        where: {
          id: input.existingConnection.id,
        },
        data,
      });

      return;
    }

    await this.prisma.messagingConnection.create({
      data,
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

  private toHttpException(error: unknown) {
    if (error instanceof EvolutionApiClientError) {
      if (error.status === 503) {
        return new ServiceUnavailableException({
          code: 'EVOLUTION_UNAVAILABLE',
          message:
            'Evolution API is unavailable or not configured. The commercial fallback via wa.me remains active.',
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
}
