export type UnifiedCrmLeadSource =
  | 'leadflow'
  | 'supabase'
  | 'merged_candidate';

export type UnifiedCrmInboxTab =
  | 'registered'
  | 'conversational'
  | 'all'
  | 'duplicates'
  | 'unassigned';

export type UnifiedCrmInboxSource = 'leadflow' | 'supabase' | 'all';

export type UnifiedCrmLead = {
  id: string;
  source: UnifiedCrmLeadSource;
  tenant_id: string;
  team_id: string;
  workspace_id?: string | null;
  contact: {
    display_name?: string | null;
    phone_e164?: string | null;
    whatsapp_id?: string | null;
    email?: string | null;
    company_name?: string | null;
  };
  leadflow?: {
    lead_id?: string | null;
    visitor_id?: string | null;
    funnel_id?: string | null;
    funnel_instance_id?: string | null;
    funnel_publication_id?: string | null;
    status?: string | null;
    qualification_grade?: string | null;
    current_assignment_id?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  supabase?: {
    saas_lead_id?: string | null;
    status?: string | null;
    source_app?: string | null;
    instance_id?: string | null;
    vertical_key?: string | null;
    last_message?: string | null;
    last_message_at?: string | null;
    memory_stage?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  owner: {
    sponsor_id?: string | null;
    display_name?: string | null;
    phone?: string | null;
    status?: string | null;
    assignment_status?: string | null;
    assigned_at?: string | null;
    accepted_at?: string | null;
  };
  origin: {
    origin_type: 'form' | 'whatsapp' | 'campaign' | 'manual' | 'unknown';
    source_channel?: string | null;
    traffic_layer?: string | null;
    funnel_name?: string | null;
    domain_host?: string | null;
    instance_id?: string | null;
    vertical_key?: string | null;
  };
  activity: {
    last_activity_at?: string | null;
    last_message?: string | null;
    message_count?: number;
    interaction_count?: number;
    ai_usage_count?: number;
  };
  dedupe: {
    identity_key?: string | null;
    confidence: number;
    match_reason?: string | null;
    possible_duplicate: boolean;
    duplicate_group_key?: string | null;
    matched_records?: Array<{
      source: 'leadflow' | 'supabase';
      id: string;
      reason: string;
      confidence: number;
    }>;
  };
  flags: {
    is_registered: boolean;
    is_conversational: boolean;
    has_assignment: boolean;
    is_orphaned: boolean;
    is_stagnant: boolean;
    is_closed: boolean;
    possible_duplicate: boolean;
  };
  created_at: string;
  updated_at: string;
};

export type UnifiedCrmInboxResponse = {
  data: UnifiedCrmLead[];
  page: {
    limit: number;
    cursor?: string | null;
    next_cursor?: string | null;
  };
  counts: {
    registrados: number;
    conversacionales: number;
    todos: number;
    posibles_duplicados: number;
    sin_owner: number;
  };
  diagnostics: {
    leadflow_available: boolean;
    supabase_available: boolean;
    supabase_enabled: boolean;
    supabase_error?: string | null;
  };
};

export type UnifiedCrmInboxQuery = {
  tab?: UnifiedCrmInboxTab;
  q?: string;
  owner?: string;
  status?: string;
  source?: UnifiedCrmInboxSource;
  limit?: string;
  cursor?: string;
};

export type UnifiedCrmScope = {
  workspaceId: string;
  teamId: string;
};

