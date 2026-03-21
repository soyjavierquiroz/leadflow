import { MemberLeadsClient } from "@/components/member-operations/member-leads-client";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

export default async function MemberLeadsPage() {
  const data = await getAppShellSnapshot();
  const rows = data.leadViews.filter((item) => item.sponsorId === data.currentSponsor.id);

  return <MemberLeadsClient initialRows={rows} />;
}
