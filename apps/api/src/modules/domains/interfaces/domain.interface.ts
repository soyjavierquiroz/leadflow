import type { CreateDomainDto } from '../dto/create-domain.dto';
import type {
  BaseDomainEntity,
  DomainId,
  DomainKind,
  RepositoryPort,
  TeamScoped,
  WorkspaceScoped,
} from '../../shared/domain.types';

export type DomainStatus = 'draft' | 'active' | 'archived';

export interface DomainEntity
  extends BaseDomainEntity, WorkspaceScoped, TeamScoped {
  host: string;
  status: DomainStatus;
  kind: DomainKind;
  isPrimary: boolean;
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
