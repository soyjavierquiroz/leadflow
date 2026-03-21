import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { TEAM_REPOSITORY } from '../shared/domain.tokens';
import type { CreateTeamDto } from './dto/create-team.dto';
import type { Team, TeamRepository } from './interfaces/team.interface';

@Injectable()
export class TeamsService {
  constructor(
    @Optional()
    @Inject(TEAM_REPOSITORY)
    private readonly repository?: TeamRepository,
  ) {}

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
      domainIds: [],
      funnelInstanceIds: [],
      funnelPublicationIds: [],
      trackingProfileIds: [],
      handoffStrategyIds: [],
      rotationPoolIds: [],
    });
  }

  async list(filters?: { workspaceId?: string }): Promise<Team[]> {
    if (!this.repository) {
      throw new Error('TeamRepository provider is not configured.');
    }

    if (filters?.workspaceId) {
      return this.repository.findByWorkspaceId(filters.workspaceId);
    }

    return this.repository.findAll();
  }
}
