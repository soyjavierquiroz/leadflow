import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { FunnelRuntimePage } from "@/components/public-funnel/funnel-runtime-page";
import { PublicRuntimeLeadSubmitProvider } from "@/components/public-runtime/public-runtime-lead-submit-provider";
import {
  fetchPublicFunnelRuntime,
  resolveRuntimeHost,
} from "@/lib/funnel-runtime";

export const dynamic = "force-dynamic";

type InmunoConfirmationPageProps = {
  searchParams: Promise<{
    previewHost?: string;
  }>;
};

export default async function InmunoConfirmationPage({
  searchParams,
}: InmunoConfirmationPageProps) {
  const [query, requestHeaders] = await Promise.all([searchParams, headers()]);
  const previewHost = query.previewHost;
  const requestHost =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const host = resolveRuntimeHost(requestHost, previewHost);
  const runtime = await fetchPublicFunnelRuntime({
    host,
    path: "/inmuno/confirmacion",
  });

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
