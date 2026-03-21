import type { CreateTeamDto } from '../dto/create-team.dto';
import type {
  BaseDomainEntity,
  DomainId,
  RepositoryPort,
  WorkspaceScoped,
} from '../../shared/domain.types';

export type TeamStatus = 'draft' | 'active' | 'archived';

export interface Team extends BaseDomainEntity, WorkspaceScoped {
  name: string;
  code: string;
  status: TeamStatus;
  description: string | null;
  managerUserId: DomainId | null;
  sponsorIds: DomainId[];
  funnelIds: DomainId[];
  rotationPoolIds: DomainId[];
}

export interface TeamRepository extends RepositoryPort<Team, CreateTeamDto> {
  findByWorkspaceId(workspaceId: DomainId): Promise<Team[]>;
}
