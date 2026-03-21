import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { FUNNEL_INSTANCE_REPOSITORY } from '../shared/domain.tokens';
import type { CreateFunnelInstanceDto } from './dto/create-funnel-instance.dto';
import type {
  FunnelInstance,
  FunnelInstanceRepository,
} from './interfaces/funnel-instance.interface';

@Injectable()
export class FunnelInstancesService {
  constructor(
    @Optional()
    @Inject(FUNNEL_INSTANCE_REPOSITORY)
    private readonly repository?: FunnelInstanceRepository,
  ) {}

  createDraft(dto: CreateFunnelInstanceDto): FunnelInstance {
    return buildEntity<FunnelInstance>({
      workspaceId: dto.workspaceId,
      teamId: dto.teamId,
      templateId: dto.templateId,
      legacyFunnelId: dto.legacyFunnelId ?? null,
      name: dto.name,
      code: dto.code,
      status: 'draft',
      rotationPoolId: dto.rotationPoolId ?? null,
      trackingProfileId: dto.trackingProfileId ?? null,
      handoffStrategyId: dto.handoffStrategyId ?? null,
      settingsJson: dto.settingsJson,
      mediaMap: dto.mediaMap,
      stepIds: [],
      publicationIds: [],
    });
  }

  async list(filters?: {
    workspaceId?: string;
    teamId?: string;
  }): Promise<FunnelInstance[]> {
    if (!this.repository) {
      throw new Error('FunnelInstanceRepository provider is not configured.');
    }

    if (filters?.teamId) {
      return this.repository.findByTeamId(filters.teamId);
    }

    if (filters?.workspaceId) {
      return this.repository.findByWorkspaceId(filters.workspaceId);
    }

    return this.repository.findAll();
  }
}
