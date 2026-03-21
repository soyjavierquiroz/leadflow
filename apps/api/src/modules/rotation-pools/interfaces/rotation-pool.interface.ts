import type { CreateRotationPoolDto } from '../dto/create-rotation-pool.dto';
import type {
  BaseDomainEntity,
  DomainId,
  RepositoryPort,
  RotationStrategy,
  WorkspaceScoped,
} from '../../shared/domain.types';

export type RotationPoolStatus = 'draft' | 'active' | 'archived';

export interface RotationPool extends BaseDomainEntity, WorkspaceScoped {
  teamId: DomainId;
  name: string;
  status: RotationPoolStatus;
  strategy: RotationStrategy;
  sponsorIds: DomainId[];
  funnelIds: DomainId[];
  isFallbackPool: boolean;
}

export interface RotationPoolRepository extends RepositoryPort<
  RotationPool,
  CreateRotationPoolDto
> {
  findByTeamId(teamId: DomainId): Promise<RotationPool[]>;
}
