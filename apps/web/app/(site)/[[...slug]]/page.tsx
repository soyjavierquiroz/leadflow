import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { FunnelRuntimePage } from '@/components/public-funnel/funnel-runtime-page';
import {
  fetchPublicFunnelRuntime,
  resolveRuntimeHost,
  resolveRuntimePath,
} from '@/lib/funnel-runtime';
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

const resolveSeoFromRuntime = (runtime: PublicFunnelRuntimePayload) => {
  const stepSettings = asRecord(runtime.currentStep.settingsJson);
  const funnelSettings = asRecord(runtime.funnel.settingsJson);
  const stepSeo = asRecord(stepSettings?.seo);
  const funnelSeo = asRecord(funnelSettings?.seo);
  const title =
    (typeof stepSeo?.title === 'string' && stepSeo.title.trim()) ||
    (typeof stepSettings?.title === 'string' && stepSettings.title.trim()) ||
    (typeof funnelSeo?.title === 'string' && funnelSeo.title.trim()) ||
    (typeof funnelSettings?.title === 'string' && funnelSettings.title.trim()) ||
    runtime.funnel.name;
  const description =
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

  return { title, description };
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
  const runtime = await fetchPublicFunnelRuntime({ host, path });

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
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      url: canonicalUrl,
      siteName: runtime.domain.host,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
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
  const runtime = await fetchPublicFunnelRuntime({ host, path });

  if (!runtime) {
    notFound();
  }

  return <FunnelRuntimePage runtime={runtime} previewHost={previewHost} />;
}
