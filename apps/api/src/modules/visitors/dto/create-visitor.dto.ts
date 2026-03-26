import type { LeadSourceChannel } from '../../shared/domain.types';

export class CreateVisitorDto {
  readonly workspaceId!: string;
  readonly anonymousId!: string;
  readonly kind?: 'anonymous' | 'identified';
  readonly sourceChannel!: LeadSourceChannel;
  readonly leadId?: string | null;
  readonly sourceUrl?: string | null;
  readonly utmSource?: string | null;
  readonly utmCampaign?: string | null;
  readonly utmMedium?: string | null;
  readonly utmContent?: string | null;
  readonly utmTerm?: string | null;
  readonly fbclid?: string | null;
  readonly gclid?: string | null;
  readonly ttclid?: string | null;
}
