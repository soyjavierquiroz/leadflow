import type { Prisma } from '@prisma/client';

type RuntimeJsonValue = Prisma.JsonValue;

export type PublicRuntimeStep = {
  id: string;
  slug: string;
  path: string;
  stepType: string;
  position: number;
  isEntryStep: boolean;
  isConversionStep: boolean;
  blocksJson: RuntimeJsonValue;
  mediaMap: RuntimeJsonValue;
  settingsJson: RuntimeJsonValue;
};

export type PublicRuntimeEntryContext = {
  entryMode: 'organic_asesor' | 'paid_ads';
  trafficLayer: 'DIRECT' | 'PAID_WHEEL' | 'ORGANIC';
  forcedSponsorId: string | null;
  adWheelId: string | null;
  browserPixelsEnabled: boolean;
};

export type PublicRuntimePayload = {
  request: {
    host: string;
    path: string;
    publicationPathPrefix: string;
    relativeStepPath: string;
  };
  domain: {
    id: string;
    host: string;
    normalizedHost: string;
    domainType: string;
    isPrimary: boolean;
    canonicalHost: string | null;
    redirectToPrimary: boolean;
  };
  entryContext: PublicRuntimeEntryContext;
  publication: {
    id: string;
    pathPrefix: string;
    isPrimary: boolean;
    trackingProfileId: string | null;
    handoffStrategyId: string | null;
    metaPixelId: string | null;
    tiktokPixelId: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    ogImageUrl: string | null;
    faviconUrl: string | null;
    nextStepPath: string | null;
    manifestVersion: number;
    runtimeHealthStatus: 'healthy' | 'warning' | 'broken';
  };
  theme: string | null;
  funnel: {
    id: string;
    name: string;
    code: string;
    status: string;
    structuralType: string | null;
    conversionContract: RuntimeJsonValue;
    settingsJson: RuntimeJsonValue;
    mediaMap: RuntimeJsonValue;
    template: {
      id: string;
      code: string;
      name: string;
      version: number;
      funnelType: string;
      blocksJson: RuntimeJsonValue;
      mediaMap: RuntimeJsonValue;
      settingsJson: RuntimeJsonValue;
      allowedOverridesJson: RuntimeJsonValue;
    };
  };
  trackingProfile: {
    id: string;
    name: string;
    provider: string;
    deduplicationMode: string;
    configJson: RuntimeJsonValue;
    conversionEventMappings: {
      id: string;
      internalEventName: string;
      providerEventName: string;
      isBrowserSide: boolean;
      isServerSide: boolean;
      isCriticalConversion: boolean;
    }[];
  } | null;
  handoffStrategy: {
    id: string;
    name: string;
    type: string;
    settingsJson: RuntimeJsonValue;
  } | null;
  handoff: {
    mode: 'thank_you_then_whatsapp' | 'immediate_whatsapp' | null;
    channel: 'whatsapp' | null;
    buttonLabel: string | null;
    autoRedirect: boolean;
    autoRedirectDelayMs: number | null;
    messageTemplate: string | null;
  };
  currentStep: PublicRuntimeStep;
  nextStep: Pick<PublicRuntimeStep, 'id' | 'slug' | 'path' | 'stepType'> | null;
  previousStep: Pick<
    PublicRuntimeStep,
    'id' | 'slug' | 'path' | 'stepType'
  > | null;
  steps: PublicRuntimeStep[];
};
