export class CreateTeamFunnelPublicationDto {
  readonly domainId!: string;
  readonly funnelInstanceId!: string;
  readonly trackingProfileId?: string | null;
  readonly handoffStrategyId?: string | null;
  readonly pathPrefix!: string;
  readonly isPrimary?: boolean;
}
