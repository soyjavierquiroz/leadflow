import { unstable_noStore as noStore } from "next/cache";
import { apiFetchWithSession } from "@/lib/auth";
import type {
  CreateSystemTenantResponse,
  JsonValue,
  ProvisionTenantResponse,
  SystemFunnelTemplateRecord,
  SystemTemplateDeploymentResponse,
  SystemTemplateRecord,
  SystemTenantDetailRecord,
  SystemTenantDomainRecord,
  SystemTenantFunnelDetailRecord,
  SystemTenantFunnelRecord,
  SystemTenantFunnelStepMutationResponse,
  SystemTenantFunnelStepRecord,
  SystemTenantRecord,
} from "@/lib/system-tenants.types";
import {
  buildResponseDebugContext,
  describePayloadShape,
  getErrorDebugDetails,
  logCriticalSsrError,
} from "@/lib/ssr-debug";
export type {
  CreateSystemTenantResponse,
  JsonValue,
  ProvisionTenantResponse,
  SystemFunnelTemplateRecord,
  SystemTemplateDeploymentResponse,
  SystemTemplateRecord,
  SystemTenantDetailRecord,
  SystemTenantDomainRecord,
  SystemTenantFunnelDetailRecord,
  SystemTenantFunnelRecord,
  SystemTenantFunnelStepMutationResponse,
  SystemTenantFunnelStepRecord,
  SystemTenantRecord,
} from "@/lib/system-tenants.types";

const encodePathSegment = (value: string) => encodeURIComponent(value);

const buildInvalidPayloadError = (context: string) =>
  new Error(`El API devolvió un payload inválido para ${context}.`);

const parseJsonPayload = async (response: Response, context: string) => {
  try {
    return (await response.json()) as unknown;
  } catch (error) {
    logCriticalSsrError(error, {
      operation: context,
      response: await buildResponseDebugContext(response),
      error: getErrorDebugDetails(error),
    });
    throw error;
  }
};

const ensureArrayPayload = async (response: Response, context: string) => {
  const payload = await parseJsonPayload(response, context);

  if (!Array.isArray(payload)) {
    const error = buildInvalidPayloadError(context);
    logCriticalSsrError(error, {
      operation: context,
      response: await buildResponseDebugContext(response),
      payloadShape: describePayloadShape(payload),
    });
    throw error;
  }

  return payload;
};

const ensureObjectPayload = async (response: Response, context: string) => {
  const payload = await parseJsonPayload(response, context);

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = buildInvalidPayloadError(context);
    logCriticalSsrError(error, {
      operation: context,
      response: await buildResponseDebugContext(response),
      payloadShape: describePayloadShape(payload),
    });
    throw error;
  }

  return payload;
};

const assertOkResponse = async (
  response: Response,
  message: string,
  context: string,
) => {
  if (response.ok) {
    return;
  }

  const error = new Error(message);
  logCriticalSsrError(error, {
    operation: context,
    response: await buildResponseDebugContext(response),
  });
  throw error;
};

export const getSystemTenants = async (options?: {
  includeArchived?: boolean;
}) => {
  noStore();

  try {
    const query = options?.includeArchived ? "?includeArchived=true" : "";
    const response = await apiFetchWithSession(`/system/tenants${query}`);

    await assertOkResponse(
      response,
      `No pudimos cargar los tenants del sistema (${response.status}).`,
      "getSystemTenants",
    );

    return (await ensureArrayPayload(
      response,
      "system/tenants",
    )) as SystemTenantRecord[];
  } catch (error) {
    logCriticalSsrError(error, {
      operation: "getSystemTenants",
      error: getErrorDebugDetails(error),
    });
    throw error;
  }
};

export const getSystemTenant = async (teamId: string) => {
  noStore();

  try {
    const response = await apiFetchWithSession(
      `/system/tenants/${encodePathSegment(teamId)}`,
    );

    if (response.status === 404) {
      return null;
    }

    await assertOkResponse(
      response,
      `No pudimos cargar el tenant solicitado (${response.status}).`,
      "getSystemTenant",
    );

    return (await ensureObjectPayload(
      response,
      "system/tenants/:id",
    )) as SystemTenantDetailRecord;
  } catch (error) {
    logCriticalSsrError(error, {
      operation: "getSystemTenant",
      teamId,
      error: getErrorDebugDetails(error),
    });
    throw error;
  }
};

