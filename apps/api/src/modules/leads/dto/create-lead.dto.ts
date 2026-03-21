import type { LeadSourceChannel } from '../../shared/domain.types';

export class CreateLeadDto {
  readonly workspaceId!: string;
  readonly funnelId!: string;
  readonly visitorId?: string | null;
  readonly sourceChannel!: LeadSourceChannel;
  readonly fullName?: string | null;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly companyName?: string | null;
  readonly tags?: string[];
}
