import type { HandoffStrategyType, JsonValue } from '../../shared/domain.types';

export class CreateHandoffStrategyDto {
  readonly workspaceId!: string;
  readonly teamId?: string | null;
  readonly name!: string;
  readonly type!: HandoffStrategyType;
  readonly settingsJson!: JsonValue;
}
