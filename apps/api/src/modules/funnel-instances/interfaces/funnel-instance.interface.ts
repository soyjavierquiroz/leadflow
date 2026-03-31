import type { CreateFunnelInstanceDto } from '../dto/create-funnel-instance.dto';
import type {
  BaseDomainEntity,
  DomainId,
  JsonValue,
  RepositoryPort,
  TeamScoped,
  WorkspaceScoped,
} from '../../shared/domain.types';

export type FunnelInstanceStatus = 'draft' | 'active' | 'archived';

export interface FunnelInstance
  extends BaseDomainEntity, WorkspaceScoped, TeamScoped {
  templateId: DomainId;
  legacyFunnelId: DomainId | null;
  name: string;
  code: string;
  thumbnailUrl: string | null;
  status: FunnelInstanceStatus;
  rotationPoolId: DomainId | null;
  trackingProfileId: DomainId | null;
  handoffStrategyId: DomainId | null;
  settingsJson: JsonValue;
  mediaMap: JsonValue;
  stepIds: DomainId[];
  publicationIds: DomainId[];
}

export interface FunnelInstanceRepository extends RepositoryPort<
  FunnelInstance,
  CreateFunnelInstanceDto
> {
  findAll(): Promise<FunnelInstance[]>;
  findByWorkspaceId(workspaceId: DomainId): Promise<FunnelInstance[]>;
  findByTeamId(teamId: DomainId): Promise<FunnelInstance[]>;
}
