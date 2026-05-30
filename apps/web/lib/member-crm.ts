import { webPublicConfig } from "@/lib/public-env";

export type AdvisorCrmInboxTab =
  | "all"
  | "handoffs"
  | "active"
  | "external_matches"
  | "duplicates";

export type AdvisorCrmInboxSource = "all" | "leadflow" | "supabase";

export type AdvisorCrmStatusFilter =
  | "all"
  | "pending"
  | "assigned"
  | "pending_assignment"
  | "accepted"
  | "auto_accepted"
  | "reassigned"
  | "closed"
  | "conversation_started";

export type AdvisorCrmLifecycleStatus =
  | "pending"
  | "assigned"
  | "pending_assignment"
  | "accepted"
  | "auto_accepted"
  | "expired"
  | "reassigned"
  | "closed";

export type AdvisorCrmAssignmentSource =
  | "wheel"
  | "organic"
  | "whatsapp_inbound"
  | "manual"
  | "campaign"
  | "reassignment";

export type AdvisorCrmOwnershipSource =
  | "conversation_owner"
  | "accepted_assignment"
  | "assigned_sponsor"
  | "attribution"
  | "unowned";

export type AdvisorCrmSponsorSummary = {
  id: string;
  display_name: string;
  phone?: string | null;
  status?: string | null;
};

export type AdvisorCrmOutreachState = {
  has_initial_contact_queued: boolean;
  status?: string | null;
  intent_type?: string | null;
  created_at?: string | null;
  scheduled_at?: string | null;
};

export type AdvisorCrmLeadSource = "leadflow" | "supabase" | "merged_candidate";

export type AdvisorCrmLead = {
  id: string;
  source: AdvisorCrmLeadSource;
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
  advisor_context: {
    assignment_id?: string | null;
    legacy_assignment_id?: string | null;
    crm_assignment_id?: string | null;
    assignment_status?: AdvisorCrmLifecycleStatus | string | null;
    assignment_source?: AdvisorCrmAssignmentSource | string | null;
    assigned_at?: string | null;
    accepted_at?: string | null;
    ownership_locked_until?: string | null;
    is_current_sponsor_owner: boolean;
    ownership_source?: AdvisorCrmOwnershipSource | null;
    conversation_owner?: AdvisorCrmSponsorSummary | null;
    assigned_sponsor?: AdvisorCrmSponsorSummary | null;
    attributed_sponsor?: AdvisorCrmSponsorSummary | null;
    accepted_by_sponsor?: AdvisorCrmSponsorSummary | null;
    outreach?: AdvisorCrmOutreachState;
    has_external_conversation: boolean;
    external_conversation_count: number;
    latest_external_message?: string | null;
    latest_external_message_at?: string | null;
  };
  created_at: string;
  updated_at: string;
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

export type AdvisorCrmInboxSnapshotParams = {
  tab?: AdvisorCrmInboxTab;
  limit?: number;
  q?: string;
  source?: AdvisorCrmInboxSource;
  status?: AdvisorCrmStatusFilter;
  cursor?: string;
};

const getErrorMessage = (payload: unknown, fallback: string) =>
  (typeof payload === "object" &&
  payload !== null &&
  "message" in payload &&
  typeof (payload as any).message === "string"
    ? (payload as any).message
    : null) ??
  (typeof payload === "object" &&
  payload !== null &&
  "error" in payload &&
  typeof (payload as any).error === "string"
    ? (payload as any).error
    : null) ??
  fallback;

export const appendAdvisorCrmInboxQuery = (
  searchParams: URLSearchParams,
  params: AdvisorCrmInboxSnapshotParams,
) => {
  if (params.tab) searchParams.set("tab", params.tab);
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.q?.trim()) searchParams.set("q", params.q.trim());
  if (params.source && params.source !== "all")
    searchParams.set("source", params.source);

  if (
    params.status === "pending" ||
    params.status === "assigned" ||
    params.status === "pending_assignment" ||
    params.status === "accepted" ||
    params.status === "auto_accepted" ||
    params.status === "reassigned" ||
    params.status === "closed"
  ) {
    searchParams.set("assignment_status", params.status);
  }

  if (params.cursor?.trim()) searchParams.set("cursor", params.cursor.trim());
};

export const buildAdvisorCrmInboxPath = (
  params: AdvisorCrmInboxSnapshotParams,
) => {
  const searchParams = new URLSearchParams();
  appendAdvisorCrmInboxQuery(searchParams, params);
  const queryString = searchParams.toString();

  return `/sponsors/me/crm/inbox${queryString ? `?${queryString}` : ""}`;
};

/**
 * ✅ FIX PRINCIPAL:
 * Eliminado auth.ts completamente
 * Reemplazado por fetch simple con cookies (credentials)
 */
export const getAdvisorCrmInboxSnapshot = async (
  params: AdvisorCrmInboxSnapshotParams = {},
): Promise<AdvisorCrmInboxResponse> => {
  const response = await fetch(buildAdvisorCrmInboxPath(params), {
    method: "GET",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload, "No pudimos cargar la bandeja CRM del asesor."),
    );
  }

  return payload as AdvisorCrmInboxResponse;
};

export type AcceptedAdvisorCrmAssignment = {
  id: string;
  workspaceId: string;
  teamId: string;
  leadId: string;
  attributedSponsorId: string | null;
  assignedSponsorId: string | null;
  acceptedBySponsorId: string | null;
  conversationOwnerSponsorId: string | null;
  assignmentStatus: AdvisorCrmLifecycleStatus;
  assignmentSource: AdvisorCrmAssignmentSource;
  ownershipLockedUntil: string | null;
  assignedAt: string | null;
  acceptedAt: string | null;
  lastConversationAt: string | null;
};

export const acceptAssignment = async (
  assignmentId: string,
): Promise<AcceptedAdvisorCrmAssignment> => {
  const response = await fetch(
    `${webPublicConfig.urls.api}/v1/sponsors/me/crm/assignments/${assignmentId}/accept`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    },
  );

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(
        payload,
        "No pudimos aceptar este lead. Intenta de nuevo.",
      ),
    );
  }

  return payload as AcceptedAdvisorCrmAssignment;
};