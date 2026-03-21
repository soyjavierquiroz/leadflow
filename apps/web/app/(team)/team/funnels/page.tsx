import { TeamFunnelsClient } from "@/components/team-operations/team-funnels-client";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

export default async function TeamFunnelsPage() {
  const data = await getAppShellSnapshot();

  return (
    <TeamFunnelsClient
      initialRows={data.funnelViews.filter((item) => item.teamId === data.currentTeam.id)}
      teamName={data.currentTeam.name}
      templates={data.templates}
      rotationPools={data.rotationPools.filter((item) => item.teamId === data.currentTeam.id)}
      trackingProfiles={data.trackingProfiles.filter(
        (item) => item.teamId === data.currentTeam.id,
      )}
      handoffStrategies={data.handoffStrategies.filter(
        (item) => item.teamId === data.currentTeam.id || item.teamId === null,
      )}
    />
  );
}
