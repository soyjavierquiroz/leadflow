import { TeamSponsorsClient } from "@/components/team-operations/team-sponsors-client";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

export default async function TeamSponsorsPage() {
  const data = await getAppShellSnapshot();

  return (
    <TeamSponsorsClient
      initialRows={data.sponsors.filter((item) => item.teamId === data.currentTeam.id)}
      leadViews={data.leadViews.filter((item) => item.teamId === data.currentTeam.id)}
      assignments={data.assignments.filter((item) => item.teamId === data.currentTeam.id)}
    />
  );
}
