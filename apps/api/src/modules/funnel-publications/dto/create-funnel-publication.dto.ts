export class CreateFunnelPublicationDto {
  readonly workspaceId!: string;
  readonly teamId!: string;
  readonly domainId!: string;
  readonly funnelInstanceId!: string;
  readonly trackingProfileId?: string | null;
  readonly handoffStrategyId?: string | null;
  readonly metaPixelId?: string | null;
  readonly tiktokPixelId?: string | null;
  readonly metaCapiToken?: string | null;
  readonly tiktokAccessToken?: string | null;
  readonly pathPrefix!: string;
  readonly isActive?: boolean;
  readonly isPrimary?: boolean;
}
