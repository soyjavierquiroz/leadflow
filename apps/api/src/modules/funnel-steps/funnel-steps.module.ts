import { Module } from '@nestjs/common';
import { FunnelStepPrismaRepository } from '../../prisma/repositories/funnel-step-prisma.repository';
import { FUNNEL_STEP_REPOSITORY } from '../shared/domain.tokens';
import { FunnelStepsService } from './funnel-steps.service';

@Module({
  providers: [
    FunnelStepsService,
    FunnelStepPrismaRepository,
    {
      provide: FUNNEL_STEP_REPOSITORY,
      useExisting: FunnelStepPrismaRepository,
    },
  ],
  exports: [FunnelStepsService, FUNNEL_STEP_REPOSITORY],
})
export class FunnelStepsModule {}
