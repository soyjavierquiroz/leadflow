import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { SPONSOR_REPOSITORY } from '../shared/domain.tokens';
import type { CreateSponsorDto } from './dto/create-sponsor.dto';
import type {
  Sponsor,
  SponsorRepository,
} from './interfaces/sponsor.interface';

@Injectable()
export class SponsorsService {
  constructor(
    @Optional()
    @Inject(SPONSOR_REPOSITORY)
    private readonly repository?: SponsorRepository,
  ) {}

  createDraft(dto: CreateSponsorDto): Sponsor {
    return buildEntity<Sponsor>({
      workspaceId: dto.workspaceId,
      teamId: dto.teamId,
      displayName: dto.displayName,
      status: 'draft',
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      availabilityStatus: dto.availabilityStatus ?? 'available',
      routingWeight: dto.routingWeight ?? 1,
      memberPortalEnabled: dto.memberPortalEnabled ?? true,
    });
  }

  async list(filters?: {
    workspaceId?: string;
    teamId?: string;
  }): Promise<Sponsor[]> {
    if (!this.repository) {
      throw new Error('SponsorRepository provider is not configured.');
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
