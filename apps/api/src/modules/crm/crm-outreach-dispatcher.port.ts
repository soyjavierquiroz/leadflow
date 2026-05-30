import type { CrmOutreachQueue } from '@prisma/client';

export const CRM_OUTREACH_DISPATCHER = Symbol('CRM_OUTREACH_DISPATCHER');

export interface CrmOutreachDispatcherPort {
  dispatch(item: CrmOutreachQueue): Promise<void>;
}
