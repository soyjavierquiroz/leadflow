import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { FUNNEL_STEP_REPOSITORY } from '../shared/domain.tokens';
import type { CreateFunnelStepDto } from './dto/create-funnel-step.dto';
import type {
  FunnelStep,
  FunnelStepRepository,
} from './interfaces/funnel-step.interface';

@Injectable()
export class FunnelStepsService {
  constructor(
    @Optional()
    @Inject(FUNNEL_STEP_REPOSITORY)
    private readonly repository?: FunnelStepRepository,
  ) {}

  createDraft(dto: CreateFunnelStepDto): FunnelStep {
    return buildEntity<FunnelStep>({
      workspaceId: dto.workspaceId,
      teamId: dto.teamId,
      funnelInstanceId: dto.funnelInstanceId,
      stepType: dto.stepType,
      slug: dto.slug,
      position: dto.position,
      isEntryStep: dto.isEntryStep ?? false,
      isConversionStep: dto.isConversionStep ?? false,
      blocksJson: dto.blocksJson,
      mediaMap: dto.mediaMap,
      settingsJson: dto.settingsJson,
    });
  }
}
