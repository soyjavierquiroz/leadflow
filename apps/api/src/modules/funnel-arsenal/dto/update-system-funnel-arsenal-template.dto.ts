import type { CreateSystemFunnelArsenalTemplateDto } from './create-system-funnel-arsenal-template.dto';

export class UpdateSystemFunnelArsenalTemplateDto
  implements Partial<CreateSystemFunnelArsenalTemplateDto>
{
  readonly templateKey?: string;
  readonly blueprintKey?: string;
  readonly vertical?: string;
  readonly label?: string;
  readonly description?: string;
  readonly goal?: string;
  readonly recommendedFor?: string;
  readonly cta?: string;
  readonly pathSuggestion?: string;
  readonly difficulty?: string;
  readonly status?: string;
  readonly blocksPresetKey?: string | null;
  readonly funnelTemplateId?: string | null;
  readonly sourceFunnelId?: string | null;
  readonly sourceFunnelInstanceId?: string | null;
}
