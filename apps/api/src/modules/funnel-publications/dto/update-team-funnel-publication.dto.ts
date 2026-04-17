import { IsOptional, IsString } from 'class-validator';

export class UpdateTeamFunnelPublicationDto {
  readonly domainId?: string;
  readonly funnelInstanceId?: string;
  readonly trackingProfileId?: string | null;
  readonly handoffStrategyId?: string | null;
  @IsOptional()
  @IsString()
  readonly metaPixelId?: string | null;
  @IsOptional()
  @IsString()
  readonly tiktokPixelId?: string | null;
  @IsOptional()
  @IsString()
  readonly metaCapiToken?: string | null;
  @IsOptional()
  @IsString()
  readonly tiktokAccessToken?: string | null;
  readonly pathPrefix?: string;
  readonly isPrimary?: boolean;
  readonly status?: 'draft' | 'active' | 'archived';
}
