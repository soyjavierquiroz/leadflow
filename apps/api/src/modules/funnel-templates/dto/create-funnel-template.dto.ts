import type { JsonValue } from '../../shared/domain.types';

export class CreateFunnelTemplateDto {
  readonly workspaceId?: string | null;
  readonly name!: string;
  readonly description?: string | null;
  readonly code!: string;
  readonly version?: number;
  readonly funnelType!: string;
  readonly blocksJson!: JsonValue;
  readonly mediaMap!: JsonValue;
  readonly settingsJson!: JsonValue;
  readonly allowedOverridesJson!: JsonValue;
  readonly defaultHandoffStrategyId?: string | null;
}
