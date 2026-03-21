import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { FunnelRuntimePage } from '@/components/public-funnel/funnel-runtime-page';
import {
  fetchPublicFunnelRuntime,
  resolveRuntimeHost,
  resolveRuntimePath,
} from '@/lib/funnel-runtime';

export const dynamic = 'force-dynamic';

type SiteRuntimePageProps = {
  params: Promise<{
    slug?: string[];
  }>;
  searchParams: Promise<{
    previewHost?: string;
  }>;
};

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
