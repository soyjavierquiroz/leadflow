export class CreateTeamFunnelPublicationDto {
  readonly domainId!: string;
  readonly funnelInstanceId!: string;
  readonly trackingProfileId?: string | null;
  readonly handoffStrategyId?: string | null;
  readonly metaPixelId?: string | null;
  readonly tiktokPixelId?: string | null;
  readonly metaCapiToken?: string | null;
  readonly tiktokAccessToken?: string | null;
  readonly pathPrefix!: string;
  readonly isPrimary?: boolean;
}
