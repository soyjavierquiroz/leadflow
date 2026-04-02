export class ProvisionTenantDto {
  readonly workspaceId?: string | null;
  readonly workspaceName?: string;
  readonly workspaceSlug?: string;
  readonly workspaceTimezone?: string;
  readonly workspaceDefaultCurrency?: string;
  readonly workspacePrimaryLocale?: string;
  readonly workspacePrimaryDomain?: string | null;
  readonly teamName?: string;
  readonly teamCode?: string;
  readonly teamDescription?: string;
  readonly maxSeats?: number;
  readonly adminName?: string;
  readonly adminFullName?: string;
  readonly adminEmail!: string;
  readonly adminPassword?: string;
  readonly adminRole?: 'TEAM_ADMIN' | 'SUPER_ADMIN';
  readonly sponsorDisplayName?: string;
  readonly sponsorEmail?: string | null;
  readonly sponsorPhone?: string | null;
  readonly templateFunnelId?: string | null;
}
