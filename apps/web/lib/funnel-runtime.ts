import 'server-only';
import { webPublicConfig } from '@/lib/public-env';

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
    kind: string;
    isPrimary: boolean;
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

const normalizeHost = (value: string) => value.trim().toLowerCase().replace(/:\d+$/, '');

export const resolveRuntimeHost = (
  requestHost: string | null,
  previewHost: string | undefined,
) => {
  const devPreviewHost =
    webPublicConfig.environment !== 'production' ? previewHost?.trim() : undefined;

  return normalizeHost(devPreviewHost || requestHost || 'localhost');
};

export const resolveRuntimePath = (segments: string[] | undefined) => {
  if (!segments || segments.length === 0) {
    return '/';
  }

  return `/${segments.map((segment) => segment.trim()).filter(Boolean).join('/')}`;
};

export async function fetchPublicFunnelRuntime(params: {
  host: string;
  path: string;
}): Promise<PublicFunnelRuntimePayload | null> {
  const endpoint = new URL('/v1/public/funnel-runtime/resolve', webPublicConfig.urls.api);
  endpoint.searchParams.set('host', params.host);
  endpoint.searchParams.set('path', params.path);

  const response = await fetch(endpoint, {
    cache: 'no-store',
    next: { revalidate: 0 },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Public runtime request failed with ${response.status}.`);
  }

  return (await response.json()) as PublicFunnelRuntimePayload;
}
