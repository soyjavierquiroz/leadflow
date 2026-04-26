export type SystemTenantProvisioningStatus = 'active' | 'suspended' | 'pending';

export class UpdateSystemTenantDto {
  readonly tenantName?: string;
  readonly adminEmail!: string;
  readonly subdomain!: string;
  readonly provisioningStatus!: SystemTenantProvisioningStatus;
}
