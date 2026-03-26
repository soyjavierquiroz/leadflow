import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { DOMAIN_REPOSITORY } from '../shared/domain.tokens';
import {
  hasNormalizedDomainHost,
  normalizeDomainHost,
} from '../shared/publication-resolution.utils';
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
    if (!hasNormalizedDomainHost(dto.host)) {
      throw new BadRequestException({
        code: 'HOST_REQUIRED',
        message: 'A valid host is required.',
      });
    }

    const normalizedHost = normalizeDomainHost(dto.host);

    return buildEntity<DomainEntity>({
      workspaceId: dto.workspaceId,
      teamId: dto.teamId,
      host: dto.host.trim(),
      normalizedHost,
      status: 'draft',
      domainType: dto.domainType ?? 'custom_apex',
      isPrimary: dto.isPrimary ?? false,
      canonicalHost: dto.canonicalHost
        ? normalizeDomainHost(dto.canonicalHost)
        : null,
      redirectToPrimary: dto.redirectToPrimary ?? false,
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
