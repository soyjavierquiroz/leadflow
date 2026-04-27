import type { RotationStrategy } from '../../shared/domain.types';
import type { RotationPoolStatus } from '../interfaces/rotation-pool.interface';

export class CreateRotationPoolDto {
  readonly workspaceId!: string;
  readonly teamId!: string;
  readonly name!: string;
  readonly status?: RotationPoolStatus;
  readonly strategy?: RotationStrategy;
  readonly sponsorIds?: string[];
  readonly funnelIds?: string[];
  readonly isFallbackPool?: boolean;
}
