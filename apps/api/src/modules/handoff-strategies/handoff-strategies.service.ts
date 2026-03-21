import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { HANDOFF_STRATEGY_REPOSITORY } from '../shared/domain.tokens';
import type { CreateHandoffStrategyDto } from './dto/create-handoff-strategy.dto';
import type {
  HandoffStrategy,
  HandoffStrategyRepository,
} from './interfaces/handoff-strategy.interface';

@Injectable()
export class HandoffStrategiesService {
  constructor(
    @Optional()
    @Inject(HANDOFF_STRATEGY_REPOSITORY)
    private readonly repository?: HandoffStrategyRepository,
  ) {}

  createDraft(dto: CreateHandoffStrategyDto): HandoffStrategy {
    return buildEntity<HandoffStrategy>({
      workspaceId: dto.workspaceId,
      teamId: dto.teamId ?? null,
      name: dto.name,
      type: dto.type,
      status: 'draft',
      settingsJson: dto.settingsJson,
    });
  }
}
