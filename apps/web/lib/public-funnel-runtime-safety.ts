import { resolveFunnelThemeId } from '@/lib/funnel-theme-registry';
import type {
  JsonValue,
  PublicFunnelRuntimePayload,
} from '@/lib/public-funnel-runtime.types';

type RuntimeFallback = {
  host?: string;
  path?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asString = (value: unknown, fallback = '') => {
  return typeof value === 'string' ? value : fallback;
};

const asBoolean = (value: unknown, fallback = false) => {
  return typeof value === 'boolean' ? value : fallback;
};

const asNumber = (value: unknown, fallback = 0) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const asNullableString = (value: unknown) =>
  typeof value === 'string' ? value : null;

const normalizeRuntimeHealthStatus = (value: unknown) => {
  return value === 'warning' || value === 'broken' ? value : 'healthy';
};

const asJsonValue = (value: unknown, fallback: JsonValue): JsonValue => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    Array.isArray(value) ||
    isRecord(value)
  ) {
    return value as JsonValue;
  }

  return fallback;
};

const normalizePath = (value: string, fallback = '/') => {
  const trimmed = value.trim() || fallback;
  if (!trimmed.startsWith('/')) {
    return `/${trimmed}`;
  }

  return trimmed || fallback;
};

const normalizeStep = (
  value: unknown,
  options: {
    fallbackPath: string;
    fallbackPosition: number;
    fallbackType?: string;
    fallbackId?: string;
  },
) => {
  const record = isRecord(value) ? value : {};

  return {
    id: asString(record.id, options.fallbackId ?? 'runtime-step'),
    slug: asString(record.slug),
    path: normalizePath(asString(record.path, options.fallbackPath), options.fallbackPath),
    stepType: asString(record.stepType, options.fallbackType ?? 'landing'),
    position: Math.max(1, asNumber(record.position, options.fallbackPosition)),
    isEntryStep: asBoolean(record.isEntryStep, options.fallbackPosition === 1),
    isConversionStep: asBoolean(record.isConversionStep),
    blocksJson: asJsonValue(record.blocksJson, []),
    mediaMap: asJsonValue(record.mediaMap, {}),
    settingsJson: asJsonValue(record.settingsJson, {}),
  };
};

const normalizeAdjacentStep = (
  value: unknown,
  fallbackPath: string,
  fallbackType = 'landing',
) => {
  const record = isRecord(value) ? value : null;
  if (!record) {
    return null;
  }

  return {
    id: asString(record.id, 'runtime-step'),
    slug: asString(record.slug),
    path: normalizePath(asString(record.path, fallbackPath), fallbackPath),
    stepType: asString(record.stepType, fallbackType),
  };
};

