export const CRM_EXTERNAL_DISPATCHER = Symbol('CRM_EXTERNAL_DISPATCHER');

export type CrmExternalOutreachHandoffPayload = {
  outreach_id: string;
  assignment_id: string;
  workspace_id: string;
  team_id: string;
  sponsor_id: string;
  lead: {
    id: string;
    first_name: string | null;
    phone_e164: string | null;
  };
  campaign: {
    type: 'initial_contact';
    variant_key: string;
  };
  safety: {
    quiet_hours_checked: boolean;
    duplicate_protection: boolean;
    rate_limit_checked: boolean;
    mlm_policy_checked: boolean;
  };
  dispatch: {
    scheduled_for: string | null;
    priority: 'normal';
    jitter_ms: number | null;
  };
};

export type CrmExternalHandoffResult = {
  accepted: boolean;
  external_id?: string | null;
  reason?: string | null;
};

export type CrmExternalCancelResult = {
  accepted: boolean;
  reason?: string | null;
};

export type CrmExternalDeliveryStatus =
  | 'unknown'
  | 'handed_off'
  | 'dispatched'
  | 'failed'
  | 'cancelled';

export interface CrmExternalDispatcherPort {
  handoffOutreach(
    payload: CrmExternalOutreachHandoffPayload,
  ): Promise<CrmExternalHandoffResult>;

  cancelOutreach(input: {
    outreach_id: string;
    workspace_id: string;
    reason?: string | null;
  }): Promise<CrmExternalCancelResult>;

  getDeliveryStatus(input: {
    outreach_id: string;
    workspace_id: string;
  }): Promise<{
    status: CrmExternalDeliveryStatus;
    external_id?: string | null;
    reason?: string | null;
  }>;
}
