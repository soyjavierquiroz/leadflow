import { Module } from '@nestjs/common';
import { FunnelInstancePrismaRepository } from '../../prisma/repositories/funnel-instance-prisma.repository';
import { FunnelGraphMutationService } from '../funnel-graph/funnel-graph-mutation.service';
import { RuntimeContextModule } from '../runtime-context/runtime-context.module';
import { FUNNEL_INSTANCE_REPOSITORY } from '../shared/domain.tokens';
import { TemplatesModule } from '../templates/templates.module';
import { FunnelInstancesController } from './funnel-instances.controller';
import { FunnelInstancesService } from './funnel-instances.service';

@Module({
  imports: [RuntimeContextModule, TemplatesModule],
  controllers: [FunnelInstancesController],
  providers: [
    FunnelInstancesService,
    FunnelGraphMutationService,
    FunnelInstancePrismaRepository,
    {
      provide: FUNNEL_INSTANCE_REPOSITORY,
      useExisting: FunnelInstancePrismaRepository,
    },
  ],
  exports: [
    FunnelInstancesService,
    FunnelGraphMutationService,
    FUNNEL_INSTANCE_REPOSITORY,
  ],
})
export class FunnelInstancesModule {}
