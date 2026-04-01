import { Module } from '@nestjs/common';
import { MessagingAutomationModule } from '../messaging-automation/messaging-automation.module';
import { TeamPrismaRepository } from '../../prisma/repositories/team-prisma.repository';
import { TEAM_REPOSITORY } from '../shared/domain.tokens';
import { SystemApiGuard } from '../webhooks/system-api.guard';
import { SystemTeamsController } from './system-teams.controller';
import { TeamsController } from './teams.controller';
import { TeamLeadsController } from './team-leads.controller';
import { TeamLeadsService } from './team-leads.service';
import { TeamsService } from './teams.service';

@Module({
  imports: [MessagingAutomationModule],
  controllers: [TeamsController, TeamLeadsController, SystemTeamsController],
  providers: [
    TeamsService,
    TeamLeadsService,
    SystemApiGuard,
    TeamPrismaRepository,
    {
      provide: TEAM_REPOSITORY,
      useExisting: TeamPrismaRepository,
    },
  ],
  exports: [TeamsService, TeamLeadsService, TEAM_REPOSITORY],
})
export class TeamsModule {}
