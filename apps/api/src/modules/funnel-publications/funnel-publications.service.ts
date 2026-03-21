import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { FUNNEL_PUBLICATION_REPOSITORY } from '../shared/domain.tokens';
import type { CreateFunnelPublicationDto } from './dto/create-funnel-publication.dto';
import type {
  FunnelPublication,
  FunnelPublicationRepository,
} from './interfaces/funnel-publication.interface';

@Injectable()
export class FunnelPublicationsService {
  constructor(
    @Optional()
    @Inject(FUNNEL_PUBLICATION_REPOSITORY)
    private readonly repository?: FunnelPublicationRepository,
  ) {}

  createDraft(dto: CreateFunnelPublicationDto): FunnelPublication {
    return buildEntity<FunnelPublication>({
      workspaceId: dto.workspaceId,
      teamId: dto.teamId,
      domainId: dto.domainId,
      funnelInstanceId: dto.funnelInstanceId,
      trackingProfileId: dto.trackingProfileId ?? null,
      handoffStrategyId: dto.handoffStrategyId ?? null,
      pathPrefix: dto.pathPrefix,
      status: 'draft',
      isPrimary: dto.isPrimary ?? false,
    });
  }

  async list(filters?: {
    workspaceId?: string;
    teamId?: string;
    domainId?: string;
  }): Promise<FunnelPublication[]> {
    if (!this.repository) {
      throw new Error(
        'FunnelPublicationRepository provider is not configured.',
      );
    }

    if (filters?.domainId) {
      return this.repository.findByDomainId(filters.domainId);
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
