import { TeamPoolsClient } from "@/components/team-operations/team-pools-client";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

export default async function TeamPoolsPage() {
  const data = await getAppShellSnapshot();

  return (
    <TeamPoolsClient
      initialPools={data.rotationPools.filter((item) => item.teamId === data.currentTeam.id)}
      initialMembers={data.rotationPoolMembers.filter((item) =>
        data.rotationPools.some(
          (pool) => pool.teamId === data.currentTeam.id && pool.id === item.rotationPoolId,
        ),
      )}
    />
  );
}
