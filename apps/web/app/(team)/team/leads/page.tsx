import { TeamLeadsClient } from "@/components/team-operations/team-leads-client";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

export default async function TeamLeadsPage() {
  const data = await getAppShellSnapshot();

  return (
    <TeamLeadsClient
      initialRows={data.leadViews.filter((item) => item.teamId === data.currentTeam.id)}
    />
  );
}
