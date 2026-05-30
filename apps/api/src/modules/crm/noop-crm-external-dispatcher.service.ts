import { Injectable } from '@nestjs/common';
import type {
  CrmExternalCancelResult,
  CrmExternalDispatcherPort,
  CrmExternalHandoffResult,
  CrmExternalOutreachHandoffPayload,
} from './crm-external-dispatcher.port';

@Injectable()
export class NoopCrmExternalDispatcherService
  implements CrmExternalDispatcherPort
{
  async handoffOutreach(
    _payload: CrmExternalOutreachHandoffPayload,
  ): Promise<CrmExternalHandoffResult> {
    return {
      accepted: true,
      external_id: null,
      reason: 'noop_dry_run',
    };
  }

  async cancelOutreach(_input: {
    outreach_id: string;
    workspace_id: string;
    reason?: string | null;
  }): Promise<CrmExternalCancelResult> {
    return {
      accepted: true,
      reason: 'noop_dry_run',
    };
  }

  async getDeliveryStatus(_input: {
    outreach_id: string;
    workspace_id: string;
  }) {
    return {
      status: 'unknown' as const,
      external_id: null,
      reason: 'noop_dry_run',
    };
  }
}
