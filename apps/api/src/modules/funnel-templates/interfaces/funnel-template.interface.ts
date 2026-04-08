import type { CreateFunnelTemplateDto } from '../dto/create-funnel-template.dto';
import type {
  BaseDomainEntity,
  DomainId,
  JsonValue,
  RepositoryPort,
} from '../../shared/domain.types';

export type FunnelTemplateStatus = 'draft' | 'active' | 'archived';

export interface FunnelTemplate extends BaseDomainEntity {
  workspaceId: DomainId | null;
  name: string;
  description: string | null;
  code: string;
  status: FunnelTemplateStatus;
  version: number;
  funnelType: string;
  blocksJson: JsonValue;
  mediaMap: JsonValue;
  settingsJson: JsonValue;
  allowedOverridesJson: JsonValue;
  defaultHandoffStrategyId: DomainId | null;
}

export interface FunnelTemplateRepository extends RepositoryPort<
  FunnelTemplate,
  CreateFunnelTemplateDto
> {
  findAll(): Promise<FunnelTemplate[]>;
  findByWorkspaceId(workspaceId: DomainId): Promise<FunnelTemplate[]>;
}
