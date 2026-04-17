import { notFound } from 'next/navigation';
import { FunnelRuntimePage } from '@/components/public-funnel/funnel-runtime-page';
import { PublicRuntimeLeadSubmitProvider } from '@/components/public-runtime/public-runtime-lead-submit-provider';
import { fetchPublicFunnelRuntime } from '@/lib/funnel-runtime';
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

export default async function PublicRuntimePage({
  params,
}: PublicRuntimePageProps) {
  const { hostname, slug } = await params;
  const path = resolvePublicRuntimePath(slug);

  let runtime = null;

  try {
    runtime = await fetchPublicFunnelRuntime({
      host: hostname,
      path,
    });
  } catch (error) {
    console.error('[public-runtime] Runtime resolution failed', {
      hostname,
      path,
      error,
    });
  }

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
      >
        <FunnelRuntimePage runtime={runtime} />
      </PublicRuntimeLeadSubmitProvider>
    </>
  );
}
