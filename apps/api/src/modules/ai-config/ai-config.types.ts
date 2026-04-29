export type AiRuntimeContext = {
  version: 'leadflow.ai-runtime-context.v1';
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
    base_prompt: string;
    route_contexts: Record<string, unknown>;
    cta_policy: Record<string, unknown>;
    ai_policy: Record<string, unknown>;
  };
  resolution: {
    strategy: 'member_override' | 'tenant_default';
    tenant_config_id: string | null;
    member_config_id: string | null;
  };
};

export type ResolveFullRuntimeResponse = {
  tenant_id: string;
  app_key: 'leadflow_api';
  platform_key: 'kurukin';
  product_key: 'leadflow';
  vertical_key: string;
  service_owner_key: 'lead-handler';
  wallet_subject: {
    type: 'sponsor';
    id: string;
    account_id: string | null;
    balance: string | null;
    status: 'resolved' | 'unavailable';
    reason: string | null;
  };
  runtime_config: AiRuntimeContext;
  config_version: AiRuntimeContext['version'];
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
  sessionId: string;
};

export type CloseOrchestrationSessionResponse = {
  status: number;
  sessionId: string;
  runtimeContext: AiRuntimeContext;
  data: unknown;
};
