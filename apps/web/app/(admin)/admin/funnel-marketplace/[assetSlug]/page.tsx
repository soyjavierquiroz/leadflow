import { FunnelMarketplaceDetail } from "@/components/funnel-marketplace/funnel-marketplace-detail";
import { getSystemFunnelMarketplaceAsset } from "@/lib/system-funnel-arsenal";
import { logCriticalSsrError } from "@/lib/ssr-debug";

type PageProps = {
  params: Promise<{
    assetSlug: string;
  }>;
};

export default async function AdminFunnelMarketplaceDetailPage({
  params,
}: PageProps) {
  const { assetSlug } = await params;
  let asset: Awaited<ReturnType<typeof getSystemFunnelMarketplaceAsset>>;

  try {
    asset = await getSystemFunnelMarketplaceAsset(assetSlug);
  } catch (error) {
    logCriticalSsrError(error, {
      page: "/admin/funnel-marketplace/:assetSlug",
      operation: "AdminFunnelMarketplaceDetailPage",
    });
    throw error;
  }

  return <FunnelMarketplaceDetail asset={asset} mode="admin" />;
}
