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
  searchParams: Promise<{
    awid?: string;
  }>;
};

export default async function PublicRuntimePage({
  params,
  searchParams,
}: PublicRuntimePageProps) {
  const [{ hostname, slug }, query] = await Promise.all([params, searchParams]);
  const path = resolvePublicRuntimePath(slug);
  const runtimePath = query.awid?.trim()
    ? `${path}${path.includes('?') ? '&' : '?'}awid=${encodeURIComponent(
        query.awid.trim(),
      )}`
    : path;

  let runtime = null;

  try {
    runtime = await fetchPublicFunnelRuntime({
      host: hostname,
      path: runtimePath,
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
        path={runtimePath}
      >
        <FunnelRuntimePage runtime={runtime} />
      </PublicRuntimeLeadSubmitProvider>
    </>
  );
}
