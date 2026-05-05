import type { FunnelThemeId } from '@/lib/funnel-theme.types';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type RuntimeBlock = {
  type: string;
  key?: string;
  is_boxed?: boolean;
  [key: string]: JsonValue | undefined;
};

export type PublicRuntimeEntryContext = {
  entryMode: "organic_asesor" | "paid_ads";
  trafficLayer: "DIRECT" | "PAID_WHEEL" | "ORGANIC";
  forcedSponsorId: string | null;
  adWheelId: string | null;
  browserPixelsEnabled: boolean;
  attributionType: "promo" | "ref" | "organic";
  attributionSlug: string | null;
  runtimePathPrefix: string | null;
  referralQueryParam: string | null;
};

export type PublicFunnelRuntimePayload = {
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
    runtimeHealthStatus: "healthy" | "warning" | "broken";
  };
  theme: FunnelThemeId;
  funnel: {
    id: string;
    name: string;
    code: string;
    status: string;
    structuralType: string | null;
    conversionContract: JsonValue;
    settingsJson: JsonValue;
    mediaMap: JsonValue;
    template: {
      id: string;
      code: string;
      name: string;
      version: number;
      funnelType: string;
      blocksJson: JsonValue;
      mediaMap: JsonValue;
      settingsJson: JsonValue;
      allowedOverridesJson: JsonValue;
    };
  };
  trackingProfile: {
    id: string;
    name: string;
    provider: string;
    deduplicationMode: string;
    configJson: JsonValue;
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
    settingsJson: JsonValue;
  } | null;
  handoff: {
    mode: "thank_you_then_whatsapp" | "immediate_whatsapp" | null;
    channel: "whatsapp" | null;
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
    } | null;
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
  currentStep: {
    id: string;
    slug: string;
    path: string;
    stepType: string;
    position: number;
    isEntryStep: boolean;
    isConversionStep: boolean;
    blocksJson: JsonValue;
    mediaMap: JsonValue;
    settingsJson: JsonValue;
  };
  nextStep: {
    id: string;
    slug: string;
    path: string;
    stepType: string;
  } | null;
  previousStep: {
    id: string;
    slug: string;
    path: string;
    stepType: string;
  } | null;
  steps: {
    id: string;
    slug: string;
    path: string;
    stepType: string;
    position: number;
    isEntryStep: boolean;
    isConversionStep: boolean;
    blocksJson: JsonValue;
    mediaMap: JsonValue;
    settingsJson: JsonValue;
  }[];
};
