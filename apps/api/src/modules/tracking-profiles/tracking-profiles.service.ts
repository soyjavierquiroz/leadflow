import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { TRACKING_PROFILE_REPOSITORY } from '../shared/domain.tokens';
import type { CreateTrackingProfileDto } from './dto/create-tracking-profile.dto';
import type {
  TrackingProfile,
  TrackingProfileRepository,
} from './interfaces/tracking-profile.interface';

@Injectable()
export class TrackingProfilesService {
  constructor(
    @Optional()
    @Inject(TRACKING_PROFILE_REPOSITORY)
    private readonly repository?: TrackingProfileRepository,
  ) {}

  createDraft(dto: CreateTrackingProfileDto): TrackingProfile {
    return buildEntity<TrackingProfile>({
      workspaceId: dto.workspaceId,
      teamId: dto.teamId,
      name: dto.name,
      provider: dto.provider,
      status: 'draft',
      configJson: dto.configJson,
      deduplicationMode: dto.deduplicationMode ?? 'browser_server',
      conversionEventMappingIds: [],
    });
  }
}
