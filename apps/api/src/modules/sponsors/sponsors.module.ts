import { Module } from '@nestjs/common';
import { SponsorPrismaRepository } from '../../prisma/repositories/sponsor-prisma.repository';
import { CrmModule } from '../crm/crm.module';
import { WalletEngineModule } from '../finance/wallet-engine.module';
import { LeadsModule } from '../leads/leads.module';
import { ShortLinkProvider } from '../public-funnel-runtime/short-link.provider';
import { MessagingAutomationModule } from '../messaging-automation/messaging-automation.module';
import { SPONSOR_REPOSITORY } from '../shared/domain.tokens';
import { SponsorVanityShortLinksService } from './sponsor-vanity-short-links.service';
import { SponsorsController } from './sponsors.controller';
import { SponsorsService } from './sponsors.service';
import { TeamSponsorVanityShortLinksController } from './team-sponsor-vanity-short-links.controller';

@Module({
  imports: [
    CrmModule,
    MessagingAutomationModule,
    LeadsModule,
    WalletEngineModule,
  ],
  controllers: [SponsorsController, TeamSponsorVanityShortLinksController],
  providers: [
    SponsorsService,
    SponsorVanityShortLinksService,
    ShortLinkProvider,
    SponsorPrismaRepository,
    {
      provide: SPONSOR_REPOSITORY,
      useExisting: SponsorPrismaRepository,
    },
  ],
  exports: [
    SponsorsService,
    SponsorVanityShortLinksService,
    SPONSOR_REPOSITORY,
  ],
})
export class SponsorsModule {}
