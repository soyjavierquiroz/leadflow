import type { RotationStrategy } from '../../shared/domain.types';

export class CreateRotationPoolDto {
  readonly workspaceId!: string;
  readonly teamId!: string;
  readonly name!: string;
  readonly strategy?: RotationStrategy;
  readonly sponsorIds?: string[];
  readonly funnelIds?: string[];
  readonly isFallbackPool?: boolean;
}
