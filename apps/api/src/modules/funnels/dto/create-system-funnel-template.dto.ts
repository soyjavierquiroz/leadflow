import type { JsonValue, LeadSourceChannel } from '../../shared/domain.types';
import type { FunnelStatus } from '../interfaces/funnel.interface';

export class CreateSystemFunnelTemplateDto {
  readonly name!: string;
  readonly description?: string | null;
  readonly status?: FunnelStatus;
  readonly stages?: string[];
  readonly entrySources?: LeadSourceChannel[];
  readonly thumbnailUrl?: string | null;
  readonly config?: JsonValue;
}
