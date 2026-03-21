import { Inject, Injectable, Optional } from '@nestjs/common';
import { buildEntity } from '../shared/domain.factory';
import { FUNNEL_TEMPLATE_REPOSITORY } from '../shared/domain.tokens';
import type { CreateFunnelTemplateDto } from './dto/create-funnel-template.dto';
import type {
  FunnelTemplate,
  FunnelTemplateRepository,
} from './interfaces/funnel-template.interface';

@Injectable()
export class FunnelTemplatesService {
  constructor(
    @Optional()
    @Inject(FUNNEL_TEMPLATE_REPOSITORY)
    private readonly repository?: FunnelTemplateRepository,
  ) {}

  createDraft(dto: CreateFunnelTemplateDto): FunnelTemplate {
    return buildEntity<FunnelTemplate>({
      workspaceId: dto.workspaceId ?? null,
      name: dto.name,
      code: dto.code,
      status: 'draft',
      version: dto.version ?? 1,
      funnelType: dto.funnelType,
      blocksJson: dto.blocksJson,
      mediaMap: dto.mediaMap,
      settingsJson: dto.settingsJson,
      allowedOverridesJson: dto.allowedOverridesJson,
      defaultHandoffStrategyId: dto.defaultHandoffStrategyId ?? null,
    });
  }

  async list(workspaceId?: string): Promise<FunnelTemplate[]> {
    if (!this.repository) {
      throw new Error('FunnelTemplateRepository provider is not configured.');
    }

    if (workspaceId) {
      return this.repository.findByWorkspaceId(workspaceId);
    }

    return this.repository.findAll();
  }
}
