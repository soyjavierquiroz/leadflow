import { Module } from '@nestjs/common';
import { FunnelInstancePrismaRepository } from '../../prisma/repositories/funnel-instance-prisma.repository';
import { FUNNEL_INSTANCE_REPOSITORY } from '../shared/domain.tokens';
import { FunnelInstancesController } from './funnel-instances.controller';
import { FunnelInstancesService } from './funnel-instances.service';

@Module({
  controllers: [FunnelInstancesController],
  providers: [
    FunnelInstancesService,
    FunnelInstancePrismaRepository,
    {
      provide: FUNNEL_INSTANCE_REPOSITORY,
      useExisting: FunnelInstancePrismaRepository,
    },
  ],
  exports: [FunnelInstancesService, FUNNEL_INSTANCE_REPOSITORY],
})
export class FunnelInstancesModule {}
