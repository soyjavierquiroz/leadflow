import { Module } from '@nestjs/common';
import { TrackingProfilePrismaRepository } from '../../prisma/repositories/tracking-profile-prisma.repository';
import { TRACKING_PROFILE_REPOSITORY } from '../shared/domain.tokens';
import { TrackingProfilesController } from './tracking-profiles.controller';
import { TrackingProfilesService } from './tracking-profiles.service';

@Module({
  controllers: [TrackingProfilesController],
  providers: [
    TrackingProfilesService,
    TrackingProfilePrismaRepository,
    {
      provide: TRACKING_PROFILE_REPOSITORY,
      useExisting: TrackingProfilePrismaRepository,
    },
  ],
  exports: [TrackingProfilesService, TRACKING_PROFILE_REPOSITORY],
})
export class TrackingProfilesModule {}
