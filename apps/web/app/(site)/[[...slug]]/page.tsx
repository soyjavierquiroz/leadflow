import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { FunnelUnderConstruction } from '@/components/public-funnel/funnel-under-construction';
import { FunnelRuntimePage } from '@/components/public-funnel/funnel-runtime-page';
import { getSessionUser } from '@/lib/auth';
import {
  fetchPublicFunnelRuntime,
  fetchPublicFunnelRuntimeResolution,
  normalizeRuntimePath,
  resolveRuntimeHost,
  resolveRuntimePath,
} from '@/lib/funnel-runtime';
import { webPublicConfig } from '@/lib/public-env';
import type { PublicFunnelRuntimePayload } from '@/lib/public-funnel-runtime.types';

export const dynamic = 'force-dynamic';

type SiteRuntimePageProps = {
  params: Promise<{
    slug?: string[];
  }>;
  searchParams: Promise<{
    previewHost?: string;
    awid?: string;
    ref?: string;
  }>;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

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

const appendRuntimeQuery = (
  path: string,
  query: {
    awid?: string;
    ref?: string;
  },
) => {
  const params = new URLSearchParams();

  if (query.awid?.trim()) {
    params.set('awid', query.awid.trim());
  }

  if (query.ref?.trim()) {
    params.set('ref', query.ref.trim());
  }

  const serialized = params.toString();
  return serialized
    ? `${path}${path.includes('?') ? '&' : '?'}${serialized}`
    : path;
};

const resolveSeoFromRuntime = (runtime: PublicFunnelRuntimePayload) => {
  const publication = runtime.publication;
  const stepSettings = asRecord(runtime.currentStep.settingsJson);
  const funnelSettings = asRecord(runtime.funnel.settingsJson);
  const stepSeo = asRecord(stepSettings?.seo);
  const funnelSeo = asRecord(funnelSettings?.seo);
  const title =
    (typeof publication.seoTitle === 'string' && publication.seoTitle.trim()) ||
    (typeof stepSeo?.title === 'string' && stepSeo.title.trim()) ||
    (typeof stepSettings?.title === 'string' && stepSettings.title.trim()) ||
    (typeof funnelSeo?.title === 'string' && funnelSeo.title.trim()) ||
    (typeof funnelSettings?.title === 'string' && funnelSettings.title.trim()) ||
    runtime.funnel.name;
  const description =
    (typeof publication.seoDescription === 'string' &&
      publication.seoDescription.trim()) ||
    (typeof stepSeo?.metaDescription === 'string' &&
      stepSeo.metaDescription.trim()) ||
    (typeof stepSettings?.metaDescription === 'string' &&
      stepSettings.metaDescription.trim()) ||
    (typeof stepSettings?.summary === 'string' && stepSettings.summary.trim()) ||
    (typeof stepSettings?.description === 'string' &&
      stepSettings.description.trim()) ||
    (typeof funnelSeo?.metaDescription === 'string' &&
      funnelSeo.metaDescription.trim()) ||
    (typeof funnelSettings?.metaDescription === 'string' &&
      funnelSettings.metaDescription.trim()) ||
    (typeof funnelSettings?.summary === 'string' &&
      funnelSettings.summary.trim()) ||
    (typeof funnelSettings?.description === 'string' &&
      funnelSettings.description.trim()) ||
    undefined;
  const ogImage =
    typeof publication.ogImageUrl === 'string' && publication.ogImageUrl.trim()
      ? publication.ogImageUrl.trim()
      : undefined;
  const favicon =
    typeof publication.faviconUrl === 'string' && publication.faviconUrl.trim()
      ? publication.faviconUrl.trim()
      : undefined;

  return { title, description, ogImage, favicon };
};

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
  const runtime = await loadRuntimeSafely(host, appendRuntimeQuery(path, query));

  if (!runtime) {
    return {};
  }

  const seo = resolveSeoFromRuntime(runtime);
  const canonicalPath =
    runtime.request.path === '/' ? '' : runtime.request.path;
  const canonicalUrl = `https://${runtime.domain.host}${canonicalPath}`;

  return {
    title: seo.title,
    description: seo.description,
    icons: seo.favicon
      ? {
          icon: seo.favicon,
          shortcut: seo.favicon,
        }
      : undefined,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: canonicalUrl,
      siteName: runtime.domain.host,
      type: 'website',
      images: seo.ogImage ? [seo.ogImage] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
      images: seo.ogImage ? [seo.ogImage] : undefined,
    },
  };
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
  const runtimePath = appendRuntimeQuery(path, query);

  if (!previewHost && isCanonicalAppHomeRequest(host, path)) {
    const user = await getSessionUser();
    redirect(user?.homePath ?? '/login');
  }

  const runtimeResolution = await fetchPublicFunnelRuntimeResolution({
    host,
    path: runtimePath,
  }).catch((error) => {
    console.error('[site-runtime] Failed to load public funnel runtime', {
      host,
      path: runtimePath,
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
    <>
      <FunnelRuntimePage runtime={runtime} previewHost={previewHost} />
    </>
  );
}
