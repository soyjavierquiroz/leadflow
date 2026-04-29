import type { JsonValue } from '../../shared/domain.types';
import type { FunnelStructuralType } from '../interfaces/funnel-instance.interface';

export class UpdateTeamFunnelInstanceDto {
  readonly name?: string;
  readonly code?: string;
  readonly thumbnailUrl?: string | null;
  readonly structuralType?: FunnelStructuralType;
  readonly conversionContract?: JsonValue;
  readonly rotationPoolId?: string | null;
  readonly trackingProfileId?: string | null;
  readonly handoffStrategyId?: string | null;
  readonly status?: 'draft' | 'active' | 'archived';
}
