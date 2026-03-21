import { Module } from '@nestjs/common';
import { TeamPrismaRepository } from '../../prisma/repositories/team-prisma.repository';
import { TEAM_REPOSITORY } from '../shared/domain.tokens';
import { TeamsService } from './teams.service';

@Module({
  providers: [
    TeamsService,
    TeamPrismaRepository,
    {
      provide: TEAM_REPOSITORY,
      useExisting: TeamPrismaRepository,
    },
  ],
  exports: [TeamsService, TEAM_REPOSITORY],
})
export class TeamsModule {}
