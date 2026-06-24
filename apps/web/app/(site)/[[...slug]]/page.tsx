import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { FunnelUnderConstruction } from '@/components/public-funnel/funnel-under-construction';
import { FunnelRuntimePage } from '@/components/public-funnel/funnel-runtime-page';
import { PublicRuntimeLeadSubmitProvider } from '@/components/public-runtime/public-runtime-lead-submit-provider';
import { getSessionUser } from '@/lib/auth';
import {
  fetchPublicFunnelRuntime,
  fetchPublicFunnelRuntimeResolution,
  normalizeRuntimePath,
  resolveRuntimeHost,
  resolveRuntimePath,
} from '@/lib/funnel-runtime';
import { buildPublicFunnelMetadata } from '@/lib/public-funnel-metadata';
import { webPublicConfig } from '@/lib/public-env';

export const dynamic = 'force-dynamic';

type SiteRuntimePageProps = {
  params: Promise<{
    slug?: string[];
  }>;
  searchParams: Promise<{
    previewHost?: string;
  }>;
};

const normalizeHost = (value: string | null | undefined) =>
  (value ?? '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.+$/, '');

const canonicalSiteHost = (() => {
  try {
    return normalizeHost(new URL(webPublicConfig.urls.site).host);
  } catch {
    return normalizeHost(webPublicConfig.urls.site);
  }
})();

const isCanonicalAppHomeRequest = (host: string, path: string) =>
  normalizeRuntimePath(path) === '/' && normalizeHost(host) === canonicalSiteHost;

const loadRuntimeSafely = async (host: string, path: string) => {
  try {
    return await fetchPublicFunnelRuntime({ host, path });
  } catch (error) {
    console.error('[site-runtime] Failed to load public funnel runtime', {
      host,
      path,
      error,
    });
    return null;
  }
};

export async function generateMetadata({
  params,
  searchParams,
}: SiteRuntimePageProps): Promise<Metadata> {
  const [{ slug }, query, requestHeaders] = await Promise.all([
    params,
    searchParams,
    headers(),
  ]);

  const previewHost = query.previewHost;
  const requestHost =
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const host = resolveRuntimeHost(requestHost, previewHost);
  const path = resolveRuntimePath(slug);
  const runtime = await loadRuntimeSafely(host, path);

  if (!runtime) {
    return {};
  }

  return buildPublicFunnelMetadata(runtime);
}

export default async function SiteRuntimePage({
  params,
  searchParams,
}: SiteRuntimePageProps) {
  const [{ slug }, query, requestHeaders] = await Promise.all([
    params,
    searchParams,
    headers(),
  ]);

  const previewHost = query.previewHost;
  const requestHost =
    requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host');
  const host = resolveRuntimeHost(requestHost, previewHost);
  const path = resolveRuntimePath(slug);

  if (!previewHost && isCanonicalAppHomeRequest(host, path)) {
    const user = await getSessionUser();
    redirect(user?.homePath ?? '/login');
  }

  const runtimeResolution = await fetchPublicFunnelRuntimeResolution({
    host,
    path,
  }).catch((error) => {
    console.error('[site-runtime] Failed to load public funnel runtime', {
      host,
      path,
      error,
    });
    return { status: 'not_found' as const };
  });

  if (runtimeResolution.status === 'not_found') {
    notFound();
  }

  if (runtimeResolution.status === 'under_construction') {
    return <FunnelUnderConstruction runtime={runtimeResolution.runtime} />;
  }

  const runtime = runtimeResolution.runtime;

  if (
    normalizeRuntimePath(path) !==
    normalizeRuntimePath(runtime.currentStep.path)
  ) {
    notFound();
  }

  return (
    <PublicRuntimeLeadSubmitProvider
      hostname={runtime.domain.host}
      path={runtime.request.path}
      runtime={runtime}
    >
      <FunnelRuntimePage runtime={runtime} previewHost={previewHost} />
    </PublicRuntimeLeadSubmitProvider>
  );
}
