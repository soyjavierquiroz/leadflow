import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { HANDOFF_STRATEGY_REPOSITORY } from '../shared/domain.tokens';
import type { CreateHandoffStrategyDto } from './dto/create-handoff-strategy.dto';
import type {
  HandoffStrategy,
  HandoffStrategyRepository,
} from './interfaces/handoff-strategy.interface';
import { handoffStrategyPresets } from './handoff-strategy-presets';

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

  async list(filters?: {
    workspaceId?: string;
    teamId?: string;
  }): Promise<HandoffStrategy[]> {
    if (!this.repository) {
      throw new Error('HandoffStrategyRepository provider is not configured.');
    }

    if (filters?.teamId) {
      return this.repository.findByTeamId(filters.teamId);
    }

    if (filters?.workspaceId) {
      return this.repository.findByWorkspaceId(filters.workspaceId);
    }

    return this.repository.findAll();
  }

  listPresets() {
    return handoffStrategyPresets;
  }
}
