import { notFound } from 'next/navigation';
import { FunnelRuntimePage } from '@/components/public-funnel/funnel-runtime-page';
import { PublicRuntimeLeadSubmitProvider } from '@/components/public-runtime/public-runtime-lead-submit-provider';
import {
  fetchPublicFunnelRuntime,
} from '@/lib/funnel-runtime';
import {
  fetchPublicRuntimeResolution,
  resolvePublicRuntimePath,
} from '@/lib/public-runtime';
import { RuntimeLeadSubmitForm } from '@/components/public-runtime/runtime-lead-submit-form';

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
    runtime = await fetchPublicRuntimeResolution({
      hostname,
      path,
    });
  } catch (error) {
    console.error('[public-runtime] Runtime resolution failed', {
      hostname,
      path,
      error,
    });
  }

  const normalizedHostname = runtime?.request?.hostname?.trim().toLowerCase() || hostname.trim().toLowerCase();
  const normalizedPath = path.trim().toLowerCase();
  const runtimeIdentity = [
    runtime?.funnel?.name,
    runtime?.funnelInstance?.name,
    runtime?.funnelInstance?.code,
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
  const shouldRenderImmunocalUi =
    runtimeIdentity.includes('immunocal') ||
    runtimeIdentity.includes('inmuno') ||
    ((normalizedHostname === 'retodetransformacion.com' ||
      normalizedHostname === 'www.retodetransformacion.com') &&
      normalizedPath === '/inmuno');

  if (!runtime || shouldRenderImmunocalUi) {
    try {
      const legacyRuntime = await fetchPublicFunnelRuntime({
        host: runtime?.request?.hostname || hostname,
        path,
      });

      if (legacyRuntime) {
        return (
          <PublicRuntimeLeadSubmitProvider
            hostname={runtime?.request?.hostname || hostname}
            path={path}
          >
            <FunnelRuntimePage runtime={legacyRuntime} />
          </PublicRuntimeLeadSubmitProvider>
        );
      }
    } catch (error) {
      console.error('[public-runtime] Legacy runtime fallback failed', {
        hostname,
        path,
        error,
      });
    }
  }

  if (!runtime) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] px-6 py-12">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-700">
            Public Runtime
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
            {runtime.funnel?.name || 'Public Runtime'}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
            {runtime.funnel?.description?.trim() || 'Sin descripcion configurada para este funnel aun.'}
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-500">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
              Host: {runtime.request?.hostname || hostname}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
              Path: {runtime.request?.path || path}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
              Publication: {runtime.publication?.id || 'n/a'}
            </span>
          </div>
        </header>

        <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
          <div className="border-b border-white/10 px-6 py-4 text-sm font-medium text-slate-200">
            Funnel config JSON
          </div>
          <pre className="overflow-x-auto p-6 text-sm leading-7 text-slate-100">
            <code>{JSON.stringify(runtime.funnel?.config ?? {}, null, 2)}</code>
          </pre>
        </section>

        <RuntimeLeadSubmitForm hostname={hostname} path={path} />
      </section>
    </main>
  );
}
