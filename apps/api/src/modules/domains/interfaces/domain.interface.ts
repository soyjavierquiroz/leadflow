import type { CreateDomainDto } from '../dto/create-domain.dto';
import type {
  BaseDomainEntity,
  DomainId,
  DomainType,
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
  domainType: DomainType;
  isPrimary: boolean;
  canonicalHost: string | null;
  redirectToPrimary: boolean;
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
