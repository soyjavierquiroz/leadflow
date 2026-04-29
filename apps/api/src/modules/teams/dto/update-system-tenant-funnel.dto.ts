import type { JsonValue } from '../../shared/domain.types';
import type { FunnelStructuralType } from '../../funnel-instances/interfaces/funnel-instance.interface';

export class UpdateSystemTenantFunnelDto {
  readonly funnelInstanceId?: string | null;
  readonly name?: string;
  readonly description?: string | null;
  readonly config?: JsonValue;
  readonly settingsJson?: JsonValue;
  readonly structuralType?: FunnelStructuralType;
  readonly conversionContract?: JsonValue;
}
