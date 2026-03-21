import type { CreateFunnelStepDto } from '../dto/create-funnel-step.dto';
import type {
  BaseDomainEntity,
  DomainId,
  FunnelStepType,
  JsonValue,
  RepositoryPort,
  TeamScoped,
  WorkspaceScoped,
} from '../../shared/domain.types';

export interface FunnelStep
  extends BaseDomainEntity, WorkspaceScoped, TeamScoped {
  funnelInstanceId: DomainId;
  stepType: FunnelStepType;
  slug: string;
  position: number;
  isEntryStep: boolean;
  isConversionStep: boolean;
  blocksJson: JsonValue;
  mediaMap: JsonValue;
  settingsJson: JsonValue;
}

export interface FunnelStepRepository extends RepositoryPort<
  FunnelStep,
  CreateFunnelStepDto
> {
  findAll(): Promise<FunnelStep[]>;
  findByFunnelInstanceId(funnelInstanceId: DomainId): Promise<FunnelStep[]>;
}
