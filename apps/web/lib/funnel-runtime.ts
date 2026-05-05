import 'server-only';
import { webPublicConfig } from '@/lib/public-env';
import type { PublicFunnelRuntimePayload } from '@/lib/public-funnel-runtime.types';
import { normalizePublicFunnelRuntimePayload } from '@/lib/public-funnel-runtime-safety';

export {
  resolveFlowGraphContractPath,
  resolveRuntimeNextStepPath,
} from '@/lib/funnel-runtime-routing';

const normalizeHost = (value: string) => value.trim().toLowerCase().replace(/:\d+$/, '');

export const normalizeRuntimePath = (value?: string | null) => {
  if (!value) {
    return '/';
  }

  const trimmed = value.trim();
  const withoutQuery = trimmed.split('?')[0] ?? '/';
  const withoutHash = withoutQuery.split('#')[0] ?? '/';
  const normalized = withoutHash.replace(/\/+/g, '/').replace(/\/$/, '');

  if (!normalized || normalized === '.') {
    return '/';
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

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

  return normalizeRuntimePath(
    segments.map((segment) => segment.trim()).filter(Boolean).join('/'),
  );
};

export const resolvePathBasedAttribution = (path: string) => {
  const segments = normalizeRuntimePath(path).split('/').filter(Boolean);
  const slug = segments[1]?.trim() || null;

  if (segments[0] === 'promo' && slug) {
    return { type: 'promo' as const, slug };
  }

  if (segments[0] === 'ref' && slug) {
    return { type: 'ref' as const, slug };
  }

  return { type: 'organic' as const, slug: null };
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

  const data = await response.json();
  console.log(
    'Fired Data:',
    JSON.stringify(
      Array.isArray(data?.currentStep?.blocksJson)
        ? data.currentStep.blocksJson[1]
        : data?.blocks?.[1] ?? null,
    ),
  );

  return normalizePublicFunnelRuntimePayload(data, {
    host: params.host,
    path: params.path,
  }) as PublicFunnelRuntimePayload;
}

export type PublicFunnelRuntimeResolution =
  | {
      status: 'ready';
      runtime: PublicFunnelRuntimePayload;
    }
  | {
      status: 'under_construction';
      runtime: PublicFunnelRuntimePayload;
    }
  | {
      status: 'not_found';
    };

export async function fetchPublicFunnelRuntimeResolution(params: {
  host: string;
  path: string;
}): Promise<PublicFunnelRuntimeResolution> {
  const runtime = await fetchPublicFunnelRuntime(params);

  if (!runtime) {
    return { status: 'not_found' };
  }

  if (runtime.publication.runtimeHealthStatus === 'broken') {
    return {
      status: 'under_construction',
      runtime,
    };
  }

  return {
    status: 'ready',
    runtime,
  };
}
