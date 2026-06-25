import { FunnelMarketplaceClient } from "@/components/funnel-marketplace/funnel-marketplace-client";
import { getFunnelArsenalSnapshot } from "@/lib/funnel-arsenal";

const loadMemberFunnelsPage = async () => {
  try {
    return await getFunnelArsenalSnapshot();
  } catch (error) {
    console.error("[member route ssr failed]", {
      route: "/member/funnels",
      error,
    });
    throw error;
  }
};

export default async function MemberFunnelsPage() {
  const snapshot = await loadMemberFunnelsPage();
  const previewableFunnels = snapshot.templates.filter(
    (template) => template.hasMasterFunnel,
  );

  return (
    <FunnelMarketplaceClient
      assets={previewableFunnels}
      mode="member"
      title="Marketplace de Funnels"
      description="Elige un Funnel compatible con tu negocio, revisa el preview y actívalo para crear tu Team Funnel."
      blueprintKey={snapshot.blueprintKey}
      requiresCommercialProfile={snapshot.requiresCommercialProfile}
    />
  );
}
