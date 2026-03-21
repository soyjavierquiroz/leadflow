import { Injectable } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import type { Workspace } from './interfaces/workspace.interface';
import type { CreateWorkspaceDto } from './dto/create-workspace.dto';

@Injectable()
export class WorkspacesService {
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
}
