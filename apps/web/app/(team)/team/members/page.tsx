import { TeamMembersClient } from "@/components/team-operations/team-members-client";
import { getTeamMembersSnapshot } from "@/lib/team-members";

export default async function TeamMembersPage() {
  const snapshot = await getTeamMembersSnapshot();

  return (
    <TeamMembersClient
      initialMembers={snapshot.members}
      initialTeam={snapshot.team}
    />
  );
}
