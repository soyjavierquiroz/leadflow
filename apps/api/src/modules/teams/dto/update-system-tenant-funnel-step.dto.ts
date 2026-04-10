import type { JsonValue } from '../../shared/domain.types';

export class UpdateSystemTenantFunnelStepDto {
  readonly name?: string;
  readonly description?: string | null;
  readonly blocksJson?: JsonValue;
  readonly mediaMap?: JsonValue;
  readonly settingsJson?: JsonValue;
}
