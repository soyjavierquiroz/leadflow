import type { FunnelStepType, JsonValue } from '../../shared/domain.types';

export class CreateFunnelStepDto {
  readonly workspaceId!: string;
  readonly teamId!: string;
  readonly funnelInstanceId!: string;
  readonly stepType!: FunnelStepType;
  readonly slug!: string;
  readonly position!: number;
  readonly isEntryStep?: boolean;
  readonly isConversionStep?: boolean;
  readonly blocksJson!: JsonValue;
  readonly mediaMap!: JsonValue;
  readonly settingsJson!: JsonValue;
}
