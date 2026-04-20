import type { MessagingConnectionStatus } from '@prisma/client';

export type SponsorDashboardStatus = 'PROVISIONED' | 'REGISTERED' | 'READY';

export class SponsorDashboardDto {
  readonly status: SponsorDashboardStatus;
  readonly qrCode: string | null;
  readonly sponsorName: string;
  readonly isConnected: boolean;
  readonly connectionStatus: MessagingConnectionStatus | null;
  readonly qrExpiresAt: string | null;
  readonly qrExpired: boolean;

  constructor(input: {
    status: SponsorDashboardStatus;
    qrCode: string | null;
    sponsorName: string;
    isConnected: boolean;
    connectionStatus: MessagingConnectionStatus | null;
    qrExpiresAt: string | null;
    qrExpired: boolean;
  }) {
    this.status = input.status;
    this.qrCode = input.qrCode;
    this.sponsorName = input.sponsorName;
    this.isConnected = input.isConnected;
    this.connectionStatus = input.connectionStatus;
    this.qrExpiresAt = input.qrExpiresAt;
    this.qrExpired = input.qrExpired;
  }
}
