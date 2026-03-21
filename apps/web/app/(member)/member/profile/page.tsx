import { MemberProfileClient } from "@/components/member-operations/member-profile-client";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

export default async function MemberProfilePage() {
  const data = await getAppShellSnapshot();
  const memberLeads = data.leadViews.filter(
    (item) => item.sponsorId === data.currentSponsor.id,
  );
  const memberAssignments = data.assignments.filter(
    (item) => item.sponsorId === data.currentSponsor.id,
  );

  return (
    <MemberProfileClient
      sponsor={data.currentSponsor}
      memberProfile={data.memberProfile}
      leadCount={memberLeads.length}
      assignmentCount={memberAssignments.length}
    />
  );
}
