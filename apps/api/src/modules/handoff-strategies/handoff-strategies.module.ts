import { Module } from '@nestjs/common';
import { HandoffStrategyPrismaRepository } from '../../prisma/repositories/handoff-strategy-prisma.repository';
import { HANDOFF_STRATEGY_REPOSITORY } from '../shared/domain.tokens';
import { HandoffStrategiesController } from './handoff-strategies.controller';
import { HandoffStrategiesService } from './handoff-strategies.service';

@Module({
  controllers: [HandoffStrategiesController],
  providers: [
    HandoffStrategiesService,
    HandoffStrategyPrismaRepository,
    {
      provide: HANDOFF_STRATEGY_REPOSITORY,
      useExisting: HandoffStrategyPrismaRepository,
    },
  ],
  exports: [HandoffStrategiesService, HANDOFF_STRATEGY_REPOSITORY],
})
export class HandoffStrategiesModule {}
