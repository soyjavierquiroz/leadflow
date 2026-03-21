export class UpdateTeamFunnelPublicationDto {
  readonly domainId?: string;
  readonly funnelInstanceId?: string;
  readonly trackingProfileId?: string | null;
  readonly handoffStrategyId?: string | null;
  readonly pathPrefix?: string;
  readonly isPrimary?: boolean;
  readonly status?: 'draft' | 'active' | 'archived';
}
