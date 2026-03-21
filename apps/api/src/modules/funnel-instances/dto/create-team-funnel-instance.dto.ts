export class CreateTeamFunnelInstanceDto {
  readonly templateId!: string;
  readonly name!: string;
  readonly code!: string;
  readonly rotationPoolId?: string | null;
  readonly trackingProfileId?: string | null;
  readonly handoffStrategyId?: string | null;
}
