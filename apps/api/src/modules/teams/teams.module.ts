import { Module } from '@nestjs/common';
import { AdWheelsModule } from '../ad-wheels/ad-wheels.module';
import { FunnelsModule } from '../funnels/funnels.module';
import { WalletEngineModule } from '../finance/wallet-engine.module';
import { MailModule } from '../mail/mail.module';
import { MessagingAutomationModule } from '../messaging-automation/messaging-automation.module';
import { TeamPrismaRepository } from '../../prisma/repositories/team-prisma.repository';
import { TEAM_REPOSITORY } from '../shared/domain.tokens';
import { SystemApiGuard } from '../webhooks/system-api.guard';
import { TeamMembersController } from './team-members.controller';
import { TeamMembersService } from './team-members.service';
import { SystemTenantAccessGuard } from './system-tenant-access.guard';
import { SystemTeamsController } from './system-teams.controller';
import { TeamsController } from './teams.controller';
import { TeamLeadsController } from './team-leads.controller';
import { TeamLeadsService } from './team-leads.service';
import { TeamSettingsController } from './team-settings.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [
    AdWheelsModule,
    MessagingAutomationModule,
    WalletEngineModule,
    FunnelsModule,
    MailModule,
  ],
  controllers: [
    TeamsController,
    TeamSettingsController,
    TeamLeadsController,
    TeamMembersController,
    SystemTeamsController,
  ],
  providers: [
    TeamsService,
    TeamLeadsService,
    TeamMembersService,
    SystemApiGuard,
    SystemTenantAccessGuard,
    TeamPrismaRepository,
    {
      provide: TEAM_REPOSITORY,
      useExisting: TeamPrismaRepository,
    },
  ],
  exports: [
    TeamsService,
    TeamLeadsService,
    TeamMembersService,
    TEAM_REPOSITORY,
  ],
})
export class TeamsModule {}
