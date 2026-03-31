import type {
  MessagingConnectionStatus,
  MessagingRuntimeContextStatus,
  MessagingProvider,
} from '@prisma/client';
import type { ISODateString } from '../shared/domain.types';

export type MessagingConnectionView = {
  id: string;
  workspaceId: string;
  teamId: string;
  sponsorId: string;
  provider: MessagingProvider;
  status: MessagingConnectionStatus;
  runtimeContextStatus: MessagingRuntimeContextStatus | null;
  runtimeContextTenantId: string | null;
  instanceId: string | null;
  externalInstanceId: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  qrCodeData: string | null;
  pairingCode: string | null;
  pairingExpiresAt: ISODateString | null;
  automationWebhookUrl: string | null;
  automationEnabled: boolean;
  metadata: unknown;
  lastSyncedAt: ISODateString | null;
  runtimeContextRegisteredAt: ISODateString | null;
  runtimeContextReadyAt: ISODateString | null;
  runtimeContextLastCheckedAt: ISODateString | null;
  runtimeContextLastErrorAt: ISODateString | null;
  runtimeContextLastErrorMessage: string | null;
  lastConnectedAt: ISODateString | null;
  lastDisconnectedAt: ISODateString | null;
  lastErrorAt: ISODateString | null;
  lastErrorMessage: string | null;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type MessagingProviderState = {
  provider: MessagingProvider;
  configured: boolean;
  internalConfigured: boolean;
  publicFallbackConfigured: boolean;
  routingMode: 'internal' | 'public' | 'unconfigured';
  instancePrefix: string;
  automationBaseConfigured: boolean;
  fallbackWaMeEnabled: boolean;
  webhookEvent: string;
  note: string | null;
};

export type MessagingIntegrationSnapshot = {
  connection: MessagingConnectionView | null;
  provider: MessagingProviderState;
};
