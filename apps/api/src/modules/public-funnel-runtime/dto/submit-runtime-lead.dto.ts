import type { LeadSourceChannel } from '../../shared/domain.types';

export class SubmitRuntimeLeadDto {
  readonly hostname!: string;
  readonly path?: string;
  readonly submissionEventId?: string | null;
  readonly anonymousId?: string | null;
  readonly sourceChannel?: LeadSourceChannel;
  readonly sourceUrl?: string | null;
  readonly utmSource?: string | null;
  readonly utmCampaign?: string | null;
  readonly utmMedium?: string | null;
  readonly utmContent?: string | null;
  readonly utmTerm?: string | null;
  readonly fbclid?: string | null;
  readonly gclid?: string | null;
  readonly ttclid?: string | null;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly fullName?: string | null;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly companyName?: string | null;
  readonly fieldValues?: Record<string, string | null>;
  readonly tags?: string[];
}
