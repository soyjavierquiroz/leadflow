export type FunnelArsenalTemplateDifficulty = 'basic' | 'intermediate' | 'advanced';
export type FunnelArsenalTemplateStatus = 'draft' | 'active' | 'archived';

export class CreateSystemFunnelArsenalTemplateDto {
  readonly templateKey?: string;
  readonly blueprintKey?: string;
  readonly vertical?: string;
  readonly label?: string;
  readonly description?: string;
  readonly goal?: string;
  readonly recommendedFor?: string;
  readonly cta?: string;
  readonly pathSuggestion?: string;
  readonly difficulty?: FunnelArsenalTemplateDifficulty | string;
  readonly status?: FunnelArsenalTemplateStatus | string;
  readonly blocksPresetKey?: string | null;
  readonly funnelTemplateId?: string | null;
  readonly sourceFunnelId?: string | null;
  readonly sourceFunnelInstanceId?: string | null;
}
