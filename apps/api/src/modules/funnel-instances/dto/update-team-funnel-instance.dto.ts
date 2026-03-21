export class UpdateTeamFunnelInstanceDto {
  readonly name?: string;
  readonly code?: string;
  readonly rotationPoolId?: string | null;
  readonly trackingProfileId?: string | null;
  readonly handoffStrategyId?: string | null;
  readonly status?: 'draft' | 'active' | 'archived';
}
