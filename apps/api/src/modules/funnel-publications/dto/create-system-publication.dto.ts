import { IsOptional, IsString } from 'class-validator';

export class CreateSystemPublicationDto {
  readonly domainId!: string;
  readonly funnelId!: string;
  readonly path?: string;
  readonly isActive?: boolean;
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
}
