import { MemberProfileClient } from "@/components/member-operations/member-profile-client";
import { getMemberDashboardSnapshot } from "@/lib/member-dashboard";
import { getMemberProfileSnapshot } from "@/lib/member-profile";

export default async function MemberProfilePage() {
  const [sponsor, dashboard] = await Promise.all([
    getMemberProfileSnapshot(),
    getMemberDashboardSnapshot(),
  ]);

  return (
    <MemberProfileClient
      sponsor={sponsor}
      kpis={dashboard.kpis}
    />
  );
}
