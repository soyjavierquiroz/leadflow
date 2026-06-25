import { FunnelPreviewRuntime } from "@/components/funnel-marketplace/funnel-preview-runtime";
import { FunnelPreviewUnavailable } from "@/components/funnel-marketplace/funnel-preview-unavailable";
import {
  FunnelMarketplaceRequestError,
  getFunnelMarketplacePreview,
} from "@/lib/funnel-arsenal";

type PageProps = {
  params: Promise<{
    assetSlug: string;
  }>;
  searchParams: Promise<{
    step?: string;
  }>;
};

export default async function MemberFunnelMarketplacePreviewPage({
  params,
  searchParams,
}: PageProps) {
  const { assetSlug } = await params;
  const { step } = await searchParams;
  let runtime: Awaited<ReturnType<typeof getFunnelMarketplacePreview>>;

  try {
    runtime = await getFunnelMarketplacePreview(assetSlug, step);
  } catch (error) {
    if (
      error instanceof FunnelMarketplaceRequestError &&
      error.code === "MARKETPLACE_MASTER_REQUIRED"
    ) {
      return (
        <FunnelPreviewUnavailable
          mode="member"
          backHref={`/member/funnels/${assetSlug}`}
        />
      );
    }

    throw error;
  }

  return (
    <FunnelPreviewRuntime
      runtime={runtime}
      backHref={`/member/funnels/${assetSlug}`}
    />
  );
}
