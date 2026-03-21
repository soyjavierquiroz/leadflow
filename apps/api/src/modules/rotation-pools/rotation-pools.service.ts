import { Injectable } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import type { CreateRotationPoolDto } from './dto/create-rotation-pool.dto';
import type { RotationPool } from './interfaces/rotation-pool.interface';

@Injectable()
export class RotationPoolsService {
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
}
