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
  logoUrl: string | null;
  status: TeamStatus;
  isActive: boolean;
  subscriptionExpiresAt: string | null;
  description: string | null;
  managerUserId: DomainId | null;
  maxSeats: number;
  sponsorIds: DomainId[];
  funnelIds: DomainId[];
  domainIds: DomainId[];
  funnelInstanceIds: DomainId[];
  funnelPublicationIds: DomainId[];
  trackingProfileIds: DomainId[];
  handoffStrategyIds: DomainId[];
  rotationPoolIds: DomainId[];
}

export interface TeamRepository extends RepositoryPort<Team, CreateTeamDto> {
  findAll(): Promise<Team[]>;
  findByWorkspaceId(workspaceId: DomainId): Promise<Team[]>;
}
