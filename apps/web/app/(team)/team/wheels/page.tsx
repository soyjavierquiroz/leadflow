import { TeamWheelsClient } from "@/components/team-operations/team-wheels-client";
import { getAppShellSnapshot } from "@/lib/app-shell/data";
import { getTeamMembersSnapshot } from "@/lib/team-members";
import { getTeamAdWheels } from "@/lib/team-wheels";

export default async function TeamWheelsPage() {
  const [wheels, data, membersSnapshot] = await Promise.all([
    getTeamAdWheels(),
    getAppShellSnapshot(),
    getTeamMembersSnapshot(),
  ]);

  return (
    <TeamWheelsClient
      initialRows={wheels}
      publications={data.publicationViews.filter(
        (item) => item.teamId === data.currentTeam.id && item.status === "active",
      )}
      sponsors={membersSnapshot.members.filter(
        (member) =>
          Boolean(member.sponsorId) &&
          member.userStatus === "active" &&
          member.sponsorStatus === "active" &&
          member.availabilityStatus === "available" &&
          member.isActive,
      )}
    />
  );
}
