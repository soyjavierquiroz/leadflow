import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { FUNNEL_REPOSITORY } from '../shared/domain.tokens';
import type { CreateFunnelDto } from './dto/create-funnel.dto';
import type { Funnel, FunnelRepository } from './interfaces/funnel.interface';

@Injectable()
export class FunnelsService {
  constructor(
    @Optional()
    @Inject(FUNNEL_REPOSITORY)
    private readonly repository?: FunnelRepository,
  ) {}

  createDraft(dto: CreateFunnelDto): Funnel {
    return buildEntity<Funnel>({
      workspaceId: dto.workspaceId,
      name: dto.name,
      code: dto.code,
      status: 'draft',
      stages: dto.stages ?? ['captured', 'qualified', 'won'],
      entrySources: dto.entrySources ?? [
        'manual',
        'form',
        'landing-page',
        'api',
      ],
      defaultTeamId: dto.defaultTeamId ?? null,
      defaultRotationPoolId: dto.defaultRotationPoolId ?? null,
    });
  }
}
