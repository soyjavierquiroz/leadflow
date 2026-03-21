import type { LeadSourceChannel } from '../../shared/domain.types';

export class RegisterPublicVisitorDto {
  readonly publicationId!: string;
  readonly anonymousId!: string;
  readonly kind?: 'anonymous' | 'identified';
  readonly sourceChannel?: LeadSourceChannel;
  readonly utmSource?: string | null;
  readonly utmCampaign?: string | null;
}
