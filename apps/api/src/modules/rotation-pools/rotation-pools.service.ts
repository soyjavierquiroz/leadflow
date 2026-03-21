import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { ROTATION_POOL_REPOSITORY } from '../shared/domain.tokens';
import type { CreateRotationPoolDto } from './dto/create-rotation-pool.dto';
import type {
  RotationPool,
  RotationPoolRepository,
} from './interfaces/rotation-pool.interface';

@Injectable()
export class RotationPoolsService {
  constructor(
    @Optional()
    @Inject(ROTATION_POOL_REPOSITORY)
    private readonly repository?: RotationPoolRepository,
  ) {}

  createDraft(dto: CreateRotationPoolDto): RotationPool {
    return buildEntity<RotationPool>({
      workspaceId: dto.workspaceId,
      teamId: dto.teamId,
      name: dto.name,
      status: 'draft',
      strategy: dto.strategy ?? 'round-robin',
      sponsorIds: dto.sponsorIds ?? [],
      funnelIds: dto.funnelIds ?? [],
      isFallbackPool: dto.isFallbackPool ?? false,
    });
  }

  async list(filters?: {
    workspaceId?: string;
    teamId?: string;
  }): Promise<RotationPool[]> {
    if (!this.repository) {
      throw new Error('RotationPoolRepository provider is not configured.');
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
