export type SponsorDashboardStatus = 'PROVISIONED' | 'REGISTERED' | 'READY';

export class SponsorDashboardDto {
  readonly status: SponsorDashboardStatus;
  readonly qrCode: string | null;
  readonly sponsorName: string;
  readonly isConnected: boolean;

  constructor(input: {
    status: SponsorDashboardStatus;
    qrCode: string | null;
    sponsorName: string;
    isConnected: boolean;
  }) {
    this.status = input.status;
    this.qrCode = input.qrCode;
    this.sponsorName = input.sponsorName;
    this.isConnected = input.isConnected;
  }
}
