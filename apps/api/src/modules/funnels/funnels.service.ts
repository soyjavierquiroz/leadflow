import { Injectable } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import type { CreateFunnelDto } from './dto/create-funnel.dto';
import type { Funnel } from './interfaces/funnel.interface';

@Injectable()
export class FunnelsService {
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
