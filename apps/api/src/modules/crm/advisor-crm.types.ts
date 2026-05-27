import type { UnifiedCrmLead } from './unified-crm.types';

export type AdvisorCrmInboxTab =
  | 'all'
  | 'handoffs'
  | 'active'
  | 'duplicates'
  | 'external_matches';

export type AdvisorCrmInboxQuery = {
  tab?: AdvisorCrmInboxTab;
  q?: string;
  status?: string;
  assignment_status?: string;
  limit?: string;
  cursor?: string;
};

export type AdvisorCrmContext = {
  assignment_id?: string | null;
  legacy_assignment_id?: string | null;
  crm_assignment_id?: string | null;
  assignment_status?: string | null;
  assignment_source?: string | null;
  assigned_at?: string | null;
  accepted_at?: string | null;
  ownership_locked_until?: string | null;
  is_current_sponsor_owner: boolean;
  ownership_source?:
    | 'conversation_owner'
    | 'accepted_assignment'
    | 'assigned_sponsor'
    | 'attribution'
    | 'unowned';
  conversation_owner?: AdvisorCrmSponsorSummary | null;
  assigned_sponsor?: AdvisorCrmSponsorSummary | null;
  attributed_sponsor?: AdvisorCrmSponsorSummary | null;
  accepted_by_sponsor?: AdvisorCrmSponsorSummary | null;
  outreach?: {
    has_initial_contact_queued: boolean;
    status?: string | null;
    intent_type?: string | null;
    created_at?: string | null;
    scheduled_at?: string | null;
  };
  has_external_conversation: boolean;
  external_conversation_count: number;
  latest_external_message?: string | null;
  latest_external_message_at?: string | null;
};

export type AdvisorCrmSponsorSummary = {
  id: string;
  display_name: string;
  phone?: string | null;
  status?: string | null;
};

export type AdvisorCrmLead = UnifiedCrmLead & {
  source: 'leadflow';
  advisor_context: AdvisorCrmContext;
};

export type AdvisorCrmInboxResponse = {
  data: AdvisorCrmLead[];
  page: {
    limit: number;
    cursor?: string | null;
    next_cursor?: string | null;
  };
  counts: {
    todos: number;
    handoffs: number;
    activos: number;
    duplicados: number;
    external_matches: number;
    total_visible: number;
    sin_conversacion: number;
  };
  diagnostics: {
    leadflow_available: boolean;
    supabase_available: boolean;
    supabase_enabled: boolean;
    supabase_error?: string | null;
    crm_candidate_limit_reached?: boolean;
  };
};

export type AdvisorCrmScope = {
  workspaceId: string;
  teamId: string;
  sponsorId: string;
};
