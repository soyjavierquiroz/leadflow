import { IsOptional, IsString } from 'class-validator';
import type { JsonValue } from '../../shared/domain.types';

export class CreateTeamHybridFunnelPublicationDto {
  readonly name!: string;
  readonly domainId!: string;
  readonly pathPrefix!: string;
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
  readonly templateId!: string;
  readonly theme?: string;
  readonly seoTitle?: string;
  readonly metaDescription?: string;
  readonly blocksJson!: JsonValue;
  readonly mediaMap!: JsonValue;
  readonly settingsJson?: JsonValue;
}
