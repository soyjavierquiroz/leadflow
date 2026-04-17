export class UpdateSystemPublicationDto {
  readonly domainId?: string;
  readonly funnelId?: string;
  readonly path?: string;
  readonly isActive?: boolean;
  readonly metaPixelId?: string | null;
  readonly tiktokPixelId?: string | null;
  readonly metaCapiToken?: string | null;
  readonly tiktokAccessToken?: string | null;
}
