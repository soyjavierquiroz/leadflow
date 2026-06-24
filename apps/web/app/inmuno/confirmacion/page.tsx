import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { FunnelRuntimePage } from "@/components/public-funnel/funnel-runtime-page";
import { PublicRuntimeLeadSubmitProvider } from "@/components/public-runtime/public-runtime-lead-submit-provider";
import {
  fetchPublicFunnelRuntime,
  resolveRuntimeHost,
} from "@/lib/funnel-runtime";
import { buildPublicFunnelMetadata } from "@/lib/public-funnel-metadata";

export const dynamic = "force-dynamic";

type InmunoConfirmationPageProps = {
  searchParams: Promise<{
    previewHost?: string;
  }>;
};

const loadInmunoConfirmationRuntime = async (
  previewHost: string | undefined,
) => {
  const requestHeaders = await headers();
  const requestHost =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const host = resolveRuntimeHost(requestHost, previewHost);

  return fetchPublicFunnelRuntime({
    host,
    path: "/inmuno/confirmacion",
  });
};

export async function generateMetadata({
  searchParams,
}: InmunoConfirmationPageProps): Promise<Metadata> {
  const query = await searchParams;
  const runtime = await loadInmunoConfirmationRuntime(query.previewHost).catch(
    () => null,
  );

  if (!runtime) {
    return {};
  }

  return buildPublicFunnelMetadata(runtime);
}

export default async function InmunoConfirmationPage({
  searchParams,
}: InmunoConfirmationPageProps) {
  const query = await searchParams;
  const previewHost = query.previewHost;
  const runtime = await loadInmunoConfirmationRuntime(previewHost);

  if (!runtime) {
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
