type JsonRecord = Record<string, unknown>;

export const DEFAULT_AI_VERTICAL_KEY = 'multinivel' as const;
export const DEFAULT_AI_BUSINESS_MODEL_TYPE = 'multinivel' as const;
export const DEFAULT_AI_BRAND_KEY = 'leadflow' as const;
export const DEFAULT_TENANT_AI_BASE_PROMPT =
  'Actua como asesor de {{team_name}} para conversaciones de negocio multinivel. Personaliza la ayuda para {{name}}, prioriza claridad, seguimiento util y una invitacion natural a continuar por WhatsApp cuando aplique.';

const unknownRuntimeTokens = new Set([
  'unknown',
  'undefined',
  'null',
  'n/a',
  'na',
]);

const isJsonRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const cloneJsonRecord = (value: JsonRecord): JsonRecord =>
  Object.fromEntries(Object.entries(value));

export const toRuntimeJsonRecord = (value: unknown): JsonRecord =>
  isJsonRecord(value) ? cloneJsonRecord(value) : {};

export const normalizeRuntimeRoutingToken = (value: unknown) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized || unknownRuntimeTokens.has(normalized)) {
    return null;
  }

  return normalized;
};

const readFirstRoutingToken = (
  record: JsonRecord,
  keys: readonly string[],
): string | null => {
  for (const key of keys) {
    const value = normalizeRuntimeRoutingToken(record[key]);

    if (value) {
      return value;
    }
  }

  return null;
};

export type AiRuntimeRoutingMetadata = {
  vertical_key: string;
  brand_key: string;
  business_model_type: string;
};

export const resolveAiRuntimeRoutingMetadata = (input: {
  tenantCode?: unknown;
  brandKey?: unknown;
  aiPolicy?: unknown;
  routeContexts?: unknown;
}): AiRuntimeRoutingMetadata => {
  const aiPolicy = toRuntimeJsonRecord(input.aiPolicy);
  const routeContexts = toRuntimeJsonRecord(input.routeContexts);
  const tenantCode = normalizeRuntimeRoutingToken(input.tenantCode);
  const brandFallback =
    normalizeRuntimeRoutingToken(input.brandKey) ??
    tenantCode ??
    DEFAULT_AI_BRAND_KEY;

  return {
    vertical_key:
      readFirstRoutingToken(aiPolicy, [
        'vertical_key',
        'verticalKey',
        'vertical',
      ]) ??
      readFirstRoutingToken(routeContexts, [
        'vertical_key',
        'verticalKey',
        'vertical',
      ]) ??
      DEFAULT_AI_VERTICAL_KEY,
    brand_key:
      readFirstRoutingToken(aiPolicy, ['brand_key', 'brandKey', 'brand']) ??
      readFirstRoutingToken(routeContexts, [
        'brand_key',
        'brandKey',
        'brand',
      ]) ??
      brandFallback,
    business_model_type:
      readFirstRoutingToken(aiPolicy, [
        'business_model_type',
        'businessModelType',
        'business_model',
        'businessModel',
      ]) ??
      readFirstRoutingToken(routeContexts, [
        'business_model_type',
        'businessModelType',
        'business_model',
        'businessModel',
      ]) ??
      DEFAULT_AI_BUSINESS_MODEL_TYPE,
  };
};

export const withDefaultAiRuntimeRoutingMetadata = (
  value: unknown,
  input: {
    tenantCode?: unknown;
    brandKey?: unknown;
  } = {},
): JsonRecord => {
  const current = toRuntimeJsonRecord(value);
  const metadata = resolveAiRuntimeRoutingMetadata({
    tenantCode: input.tenantCode,
    brandKey: input.brandKey,
    aiPolicy: current,
  });

  return {
    ...current,
    ...metadata,
  };
};
