import type { LeadSourceChannel } from '../../shared/domain.types';

export class CapturePublicLeadDto {
  readonly triggerEventId?: string | null;
  readonly publicationId!: string;
  readonly visitorId?: string | null;
  readonly anonymousId?: string | null;
  readonly sourceChannel?: LeadSourceChannel;
  readonly fullName?: string | null;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly companyName?: string | null;
  readonly tags?: string[];
}
