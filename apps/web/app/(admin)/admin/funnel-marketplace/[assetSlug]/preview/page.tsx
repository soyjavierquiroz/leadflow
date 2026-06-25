import { FunnelPreviewRuntime } from "@/components/funnel-marketplace/funnel-preview-runtime";
import { FunnelPreviewUnavailable } from "@/components/funnel-marketplace/funnel-preview-unavailable";
import {
  getSystemFunnelMarketplacePreview,
  SystemFunnelMarketplaceRequestError,
} from "@/lib/system-funnel-arsenal";
import { logCriticalSsrError } from "@/lib/ssr-debug";

type PageProps = {
  params: Promise<{
    assetSlug: string;
  }>;
  searchParams: Promise<{
    step?: string;
  }>;
};

export default async function AdminFunnelMarketplacePreviewPage({
  params,
  searchParams,
}: PageProps) {
  const { assetSlug } = await params;
  const { step } = await searchParams;
  let runtime: Awaited<ReturnType<typeof getSystemFunnelMarketplacePreview>>;

  try {
    runtime = await getSystemFunnelMarketplacePreview(assetSlug, step);
  } catch (error) {
    if (
      error instanceof SystemFunnelMarketplaceRequestError &&
      error.code === "MARKETPLACE_MASTER_REQUIRED"
    ) {
      return (
        <FunnelPreviewUnavailable
          mode="admin"
          backHref={`/admin/funnel-marketplace/${assetSlug}`}
        />
      );
    }

    logCriticalSsrError(error, {
      page: "/admin/funnel-marketplace/:assetSlug/preview",
      operation: "AdminFunnelMarketplacePreviewPage",
    });
    throw error;
  }

  return (
    <FunnelPreviewRuntime
      runtime={runtime}
      backHref={`/admin/funnel-marketplace/${assetSlug}`}
    />
  );
}
