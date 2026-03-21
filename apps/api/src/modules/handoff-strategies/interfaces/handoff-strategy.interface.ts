import type { CreateHandoffStrategyDto } from '../dto/create-handoff-strategy.dto';
import type {
  BaseDomainEntity,
  DomainId,
  HandoffStrategyType,
  JsonValue,
  RepositoryPort,
  WorkspaceScoped,
} from '../../shared/domain.types';

export type HandoffStrategyStatus = 'draft' | 'active' | 'archived';

export interface HandoffStrategy extends BaseDomainEntity, WorkspaceScoped {
  teamId: DomainId | null;
  name: string;
  type: HandoffStrategyType;
  status: HandoffStrategyStatus;
  settingsJson: JsonValue;
}

export interface HandoffStrategyRepository extends RepositoryPort<
  HandoffStrategy,
  CreateHandoffStrategyDto
> {
  findAll(): Promise<HandoffStrategy[]>;
  findByWorkspaceId(workspaceId: DomainId): Promise<HandoffStrategy[]>;
  findByTeamId(teamId: DomainId): Promise<HandoffStrategy[]>;
}
