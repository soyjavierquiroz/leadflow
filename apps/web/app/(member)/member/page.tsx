import { MemberDashboardClient } from "@/components/member-operations/member-dashboard-client";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

export default async function MemberPage() {
  const data = await getAppShellSnapshot();
  const memberLeads = data.leadViews.filter(
    (item) => item.sponsorId === data.currentSponsor.id,
  );
  const memberAssignments = data.assignments.filter(
    (item) => item.sponsorId === data.currentSponsor.id,
  );

  return (
    <MemberDashboardClient
      sponsor={data.currentSponsor}
      leads={memberLeads}
      assignments={memberAssignments}
    />
  );
}
