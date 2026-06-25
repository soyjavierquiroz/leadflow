import { FunnelMarketplaceDetail } from "@/components/funnel-marketplace/funnel-marketplace-detail";
import { getFunnelMarketplaceAsset } from "@/lib/funnel-arsenal";

type PageProps = {
  params: Promise<{
    assetSlug: string;
  }>;
};

export default async function MemberFunnelMarketplaceDetailPage({
  params,
}: PageProps) {
  const { assetSlug } = await params;
  const asset = await getFunnelMarketplaceAsset(assetSlug);

  return <FunnelMarketplaceDetail asset={asset} mode="member" />;
}

