import { Injectable } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import type { CreateTeamDto } from './dto/create-team.dto';
import type { Team } from './interfaces/team.interface';

@Injectable()
export class TeamsService {
  createDraft(dto: CreateTeamDto): Team {
    return buildEntity<Team>({
      workspaceId: dto.workspaceId,
      name: dto.name,
      code: dto.code,
      status: 'draft',
      description: dto.description ?? null,
      managerUserId: dto.managerUserId ?? null,
      sponsorIds: [],
      funnelIds: [],
      rotationPoolIds: [],
    });
  }
}
