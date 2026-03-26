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
  [key: string]: JsonValue | undefined;
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
  publication: {
    id: string;
    pathPrefix: string;
    isPrimary: boolean;
    trackingProfileId: string | null;
    handoffStrategyId: string | null;
  };
  funnel: {
    id: string;
    name: string;
    code: string;
    status: string;
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
  };
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
