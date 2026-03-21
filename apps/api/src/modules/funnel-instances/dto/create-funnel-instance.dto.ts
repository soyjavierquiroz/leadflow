import type { JsonValue } from '../../shared/domain.types';

export class CreateFunnelInstanceDto {
  readonly workspaceId!: string;
  readonly teamId!: string;
  readonly templateId!: string;
  readonly legacyFunnelId?: string | null;
  readonly name!: string;
  readonly code!: string;
  readonly rotationPoolId?: string | null;
  readonly trackingProfileId?: string | null;
  readonly handoffStrategyId?: string | null;
  readonly settingsJson!: JsonValue;
  readonly mediaMap!: JsonValue;
}
