import type { CreateSponsorDto } from '../dto/create-sponsor.dto';
import type {
  AvailabilityStatus,
  BaseDomainEntity,
  DomainId,
  RepositoryPort,
  WorkspaceScoped,
} from '../../shared/domain.types';

export type SponsorStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface Sponsor extends BaseDomainEntity, WorkspaceScoped {
  teamId: DomainId;
  displayName: string;
  status: SponsorStatus;
  email: string | null;
  phone: string | null;
  availabilityStatus: AvailabilityStatus;
  routingWeight: number;
  memberPortalEnabled: boolean;
}

export interface SponsorRepository extends RepositoryPort<
  Sponsor,
  CreateSponsorDto
> {
  findByTeamId(teamId: DomainId): Promise<Sponsor[]>;
}
