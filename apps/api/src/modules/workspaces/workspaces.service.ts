import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { WORKSPACE_REPOSITORY } from '../shared/domain.tokens';
import type { Workspace } from './interfaces/workspace.interface';
import type { CreateWorkspaceDto } from './dto/create-workspace.dto';
import type { WorkspaceRepository } from './interfaces/workspace.interface';

@Injectable()
export class WorkspacesService {
  constructor(
    @Optional()
    @Inject(WORKSPACE_REPOSITORY)
    private readonly repository?: WorkspaceRepository,
  ) {}

  createDraft(dto: CreateWorkspaceDto): Workspace {
    return buildEntity<Workspace>({
      name: dto.name,
      slug: dto.slug,
      status: 'draft',
      timezone: dto.timezone ?? 'UTC',
      defaultCurrency: dto.defaultCurrency ?? 'USD',
      primaryLocale: dto.primaryLocale ?? 'es',
      primaryDomain: dto.primaryDomain ?? null,
    });
  }

  async list(): Promise<Workspace[]> {
    if (!this.repository) {
      throw new Error('WorkspaceRepository provider is not configured.');
    }

    return this.repository.findAll();
  }
}
