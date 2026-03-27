import type { CreateDomainDto } from '../dto/create-domain.dto';
import type {
  BaseDomainEntity,
  DomainId,
  DomainOnboardingStatus,
  DomainSslStatus,
  DomainType,
  DomainVerificationMethod,
  DomainVerificationStatus,
  JsonValue,
  RepositoryPort,
  TeamScoped,
  WorkspaceScoped,
} from '../../shared/domain.types';

export type DomainStatus = 'draft' | 'active' | 'archived';

export interface DomainEntity
  extends BaseDomainEntity, WorkspaceScoped, TeamScoped {
  host: string;
  normalizedHost: string;
  status: DomainStatus;
  onboardingStatus: DomainOnboardingStatus;
  domainType: DomainType;
  isPrimary: boolean;
  canonicalHost: string | null;
  redirectToPrimary: boolean;
  verificationStatus: DomainVerificationStatus;
  sslStatus: DomainSslStatus;
  verificationMethod: DomainVerificationMethod;
  cloudflareCustomHostnameId: string | null;
  cloudflareStatusJson: JsonValue | null;
  dnsTarget: string | null;
  lastCloudflareSyncAt: string | null;
  activatedAt: string | null;
}

export interface DomainDnsInstruction {
  id: string;
  type: 'cname' | 'txt' | 'http' | 'info';
  host: string | null;
  value: string;
  status: 'required' | 'optional' | 'managed' | 'pending_support';
  label: string;
  detail: string | null;
}

export interface DomainSummary extends DomainEntity {
  requestedHostname: string;
  cnameTarget: string | null;
  fallbackOrigin: string | null;
  cloudflareHostnameStatus: string | null;
  cloudflareSslStatus: string | null;
  cloudflareErrorMessage: string | null;
  dnsInstructions: DomainDnsInstruction[];
}

export interface DomainRepository extends RepositoryPort<
  DomainEntity,
  CreateDomainDto
> {
  findAll(): Promise<DomainEntity[]>;
  findByWorkspaceId(workspaceId: DomainId): Promise<DomainEntity[]>;
  findByTeamId(teamId: DomainId): Promise<DomainEntity[]>;
  findByHost(host: string): Promise<DomainEntity | null>;
}
