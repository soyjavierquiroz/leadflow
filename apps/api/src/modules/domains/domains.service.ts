import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { DOMAIN_REPOSITORY } from '../shared/domain.tokens';
import type { CreateDomainDto } from './dto/create-domain.dto';
import type {
  DomainEntity,
  DomainRepository,
} from './interfaces/domain.interface';

@Injectable()
export class DomainsService {
  constructor(
    @Optional()
    @Inject(DOMAIN_REPOSITORY)
    private readonly repository?: DomainRepository,
  ) {}

  createDraft(dto: CreateDomainDto): DomainEntity {
    return buildEntity<DomainEntity>({
      workspaceId: dto.workspaceId,
      teamId: dto.teamId,
      host: dto.host,
      status: 'draft',
      kind: dto.kind ?? 'apex',
      isPrimary: dto.isPrimary ?? false,
    });
  }

  async list(filters?: {
    workspaceId?: string;
    teamId?: string;
  }): Promise<DomainEntity[]> {
    if (!this.repository) {
      throw new Error('DomainRepository provider is not configured.');
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
