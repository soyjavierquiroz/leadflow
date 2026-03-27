import { TeamDomainsClient } from "@/components/team-operations/team-domains-client";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

export default async function TeamDomainsPage() {
  const data = await getAppShellSnapshot();

  return (
    <TeamDomainsClient
      initialRows={data.domains.filter(
        (item) => item.teamId === data.currentTeam.id,
      )}
    />
  );
}
