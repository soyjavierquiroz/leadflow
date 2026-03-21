import { Module } from '@nestjs/common';
import { LeadPrismaRepository } from '../../prisma/repositories/lead-prisma.repository';
import { LEAD_REPOSITORY } from '../shared/domain.tokens';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
  controllers: [LeadsController],
  providers: [
    LeadsService,
    LeadPrismaRepository,
    {
      provide: LEAD_REPOSITORY,
      useExisting: LeadPrismaRepository,
    },
  ],
  exports: [LeadsService, LEAD_REPOSITORY],
})
export class LeadsModule {}