export const getSystemTenantFunnels = async (teamId: string) => {
  noStore();

  try {
    const response = await apiFetchWithSession(
      `/system/tenants/${encodePathSegment(teamId)}/funnels`,
    );

    await assertOkResponse(
      response,
      `No pudimos cargar los funnels del tenant (${response.status}).`,
      "getSystemTenantFunnels",
    );

    return (await ensureArrayPayload(
      response,
      "system/tenants/:id/funnels",
    )) as SystemTenantFunnelRecord[];
  } catch (error) {
    logCriticalSsrError(error, {
      operation: "getSystemTenantFunnels",
      teamId,
      error: getErrorDebugDetails(error),
    });
    throw error;
  }
};

export const getSystemTenantFunnel = async (teamId: string, funnelId: string) => {
  noStore();

  try {
    const response = await apiFetchWithSession(
      `/system/tenants/${encodePathSegment(teamId)}/funnels/${encodePathSegment(funnelId)}`,
    );

    if (response.status === 404) {
      return null;
    }

    await assertOkResponse(
      response,
      `No pudimos cargar el funnel solicitado del tenant (${response.status}).`,
      "getSystemTenantFunnel",
    );

    return (await ensureObjectPayload(
      response,
      "system/tenants/:id/funnels/:funnelId",
    )) as SystemTenantFunnelDetailRecord;
  } catch (error) {
    logCriticalSsrError(error, {
      operation: "getSystemTenantFunnel",
      teamId,
      funnelId,
      error: getErrorDebugDetails(error),
    });
    throw error;
  }
};

export const getSystemTenantDomains = async (teamId: string) => {
  noStore();

  try {
    const response = await apiFetchWithSession(
      `/system/tenants/${encodePathSegment(teamId)}/domains`,
    );

    await assertOkResponse(
      response,
      `No pudimos cargar los dominios del tenant (${response.status}).`,
      "getSystemTenantDomains",
    );

    return (await ensureArrayPayload(
      response,
      "system/tenants/:id/domains",
    )) as SystemTenantDomainRecord[];
  } catch (error) {
    logCriticalSsrError(error, {
      operation: "getSystemTenantDomains",
      teamId,
      error: getErrorDebugDetails(error),
    });
    throw error;
  }
};

export const getSystemFunnelTemplates = async () => {
  noStore();

  try {
    const response = await apiFetchWithSession("/system/funnels/templates");

    await assertOkResponse(
      response,
      `No pudimos cargar los templates globales (${response.status}).`,
      "getSystemFunnelTemplates",
    );

    return (await ensureArrayPayload(
      response,
      "system/funnels/templates",
    )) as SystemFunnelTemplateRecord[];
  } catch (error) {
    logCriticalSsrError(error, {
      operation: "getSystemFunnelTemplates",
      error: getErrorDebugDetails(error),
    });
    throw error;
  }
};

export const getWorkspaceFunnelTemplates = async (workspaceId: string) => {
  noStore();

  try {
    const response = await apiFetchWithSession(
      `/funnel-templates?workspaceId=${encodeURIComponent(workspaceId)}`,
    );

    await assertOkResponse(
      response,
      `No pudimos cargar los templates del workspace (${response.status}).`,
      "getWorkspaceFunnelTemplates",
    );

    return (await ensureArrayPayload(
      response,
      "funnel-templates del workspace",
    )) as SystemTemplateRecord[];
  } catch (error) {
    logCriticalSsrError(error, {
      operation: "getWorkspaceFunnelTemplates",
      workspaceId,
      error: getErrorDebugDetails(error),
    });
    throw error;
  }
};

export const getSystemTemplates = async () => {
  noStore();

  try {
    const response = await apiFetchWithSession("/system/templates");

    await assertOkResponse(
      response,
      `No pudimos cargar el catálogo global de templates (${response.status}).`,
      "getSystemTemplates",
    );

    return (await ensureArrayPayload(
      response,
      "system/templates",
    )) as SystemTemplateRecord[];
  } catch (error) {
    logCriticalSsrError(error, {
      operation: "getSystemTemplates",
      error: getErrorDebugDetails(error),
    });
    throw error;
  }
};

export const getSystemTemplate = async (templateId: string) => {
  noStore();

  try {
    const response = await apiFetchWithSession(
      `/system/templates/${encodePathSegment(templateId)}`,
    );

    if (response.status === 404) {
      return null;
    }

    await assertOkResponse(
      response,
      `No pudimos cargar el template solicitado (${response.status}).`,
      "getSystemTemplate",
    );

    return (await ensureObjectPayload(
      response,
      "system/templates/:id",
    )) as SystemTemplateRecord;
  } catch (error) {
    logCriticalSsrError(error, {
      operation: "getSystemTemplate",
      templateId,
      error: getErrorDebugDetails(error),
    });
    throw error;
  }
};
