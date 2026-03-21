import { TeamPublicationsClient } from "@/components/team-operations/team-publications-client";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

export default async function TeamPublicationsPage() {
  const data = await getAppShellSnapshot();

  return (
    <TeamPublicationsClient
      initialRows={data.publicationViews.filter(
        (item) => item.teamId === data.currentTeam.id,
      )}
      domains={data.domains.filter((item) => item.teamId === data.currentTeam.id)}
      funnels={data.funnelViews.filter((item) => item.teamId === data.currentTeam.id)}
      trackingProfiles={data.trackingProfiles.filter(
        (item) => item.teamId === data.currentTeam.id,
      )}
      handoffStrategies={data.handoffStrategies.filter(
        (item) => item.teamId === data.currentTeam.id || item.teamId === null,
      )}
    />
  );
}
