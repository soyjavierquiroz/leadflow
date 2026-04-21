import type { MessagingConnectionStatus } from '@prisma/client';

export type SponsorDashboardStatus = 'PROVISIONED' | 'REGISTERED' | 'READY';

export class SponsorDashboardDto {
  readonly status: SponsorDashboardStatus;
  readonly qrCode: string | null;
  readonly sponsorName: string;
  readonly sponsorPhone: string | null;
  readonly isConnected: boolean;
  readonly connectionStatus: MessagingConnectionStatus | null;
  readonly qrExpiresAt: string | null;
  readonly qrExpired: boolean;
  readonly blacklistSsoAvailable: boolean;

  constructor(input: {
    status: SponsorDashboardStatus;
    qrCode: string | null;
    sponsorName: string;
    sponsorPhone: string | null;
    isConnected: boolean;
    connectionStatus: MessagingConnectionStatus | null;
    qrExpiresAt: string | null;
    qrExpired: boolean;
    blacklistSsoAvailable: boolean;
  }) {
    this.status = input.status;
    this.qrCode = input.qrCode;
    this.sponsorName = input.sponsorName;
    this.sponsorPhone = input.sponsorPhone;
    this.isConnected = input.isConnected;
    this.connectionStatus = input.connectionStatus;
    this.qrExpiresAt = input.qrExpiresAt;
    this.qrExpired = input.qrExpired;
    this.blacklistSsoAvailable = input.blacklistSsoAvailable;
  }
}
