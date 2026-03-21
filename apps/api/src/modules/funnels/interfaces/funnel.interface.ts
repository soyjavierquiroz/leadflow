import type { CreateFunnelDto } from '../dto/create-funnel.dto';
import type {
  BaseDomainEntity,
  DomainId,
  LeadSourceChannel,
  RepositoryPort,
  WorkspaceScoped,
} from '../../shared/domain.types';

export type FunnelStatus = 'draft' | 'active' | 'archived';

export interface Funnel extends BaseDomainEntity, WorkspaceScoped {
  name: string;
  code: string;
  status: FunnelStatus;
  stages: string[];
  entrySources: LeadSourceChannel[];
  defaultTeamId: DomainId | null;
  defaultRotationPoolId: DomainId | null;
}

export interface FunnelRepository extends RepositoryPort<
  Funnel,
  CreateFunnelDto
> {
  findByWorkspaceId(workspaceId: DomainId): Promise<Funnel[]>;
}
