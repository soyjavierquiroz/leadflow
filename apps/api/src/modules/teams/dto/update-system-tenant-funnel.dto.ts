import type { JsonValue } from '../../shared/domain.types';

export class UpdateSystemTenantFunnelDto {
  readonly funnelInstanceId?: string | null;
  readonly name?: string;
  readonly description?: string | null;
  readonly config?: JsonValue;
  readonly settingsJson?: JsonValue;
}
