import { Module } from '@nestjs/common';
import { SponsorPrismaRepository } from '../../prisma/repositories/sponsor-prisma.repository';
import { WalletEngineModule } from '../finance/wallet-engine.module';
import { LeadsModule } from '../leads/leads.module';
import { MessagingAutomationModule } from '../messaging-automation/messaging-automation.module';
import { SPONSOR_REPOSITORY } from '../shared/domain.tokens';
import { SponsorsController } from './sponsors.controller';
import { SponsorsService } from './sponsors.service';

@Module({
  imports: [MessagingAutomationModule, LeadsModule, WalletEngineModule],
  controllers: [SponsorsController],
  providers: [
    SponsorsService,
    SponsorPrismaRepository,
    {
      provide: SPONSOR_REPOSITORY,
      useExisting: SponsorPrismaRepository,
    },
  ],
  exports: [SponsorsService, SPONSOR_REPOSITORY],
})
export class SponsorsModule {}
