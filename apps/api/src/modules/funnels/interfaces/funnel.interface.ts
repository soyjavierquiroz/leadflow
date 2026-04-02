import type { CreateFunnelDto } from '../dto/create-funnel.dto';
import type {
  BaseDomainEntity,
  DomainId,
  JsonValue,
  LeadSourceChannel,
  RepositoryPort,
  WorkspaceScoped,
} from '../../shared/domain.types';

export type FunnelStatus = 'draft' | 'active' | 'archived';

export interface Funnel extends BaseDomainEntity, WorkspaceScoped {
  name: string;
  description: string | null;
  code: string;
  thumbnailUrl: string | null;
  config: JsonValue;
  status: FunnelStatus;
  isTemplate: boolean;
  stages: string[];
  entrySources: LeadSourceChannel[];
  defaultTeamId: DomainId | null;
  defaultRotationPoolId: DomainId | null;
}

export interface FunnelRepository extends RepositoryPort<
  Funnel,
  CreateFunnelDto
> {
  findAll(): Promise<Funnel[]>;
  findByWorkspaceId(workspaceId: DomainId): Promise<Funnel[]>;
}
