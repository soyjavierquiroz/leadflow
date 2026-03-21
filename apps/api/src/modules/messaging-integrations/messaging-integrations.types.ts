import type {
  MessagingConnectionStatus,
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
  instancePrefix: string;
  automationBaseConfigured: boolean;
  fallbackWaMeEnabled: boolean;
  note: string | null;
};

export type MessagingIntegrationSnapshot = {
  connection: MessagingConnectionView | null;
  provider: MessagingProviderState;
};
