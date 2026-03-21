import { Injectable } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import type { CreateSponsorDto } from './dto/create-sponsor.dto';
import type { Sponsor } from './interfaces/sponsor.interface';

@Injectable()
export class SponsorsService {
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
}
