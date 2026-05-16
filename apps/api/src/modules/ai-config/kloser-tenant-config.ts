import {
  DEFAULT_AI_VERTICAL_KEY,
  normalizeRuntimeRoutingToken,
} from './ai-config.defaults';
import type { KloserTenantConfig } from './ai-config.types';

type JsonRecord = Record<string, unknown>;

const DEFAULT_KLOSER_CONFIG: KloserTenantConfig = {
  strategy: {
    id: 'leadflow_default_follow_up',
    version: '2.2',
    enabled: true,
    max_attempts: 3,
    cadence_minutes: [1440],
  },
  compliance_policy: {
    has_whatsapp_opt_in: true,
    quiet_hours: {
      start: '21:00',
      end: '08:00',
    },
  },
  cta_policy: {
    type: 'whatsapp',
    required: true,
    shortener: 'none',
    allowed_domains: [],
  },
  message_policy: {
    template_id: 'leadflow_follow_up_v1',
    language: 'es',
    variables: {},
    max_length: 1024,
    requires_personalization: true,
  },
};

const isJsonRecord = (value: unknown): value is JsonRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toJsonRecord = (value: unknown): JsonRecord =>
  isJsonRecord(value) ? { ...value } : {};

const readRecord = (
  record: JsonRecord,
  keys: readonly string[],
): JsonRecord => {
  for (const key of keys) {
    const value = toJsonRecord(record[key]);

    if (Object.keys(value).length > 0) {
      return value;
    }
  }

  return {};
};

const hasFields = (record: JsonRecord) => Object.keys(record).length > 0;

const readString = (
  record: JsonRecord,
  keys: readonly string[],
  fallback: string,
) => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return fallback;
};

const readNullableString = (
  record: JsonRecord,
  keys: readonly string[],
): string | null => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
};

const readBoolean = (
  record: JsonRecord,
  keys: readonly string[],
  fallback: boolean,
) => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'boolean') {
      return value;
    }
  }

  return fallback;
};

const readNumber = (
  record: JsonRecord,
  keys: readonly string[],
  fallback: number,
) => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return fallback;
};

const readNumberArray = (
  record: JsonRecord,
  keys: readonly string[],
  fallback: number[],
) => {
  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      const numbers = value.filter(
        (item): item is number =>
          typeof item === 'number' && Number.isFinite(item) && item > 0,
      );

      if (numbers.length > 0) {
        return numbers;
      }
    }
  }

  return fallback;
};

const readStringArray = (
  record: JsonRecord,
  keys: readonly string[],
  fallback: string[],
) => {
  for (const key of keys) {
    const value = record[key];

    if (Array.isArray(value)) {
      const strings = value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);

      if (strings.length > 0) {
        return strings;
      }
    }
  }

  return fallback;
};

