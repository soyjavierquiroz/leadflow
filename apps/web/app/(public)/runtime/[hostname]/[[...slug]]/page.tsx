import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FunnelRuntimePage } from '@/components/public-funnel/funnel-runtime-page';
import { PublicRuntimeLeadSubmitProvider } from '@/components/public-runtime/public-runtime-lead-submit-provider';
import { fetchPublicFunnelRuntime } from '@/lib/funnel-runtime';
import { buildPublicFunnelMetadata } from '@/lib/public-funnel-metadata';
import {
  normalizePublicRuntimePath,
  resolvePublicRuntimePath,
} from '@/lib/public-runtime';

export const dynamic = 'force-dynamic';

type PublicRuntimePageProps = {
  params: Promise<{
    hostname: string;
    slug?: string[];
  }>;
};

const loadRuntimeSafely = async (host: string, path: string) => {
  try {
    return await fetchPublicFunnelRuntime({ host, path });
  } catch (error) {
    console.error('[public-runtime] Runtime resolution failed', {
      hostname: host,
      path,
      error,
    });
    return null;
  }
};

export async function generateMetadata({
  params,
}: PublicRuntimePageProps): Promise<Metadata> {
  const { hostname, slug } = await params;
  const path = resolvePublicRuntimePath(slug);
  const runtime = await loadRuntimeSafely(hostname, path);

  if (!runtime) {
    return {};
  }

  return buildPublicFunnelMetadata(runtime);
}

export default async function PublicRuntimePage({
  params,
}: PublicRuntimePageProps) {
  const { hostname, slug } = await params;
  const path = resolvePublicRuntimePath(slug);
  const runtime = await loadRuntimeSafely(hostname, path);

  if (!runtime) {
    notFound();
  }

  if (
    normalizePublicRuntimePath(path) !==
    normalizePublicRuntimePath(runtime.currentStep.path)
  ) {
    notFound();
  }

  return (
    <>
      <PublicRuntimeLeadSubmitProvider
        hostname={runtime.domain.host}
        path={runtime.request.path}
        runtime={runtime}
      >
        <FunnelRuntimePage runtime={runtime} />
      </PublicRuntimeLeadSubmitProvider>
    </>
  );
}
