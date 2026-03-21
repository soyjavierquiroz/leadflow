import type { LeadSourceChannel } from '../../shared/domain.types';

export class SubmitPublicLeadCaptureDto {
  readonly submissionEventId?: string | null;
  readonly publicationId!: string;
  readonly currentStepId!: string;
  readonly anonymousId!: string;
  readonly sourceChannel?: LeadSourceChannel;
  readonly utmSource?: string | null;
  readonly utmCampaign?: string | null;
  readonly fullName?: string | null;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly companyName?: string | null;
  readonly tags?: string[];
}
