export type FunnelArsenalTemplateDifficulty =
  | 'basic'
  | 'intermediate'
  | 'advanced';
export type FunnelArsenalTemplateStatus = 'draft' | 'active' | 'archived';

export class CreateSystemFunnelArsenalTemplateDto {
  readonly templateKey?: string;
  readonly assetSlug?: string | null;
  readonly blueprintKey?: string;
  readonly vertical?: string;
  readonly industry?: string | null;
  readonly subindustry?: string | null;
  readonly businessModel?: string | null;
  readonly funnelType?: string | null;
  readonly funnelFormat?: string | null;
  readonly framework?: string | null;
  readonly objective?: string | null;
  readonly stepsCount?: number | string | null;
  readonly language?: string | null;
  readonly country?: string | null;
  readonly market?: string | null;
  readonly level?: string | null;
  readonly estimatedTimeMinutes?: number | string | null;
  readonly tags?: string[] | string | null;
  readonly coverUrl?: string | null;
  readonly thumbnailUrl?: string | null;
  readonly screenshots?: unknown;
  readonly videoPreviewUrl?: string | null;
  readonly label?: string;
  readonly description?: string;
  readonly headline?: string | null;
  readonly goal?: string;
  readonly recommendedFor?: string;
  readonly cta?: string;
  readonly pathSuggestion?: string;
  readonly difficulty?: FunnelArsenalTemplateDifficulty | string;
  readonly status?: FunnelArsenalTemplateStatus | string;
  readonly version?: string | null;
  readonly authorName?: string | null;
  readonly publishedAt?: string | Date | null;
  readonly problemSolved?: string | null;
  readonly idealFor?: string | null;
  readonly flowSummary?: unknown;
  readonly compatibleBlueprints?: string[] | string | null;
  readonly assets?: unknown;
  readonly media?: unknown;
  readonly history?: unknown;
  readonly cloneCount?: number | string | null;
  readonly activeInstallations?: number | string | null;
  readonly lastActivatedAt?: string | Date | null;
  readonly favoriteCount?: number | string | null;
  readonly blocksPresetKey?: string | null;
  readonly funnelTemplateId?: string | null;
  readonly sourceFunnelId?: string | null;
  readonly sourceFunnelInstanceId?: string | null;
}