const readRoutingToken = (
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

export const resolveKloserTenantConfig = (input: {
  aiPolicy?: unknown;
  ctaPolicy?: unknown;
}): KloserTenantConfig => {
  const aiPolicy = toJsonRecord(input.aiPolicy);
  const ctaPolicy = toJsonRecord(input.ctaPolicy);
  const kloser = readRecord(aiPolicy, ['kloser', 'kloser_config']);
  const strategy = readRecord(kloser, ['strategy']);
  const compliancePolicy = readRecord(kloser, [
    'compliance_policy',
    'compliancePolicy',
  ]);
  const quietHours = readRecord(compliancePolicy, [
    'quiet_hours',
    'quietHours',
  ]);
  const kloserCtaPolicy = readRecord(kloser, ['cta_policy', 'ctaPolicy']);
  const nestedCtaPolicy = readRecord(ctaPolicy, ['kloser', 'kloser_config']);
  const ctaPolicyOverride = hasFields(kloserCtaPolicy)
    ? kloserCtaPolicy
    : hasFields(nestedCtaPolicy)
      ? nestedCtaPolicy
      : ctaPolicy;
  const messagePolicy = readRecord(kloser, [
    'message_policy',
    'messagePolicy',
  ]);

  return {
    strategy: {
      id: readString(strategy, ['id'], DEFAULT_KLOSER_CONFIG.strategy.id),
      version: readString(
        strategy,
        ['version'],
        DEFAULT_KLOSER_CONFIG.strategy.version,
      ),
      enabled: readBoolean(
        strategy,
        ['enabled'],
        DEFAULT_KLOSER_CONFIG.strategy.enabled,
      ),
      max_attempts: readNumber(
        strategy,
        ['max_attempts', 'maxAttempts'],
        DEFAULT_KLOSER_CONFIG.strategy.max_attempts,
      ),
      cadence_minutes: readNumberArray(
        strategy,
        ['cadence_minutes', 'cadenceMinutes'],
        DEFAULT_KLOSER_CONFIG.strategy.cadence_minutes,
      ),
    },
    compliance_policy: {
      has_whatsapp_opt_in: readBoolean(
        compliancePolicy,
        ['has_whatsapp_opt_in', 'hasWhatsappOptIn'],
        DEFAULT_KLOSER_CONFIG.compliance_policy.has_whatsapp_opt_in,
      ),
      quiet_hours: {
        start: readString(
          quietHours,
          ['start'],
          DEFAULT_KLOSER_CONFIG.compliance_policy.quiet_hours.start,
        ),
        end: readString(
          quietHours,
          ['end'],
          DEFAULT_KLOSER_CONFIG.compliance_policy.quiet_hours.end,
        ),
      },
    },
    cta_policy: {
      type: readString(
        ctaPolicyOverride,
        ['type'],
        DEFAULT_KLOSER_CONFIG.cta_policy.type,
      ),
      required: readBoolean(
        ctaPolicyOverride,
        ['required'],
        DEFAULT_KLOSER_CONFIG.cta_policy.required,
      ),
      shortener: readString(
        ctaPolicyOverride,
        ['shortener'],
        DEFAULT_KLOSER_CONFIG.cta_policy.shortener,
      ),
      allowed_domains: readStringArray(
        ctaPolicyOverride,
        ['allowed_domains', 'allowedDomains'],
        DEFAULT_KLOSER_CONFIG.cta_policy.allowed_domains,
      ),
    },
    message_policy: {
      template_id: readString(
        messagePolicy,
        ['template_id', 'templateId'],
        DEFAULT_KLOSER_CONFIG.message_policy.template_id,
      ),
      language: readString(
        messagePolicy,
        ['language'],
        DEFAULT_KLOSER_CONFIG.message_policy.language,
      ),
      variables: toJsonRecord(messagePolicy.variables) as Record<string, any>,
      max_length: readNumber(
        messagePolicy,
        ['max_length', 'maxLength'],
        DEFAULT_KLOSER_CONFIG.message_policy.max_length,
      ),
      requires_personalization: readBoolean(
        messagePolicy,
        ['requires_personalization', 'requiresPersonalization'],
        DEFAULT_KLOSER_CONFIG.message_policy.requires_personalization,
      ),
    },
  };
};

export const resolveKloserRuntimeAttributes = (input: {
  aiPolicy?: unknown;
  routeContexts?: unknown;
  verticalFallback?: string | null;
}) => {
  const aiPolicy = toJsonRecord(input.aiPolicy);
  const routeContexts = toJsonRecord(input.routeContexts);
  const kloser = readRecord(aiPolicy, ['kloser', 'kloser_config']);

  return {
    vertical:
      readRoutingToken(kloser, ['vertical', 'vertical_key', 'verticalKey']) ??
      readRoutingToken(aiPolicy, ['vertical', 'vertical_key', 'verticalKey']) ??
      readRoutingToken(routeContexts, [
        'vertical',
        'vertical_key',
        'verticalKey',
      ]) ??
      input.verticalFallback ??
      DEFAULT_AI_VERTICAL_KEY,
    wallet_account_id:
      readNullableString(kloser, ['wallet_account_id', 'walletAccountId']) ??
      readNullableString(aiPolicy, ['wallet_account_id', 'walletAccountId']),
  };
};