export function normalizePublicFunnelRuntimePayload(
  value: unknown,
  fallback: RuntimeFallback = {},
): PublicFunnelRuntimePayload {
  const record = isRecord(value) ? value : {};
  const requestRecord = isRecord(record.request) ? record.request : {};
  const domainRecord = isRecord(record.domain) ? record.domain : {};
  const entryContextRecord = isRecord(record.entryContext)
    ? record.entryContext
    : {};
  const publicationRecord = isRecord(record.publication) ? record.publication : {};
  const funnelRecord = isRecord(record.funnel) ? record.funnel : {};
  const templateRecord = isRecord(funnelRecord.template) ? funnelRecord.template : {};
  const trackingProfileRecord = isRecord(record.trackingProfile)
    ? record.trackingProfile
    : null;
  const handoffStrategyRecord = isRecord(record.handoffStrategy)
    ? record.handoffStrategy
    : null;
  const handoffRecord = isRecord(record.handoff) ? record.handoff : {};
  const resolvedHost =
    asString(requestRecord.host, asString(domainRecord.host, fallback.host ?? 'localhost')) ||
    fallback.host ||
    'localhost';
  const resolvedPath = normalizePath(
    asString(requestRecord.path, fallback.path ?? '/'),
    fallback.path ?? '/',
  );
  const currentStep = normalizeStep(record.currentStep, {
    fallbackId: 'runtime-current-step',
    fallbackPath: resolvedPath,
    fallbackPosition: 1,
  });
  const stepsValue = Array.isArray(record.steps) ? record.steps : [];
  const steps =
    stepsValue
      .map((step, index) =>
        normalizeStep(step, {
          fallbackId: `runtime-step-${index + 1}`,
          fallbackPath:
            index === 0 ? currentStep.path : `${resolvedPath}#step-${index + 1}`,
          fallbackPosition: index + 1,
          fallbackType: currentStep.stepType,
        }),
      )
      .filter(Boolean) ?? [];
  const normalizedSteps = steps.length > 0 ? steps : [currentStep];
  const activeCurrentStep = isRecord(record.currentStep)
    ? currentStep
    : normalizedSteps[0] ?? currentStep;
  const theme = resolveFunnelThemeId(record.theme);

  return {
    request: {
      host: resolvedHost,
      path: resolvedPath,
      publicationPathPrefix: normalizePath(
        asString(publicationRecord.pathPrefix, asString(requestRecord.publicationPathPrefix, resolvedPath)),
        resolvedPath,
      ),
      relativeStepPath: normalizePath(
        asString(requestRecord.relativeStepPath, activeCurrentStep.path),
        activeCurrentStep.path,
      ),
    },
    domain: {
      id: asString(domainRecord.id, 'runtime-domain'),
      host: asString(domainRecord.host, resolvedHost),
      normalizedHost: asString(domainRecord.normalizedHost, resolvedHost.toLowerCase()),
      domainType: asString(domainRecord.domainType, 'custom'),
      isPrimary: asBoolean(domainRecord.isPrimary, true),
      canonicalHost:
        typeof domainRecord.canonicalHost === 'string' ? domainRecord.canonicalHost : null,
      redirectToPrimary: asBoolean(domainRecord.redirectToPrimary),
    },
    entryContext: {
      entryMode:
        entryContextRecord.entryMode === 'organic_asesor'
          ? 'organic_asesor'
          : 'paid_ads',
      trafficLayer:
        entryContextRecord.trafficLayer === 'DIRECT' ||
        entryContextRecord.trafficLayer === 'PAID_WHEEL' ||
        entryContextRecord.trafficLayer === 'ORGANIC'
          ? entryContextRecord.trafficLayer
          : 'ORGANIC',
      forcedSponsorId:
        typeof entryContextRecord.forcedSponsorId === 'string'
          ? entryContextRecord.forcedSponsorId
          : null,
      adWheelId:
        typeof entryContextRecord.adWheelId === 'string'
          ? entryContextRecord.adWheelId
          : null,
      browserPixelsEnabled: asBoolean(
        entryContextRecord.browserPixelsEnabled,
        true,
      ),
    },
    publication: {
      id: asString(publicationRecord.id, 'runtime-publication'),
      pathPrefix: normalizePath(asString(publicationRecord.pathPrefix, resolvedPath), resolvedPath),
      isPrimary: asBoolean(publicationRecord.isPrimary, true),
      trackingProfileId:
        typeof publicationRecord.trackingProfileId === 'string'
          ? publicationRecord.trackingProfileId
          : null,
      handoffStrategyId:
        typeof publicationRecord.handoffStrategyId === 'string'
          ? publicationRecord.handoffStrategyId
          : null,
      metaPixelId:
        asNullableString(publicationRecord.metaPixelId),
      tiktokPixelId:
        asNullableString(publicationRecord.tiktokPixelId),
      seoTitle: asNullableString(publicationRecord.seoTitle),
      seoDescription: asNullableString(publicationRecord.seoDescription),
      ogImageUrl: asNullableString(publicationRecord.ogImageUrl),
      faviconUrl: asNullableString(publicationRecord.faviconUrl),
      nextStepPath: asNullableString(publicationRecord.nextStepPath),
      manifestVersion: Math.max(
        1,
        asNumber(publicationRecord.manifestVersion, 1),
      ),
      runtimeHealthStatus: normalizeRuntimeHealthStatus(
        publicationRecord.runtimeHealthStatus,
      ),
    },
    theme,
    funnel: {
      id: asString(funnelRecord.id, 'runtime-funnel'),
      name: asString(funnelRecord.name, 'Public Funnel'),
      code: asString(funnelRecord.code, 'public-funnel'),
      status: asString(funnelRecord.status, 'active'),
      structuralType:
        typeof funnelRecord.structuralType === 'string'
          ? funnelRecord.structuralType
          : null,
      conversionContract: asJsonValue(funnelRecord.conversionContract, {}),
      settingsJson: asJsonValue(funnelRecord.settingsJson, {}),
      mediaMap: asJsonValue(funnelRecord.mediaMap, {}),
      template: {
        id: asString(templateRecord.id, 'runtime-template'),
        code: asString(templateRecord.code, 'legacy-template'),
        name: asString(templateRecord.name, 'Legacy Template'),
        version: Math.max(1, asNumber(templateRecord.version, 1)),
        funnelType: asString(templateRecord.funnelType, 'legacy'),
        blocksJson: asJsonValue(templateRecord.blocksJson, []),
        mediaMap: asJsonValue(templateRecord.mediaMap, {}),
        settingsJson: asJsonValue(templateRecord.settingsJson, {}),
        allowedOverridesJson: asJsonValue(templateRecord.allowedOverridesJson, {}),
      },
    },
    trackingProfile: trackingProfileRecord
      ? {
          id: asString(trackingProfileRecord.id, 'runtime-tracking-profile'),
          name: asString(trackingProfileRecord.name, 'Tracking profile'),
          provider: asString(trackingProfileRecord.provider, 'unknown'),
          deduplicationMode: asString(
            trackingProfileRecord.deduplicationMode,
            'none',
          ),
          configJson: asJsonValue(trackingProfileRecord.configJson, {}),
          conversionEventMappings: Array.isArray(
            trackingProfileRecord.conversionEventMappings,
          )
            ? trackingProfileRecord.conversionEventMappings
                .filter(isRecord)
                .map((item, index) => ({
                  id: asString(item.id, `mapping-${index + 1}`),
                  internalEventName: asString(item.internalEventName),
                  providerEventName: asString(item.providerEventName),
                  isBrowserSide: asBoolean(item.isBrowserSide),
                  isServerSide: asBoolean(item.isServerSide),
                  isCriticalConversion: asBoolean(item.isCriticalConversion),
                }))
            : [],
        }
      : null,
    handoffStrategy: handoffStrategyRecord
      ? {
          id: asString(handoffStrategyRecord.id, 'runtime-handoff-strategy'),
          name: asString(handoffStrategyRecord.name, 'Handoff'),
          type: asString(handoffStrategyRecord.type, 'unknown'),
          settingsJson: asJsonValue(handoffStrategyRecord.settingsJson, {}),
        }
      : null,
    handoff: {
      mode:
        handoffRecord.mode === 'thank_you_then_whatsapp' ||
        handoffRecord.mode === 'immediate_whatsapp'
          ? handoffRecord.mode
          : null,
      channel: handoffRecord.channel === 'whatsapp' ? 'whatsapp' : null,
      buttonLabel:
        typeof handoffRecord.buttonLabel === 'string' ? handoffRecord.buttonLabel : null,
      autoRedirect: asBoolean(handoffRecord.autoRedirect),
      autoRedirectDelayMs:
        typeof handoffRecord.autoRedirectDelayMs === 'number'
          ? handoffRecord.autoRedirectDelayMs
          : null,
      messageTemplate:
        typeof handoffRecord.messageTemplate === 'string'
          ? handoffRecord.messageTemplate
          : null,
    },
    currentStep: activeCurrentStep,
    nextStep: normalizeAdjacentStep(record.nextStep, activeCurrentStep.path, activeCurrentStep.stepType),
    previousStep: normalizeAdjacentStep(
      record.previousStep,
      activeCurrentStep.path,
      activeCurrentStep.stepType,
    ),
    steps: normalizedSteps,
  };
}
