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
import { webPublicConfig } from '@/lib/public-env';
import type { PublicFunnelRuntimePayload } from '@/lib/public-funnel-runtime.types';

export const dynamic = 'force-dynamic';

type SiteRuntimePageProps = {
  params: Promise<{
    slug?: string[];
  }>;
  searchParams: Promise<{
    previewHost?: string;
  }>;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const BOLT_NEW_SEO_TITLE = 'kurukin ai automation landing page';

const isBoltNewSeoValue = (value: string) => {
  const normalized = value.trim().toLowerCase();

  return (
    normalized === BOLT_NEW_SEO_TITLE ||
    normalized.includes('bolt.new') ||
    normalized.includes('bolt.new/')
  );
};

const cleanSeoText = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed || isBoltNewSeoValue(trimmed)) {
    return undefined;
  }

  return trimmed;
};

const cleanSeoImageUrl = (value: unknown, host: string) => {
  const trimmed = cleanSeoText(value);

  if (!trimmed) {
    return undefined;
  }

  try {
    const imageUrl = new URL(trimmed, `https://${host}`);

    if (!['http:', 'https:'].includes(imageUrl.protocol)) {
      return undefined;
    }

    if (imageUrl.hostname.toLowerCase().includes('bolt.new')) {
      return undefined;
    }

    return imageUrl.toString();
  } catch {
    return undefined;
  }
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

const resolveSeoFromRuntime = (runtime: PublicFunnelRuntimePayload) => {
  const publication = runtime.publication;
  const stepSettings = asRecord(runtime.currentStep.settingsJson);
  const funnelSettings = asRecord(runtime.funnel.settingsJson);
  const stepSeo = asRecord(stepSettings?.seo);
  const funnelSeo = asRecord(funnelSettings?.seo);
  const title =
    cleanSeoText(publication.seoTitle) ||
    cleanSeoText(stepSeo?.title) ||
    cleanSeoText(stepSettings?.title) ||
    cleanSeoText(funnelSeo?.title) ||
    cleanSeoText(funnelSettings?.title) ||
    cleanSeoText(runtime.funnel.name) ||
    runtime.domain.host;
  const description =
    cleanSeoText(publication.seoDescription) ||
    cleanSeoText(stepSeo?.metaDescription) ||
    cleanSeoText(stepSeo?.description) ||
    cleanSeoText(stepSettings?.metaDescription) ||
    cleanSeoText(stepSettings?.summary) ||
    cleanSeoText(stepSettings?.description) ||
    cleanSeoText(funnelSeo?.metaDescription) ||
    cleanSeoText(funnelSeo?.description) ||
    cleanSeoText(funnelSettings?.metaDescription) ||
    cleanSeoText(funnelSettings?.summary) ||
    cleanSeoText(funnelSettings?.description);
  const ogImage =
    cleanSeoImageUrl(publication.ogImageUrl, runtime.domain.host) ||
    cleanSeoImageUrl(stepSeo?.ogImageUrl, runtime.domain.host) ||
    cleanSeoImageUrl(stepSeo?.ogImage, runtime.domain.host) ||
    cleanSeoImageUrl(stepSeo?.image, runtime.domain.host) ||
    cleanSeoImageUrl(funnelSeo?.ogImageUrl, runtime.domain.host) ||
    cleanSeoImageUrl(funnelSeo?.ogImage, runtime.domain.host) ||
    cleanSeoImageUrl(funnelSeo?.image, runtime.domain.host);
  const favicon =
    cleanSeoImageUrl(publication.faviconUrl, runtime.domain.host) ||
    cleanSeoImageUrl(funnelSeo?.faviconUrl, runtime.domain.host) ||
    cleanSeoImageUrl(funnelSeo?.favicon, runtime.domain.host);

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
  const runtime = await loadRuntimeSafely(host, path);

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
