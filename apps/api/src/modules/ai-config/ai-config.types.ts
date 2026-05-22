export type AiRuntimeContext = {
  version: 'leadflow.ai-runtime-context.v1';
  config_version: string;
  basePrompt: string;
  base_prompt: string;
  routing: {
    provider: string;
    channel: 'whatsapp';
    instance_name: string;
    service_owner_key: 'lead-handler';
  };
  tenant: {
    id: string;
    name: string;
    code: string;
    vertical_key: string;
    brand_key: string;
    business_model_type: string;
  };
  member: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    public_slug: string | null;
    whatsapp_link: string | null;
  };
  placeholders: {
    name: string;
    team_name: string;
    whatsapp_link: string | null;
  };
  wallet: {
    account_id: string | null;
    balance: string | null;
    status: 'resolved' | 'unavailable';
    reason: string | null;
  };
  ai_agent: {
    basePrompt: string;
    base_prompt: string;
    route_contexts: Record<string, unknown>;
    cta_policy: Record<string, unknown>;
    ai_policy: Record<string, unknown>;
  };
  kloser: KloserTenantConfig;
  resolution: {
    strategy: 'member_override' | 'tenant_default' | 'development_fallback';
    tenant_config_id: string | null;
    member_config_id: string | null;
  };
};

export interface KloserTenantConfig {
  strategy: {
    id: string;
    version: string;
    enabled: boolean;
    max_attempts: number;
    cadence_minutes: number[];
  };
  compliance_policy: {
    has_whatsapp_opt_in: boolean;
    quiet_hours: { start: string; end: string };
  };
  cta_policy: {
    type: string;
    required: boolean;
    shortener: string;
    allowed_domains: string[];
    base_url: string | null;
    requires_shortener: boolean;
  };
  message_policy: {
    template_id: string;
    language: string;
    variables: Record<string, any>;
    max_length: number;
    requires_personalization: boolean;
    forbidden_claims: string[];
  };
}

export type ResolveFullRuntimeResponse = {
  tenant_id: string;
  app_key: 'leadflow_api';
  platform_key: 'leadflow';
  product_key: 'leadflow';
  vertical_key: string;
  brand_key: string;
  business_model_type: string;
  service_owner_key: 'lead-handler';
  wallet_subject: {
    type: 'sponsor';
    id: string;
    account_id: string | null;
    balance: string | null;
    status: 'resolved' | 'unavailable';
    reason: string | null;
  };
  basePrompt: string;
  base_prompt: string;
  runtime_config: AiRuntimeContext;
  config_version: string;
  status: 'active';
};

export type AiConfigRouteContextKey =
  | 'risk'
  | 'offer'
  | 'product'
  | 'service'
  | 'business';

export type AiConfigEditorSnapshot = {
  configId: string | null;
  tenantId: string;
  memberId: string;
  tenantName: string;
  memberName: string;
  basePrompt: string;
  routeContexts: Record<AiConfigRouteContextKey, string>;
  ctaPolicy: {
    defaultCta: string | null;
  };
  kloser: KloserTenantConfig;
  resolution: {
    strategy: 'member_override' | 'tenant_default' | 'empty';
    tenantConfigId: string | null;
    memberConfigId: string | null;
  };
  availablePlaceholders: string[];
  updatedAt: string | null;
};

export type InitOrchestrationSessionInput = {
  instanceName?: string | null;
  teamId?: string | null;
  funnelId: string;
  funnelContext?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

export type InitOrchestrationSessionResponse = {
  status: number;
  sessionId: string;
  runtimeContext: AiRuntimeContext;
  data: unknown;
};

export type ExecuteOrchestrationInput = {
  instanceName?: string | null;
  teamId?: string | null;
  sessionId: string;
  prompt?: string | null;
  intent?: string | null;
};

export type ExecuteOrchestrationResponse = {
  status: number;
  sessionId: string;
  runtimeContext: AiRuntimeContext;
  data: unknown;
};

export type CloseOrchestrationSessionInput = {
  instanceName?: string | null;
  teamId?: string | null;
  sessionId: string;
};

export type CloseOrchestrationSessionResponse = {
  status: number;
  sessionId: string;
  runtimeContext: AiRuntimeContext;
  data: unknown;
};
