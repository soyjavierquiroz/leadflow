import { TeamLeadsClient } from "@/components/team-operations/team-leads-client";
import { getAppShellSnapshot } from "@/lib/app-shell/data";
import { getTeamLeadInboxSnapshot } from "@/lib/team-leads";

export default async function TeamLeadsPage() {
  const [snapshot, appShellSnapshot] = await Promise.all([
    getTeamLeadInboxSnapshot(),
    getAppShellSnapshot(),
  ]);
  const funnelCount = appShellSnapshot.funnelViews.filter(
    (item) => item.teamId === appShellSnapshot.currentTeam.id,
  ).length;

  return (
    <TeamLeadsClient
      initialRows={snapshot.items}
      availableSponsors={snapshot.availableSponsors}
      funnelCount={funnelCount}
    />
  );
}
