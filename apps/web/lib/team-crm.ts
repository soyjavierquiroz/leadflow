import { apiFetchWithSession } from "@/lib/auth";

export type UnifiedCrmLeadSource =
  | "leadflow"
  | "supabase"
  | "merged_candidate";

export type UnifiedCrmTab =
  | "registered"
  | "conversational"
  | "all"
  | "duplicates"
  | "unassigned";

export type UnifiedCrmInboxSource = "leadflow" | "supabase" | "all";

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
    origin_type: "form" | "whatsapp" | "campaign" | "manual" | "unknown";
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
      source: "leadflow" | "supabase";
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

export type TeamCrmInboxSnapshotParams = {
  tab?: UnifiedCrmTab;
  limit?: number;
  q?: string;
  owner?: string;
  status?: string;
  source?: UnifiedCrmInboxSource;
};

const getErrorMessage = (payload: unknown, fallback: string) =>
  (typeof payload === "object" &&
  payload !== null &&
  "message" in payload &&
  typeof payload.message === "string"
    ? payload.message
    : null) ??
  (typeof payload === "object" &&
  payload !== null &&
  "error" in payload &&
  typeof payload.error === "string"
    ? payload.error
    : null) ??
  fallback;

const buildInboxQuery = (params: TeamCrmInboxSnapshotParams) => {
  const searchParams = new URLSearchParams();

  if (params.tab) {
    searchParams.set("tab", params.tab);
  }

  if (params.limit) {
    searchParams.set("limit", String(params.limit));
  }

  if (params.q?.trim()) {
    searchParams.set("q", params.q.trim());
  }

  if (params.owner?.trim()) {
    searchParams.set("owner", params.owner.trim());
  }

  if (params.status?.trim()) {
    searchParams.set("status", params.status.trim());
  }

  if (params.source && params.source !== "all") {
    searchParams.set("source", params.source);
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
};

export const getTeamCrmInboxSnapshot = async (
  params: TeamCrmInboxSnapshotParams = {},
): Promise<UnifiedCrmInboxResponse> => {
  const response = await apiFetchWithSession(
    `/team/crm/inbox${buildInboxQuery(params)}`,
  );
  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload, "No pudimos cargar el CRM unificado del team."),
    );
  }

  return payload as UnifiedCrmInboxResponse;
};
