import 'server-only';
import { webPublicConfig } from '@/lib/public-env';
import type { PublicFunnelRuntimePayload } from '@/lib/public-funnel-runtime.types';
import { normalizePublicFunnelRuntimePayload } from '@/lib/public-funnel-runtime-safety';

const normalizeHost = (value: string) => value.trim().toLowerCase().replace(/:\d+$/, '');

export const normalizeRuntimePath = (value?: string | null) => {
  if (!value) {
    return '/';
  }

  const trimmed = value.trim();
  const normalized = trimmed.replace(/\/+/g, '/').replace(/\/$/, '');

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

  return normalizePublicFunnelRuntimePayload(await response.json(), {
    host: params.host,
    path: params.path,
  }) as PublicFunnelRuntimePayload;
}
