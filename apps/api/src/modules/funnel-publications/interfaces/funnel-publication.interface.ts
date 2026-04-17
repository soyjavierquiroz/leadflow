import type { CreateFunnelPublicationDto } from '../dto/create-funnel-publication.dto';
import type {
  BaseDomainEntity,
  DomainId,
  RepositoryPort,
  TeamScoped,
  WorkspaceScoped,
} from '../../shared/domain.types';

export type FunnelPublicationStatus = 'draft' | 'active' | 'archived';

export interface FunnelPublication
  extends BaseDomainEntity, WorkspaceScoped, TeamScoped {
  domainId: DomainId;
  funnelInstanceId: DomainId;
  trackingProfileId: DomainId | null;
  handoffStrategyId: DomainId | null;
  metaPixelId: string | null;
  tiktokPixelId: string | null;
  metaCapiToken: string | null;
  tiktokAccessToken: string | null;
  pathPrefix: string;
  status: FunnelPublicationStatus;
  isActive: boolean;
  isPrimary: boolean;
}

export interface FunnelPublicationRepository extends RepositoryPort<
  FunnelPublication,
  CreateFunnelPublicationDto
> {
  findAll(): Promise<FunnelPublication[]>;
  findByWorkspaceId(workspaceId: DomainId): Promise<FunnelPublication[]>;
  findByTeamId(teamId: DomainId): Promise<FunnelPublication[]>;
  findByDomainId(domainId: DomainId): Promise<FunnelPublication[]>;
}
