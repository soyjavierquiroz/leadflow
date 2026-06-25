import { FunnelArsenalClient } from "@/components/member-operations/funnel-arsenal-client";
import { getFunnelArsenalSnapshot } from "@/lib/funnel-arsenal";

export default async function MemberFunnelsPage() {
  const snapshot = await getFunnelArsenalSnapshot();

  return <FunnelArsenalClient initialSnapshot={snapshot} />;
}
