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
  trafficLayer: 'DIRECT' | 'PAID_WHEEL' | 'PAID_ADS' | 'ORGANIC';
  forcedSponsorId: string | null;
  adWheelId: string | null;
  browserPixelsEnabled: boolean;
  attributionType: 'promo' | 'ref' | 'organic';
  attributionSlug: string | null;
  runtimePathPrefix: string | null;
  referralQueryParam: string | null;
};

export type AttributionDecisionTrafficLayer =
  | 'DIRECT'
  | 'PAID_WHEEL'
  | 'PAID_ADS'
  | 'ORGANIC';

export type AttributionDecision = {
  entryMode: PublicRuntimeEntryContext['entryMode'];
  trafficLayer: AttributionDecisionTrafficLayer;
  forcedSponsorId: string | null;
  adWheelId: string | null;
  attributionType: PublicRuntimeEntryContext['attributionType'];
  attributionSlug: string | null;
  runtimePathPrefix: string | null;
  referralQueryParam: string | null;
  sourceUrl: string | null;
  requestedPath: string;
  pathMatchesCampaign: boolean;
  fbclid: string | null;
  gclid: string | null;
  ttclid: string | null;
  hasPaidClickId: boolean;
  clientIpAddress: string | null;
  clientUserAgent: string | null;
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
  team: {
    id: string;
    name: string;
    description: string | null;
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
    sponsor: {
      id: string;
      displayName: string;
      email: string | null;
      phone: string | null;
      avatarUrl: string | null;
    } | null;
    whatsappPhone: string | null;
    whatsappMessage: string | null;
    whatsappUrl: string | null;
  };
  leadId: string | null;
  assignment: {
    id: string;
    status: string;
    reason: string;
    assignedAt: string;
    sponsor: {
      id: string;
      displayName: string;
      email: string | null;
      phone: string | null;
      avatarUrl: string | null;
    };
  } | null;
  advisor: {
    name: string;
    role: string | null;
    phone: string | null;
    photoUrl: string | null;
    bio: string | null;
    whatsappUrl: string | null;
  } | null;
  assignedSponsor: {
    id: string;
    displayName: string;
    email: string | null;
    phone: string | null;
    avatarUrl: string | null;
  } | null;
  currentStep: PublicRuntimeStep;
  nextStep: Pick<PublicRuntimeStep, 'id' | 'slug' | 'path' | 'stepType'> | null;
  previousStep: Pick<
    PublicRuntimeStep,
    'id' | 'slug' | 'path' | 'stepType'
  > | null;
  steps: PublicRuntimeStep[];
};
