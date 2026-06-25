import { FunnelMarketplaceClient } from "@/components/funnel-marketplace/funnel-marketplace-client";
import { getSystemFunnelArsenalTemplates } from "@/lib/system-funnel-arsenal";
import { logCriticalSsrError } from "@/lib/ssr-debug";

export default async function AdminFunnelMarketplacePage() {
  let templates: Awaited<ReturnType<typeof getSystemFunnelArsenalTemplates>>;

  try {
    templates = await getSystemFunnelArsenalTemplates();
  } catch (error) {
    logCriticalSsrError(error, {
      page: "/admin/funnel-marketplace",
      operation: "AdminFunnelMarketplacePage",
    });
    throw error;
  }

  return (
    <FunnelMarketplaceClient
      assets={templates}
      mode="admin"
      title="Funnel Marketplace"
      description="Explora, filtra, previsualiza y publica Master Funnels listos para activarse con Deep Clone."
    />
  );
}
