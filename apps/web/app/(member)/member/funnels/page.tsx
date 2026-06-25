import { FunnelArsenalClient } from "@/components/member-operations/funnel-arsenal-client";
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

  return <FunnelArsenalClient initialSnapshot={snapshot} />;
}
