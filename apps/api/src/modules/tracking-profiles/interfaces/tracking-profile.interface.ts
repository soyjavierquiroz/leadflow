import type { CreateTrackingProfileDto } from '../dto/create-tracking-profile.dto';
import type {
  BaseDomainEntity,
  DeduplicationMode,
  DomainId,
  JsonValue,
  RepositoryPort,
  TeamScoped,
  TrackingProvider,
  WorkspaceScoped,
} from '../../shared/domain.types';

export type TrackingProfileStatus = 'draft' | 'active' | 'archived';

export interface TrackingProfile
  extends BaseDomainEntity, WorkspaceScoped, TeamScoped {
  name: string;
  provider: TrackingProvider;
  status: TrackingProfileStatus;
  configJson: JsonValue;
  deduplicationMode: DeduplicationMode;
  conversionEventMappingIds: DomainId[];
}

export interface TrackingProfileRepository extends RepositoryPort<
  TrackingProfile,
  CreateTrackingProfileDto
> {
  findAll(): Promise<TrackingProfile[]>;
  findByWorkspaceId(workspaceId: DomainId): Promise<TrackingProfile[]>;
  findByTeamId(teamId: DomainId): Promise<TrackingProfile[]>;
}
