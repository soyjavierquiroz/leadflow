import { MemberDashboardClient } from "@/components/member-operations/member-dashboard-client";
import { getMemberDashboardSnapshot } from "@/lib/member-dashboard";

export default async function MemberPage() {
  const dashboard = await getMemberDashboardSnapshot();

  return <MemberDashboardClient initialDashboard={dashboard} />;
}
