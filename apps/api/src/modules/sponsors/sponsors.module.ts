import { Module } from '@nestjs/common';
import { SponsorPrismaRepository } from '../../prisma/repositories/sponsor-prisma.repository';
import { MessagingAutomationModule } from '../messaging-automation/messaging-automation.module';
import { SPONSOR_REPOSITORY } from '../shared/domain.tokens';
import { SponsorsController } from './sponsors.controller';
import { SponsorsService } from './sponsors.service';

@Module({
  imports: [MessagingAutomationModule],
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
