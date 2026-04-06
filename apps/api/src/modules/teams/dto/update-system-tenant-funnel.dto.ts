import type { JsonValue } from '../../shared/domain.types';

export class UpdateSystemTenantFunnelDto {
  readonly name?: string;
  readonly description?: string | null;
  readonly config?: JsonValue;
}
