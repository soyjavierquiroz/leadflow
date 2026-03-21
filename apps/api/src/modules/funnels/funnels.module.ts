import { Module } from '@nestjs/common';
import { FunnelPrismaRepository } from '../../prisma/repositories/funnel-prisma.repository';
import { FUNNEL_REPOSITORY } from '../shared/domain.tokens';
import { FunnelsService } from './funnels.service';

@Module({
  providers: [
    FunnelsService,
    FunnelPrismaRepository,
    {
      provide: FUNNEL_REPOSITORY,
      useExisting: FunnelPrismaRepository,
    },
  ],
  exports: [FunnelsService, FUNNEL_REPOSITORY],
})
export class FunnelsModule {}
