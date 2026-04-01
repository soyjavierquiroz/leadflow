import { TeamWheelsClient } from "@/components/team-operations/team-wheels-client";
import { getTeamAdWheels } from "@/lib/team-wheels";

export default async function TeamWheelsPage() {
  const wheels = await getTeamAdWheels();

  return <TeamWheelsClient initialRows={wheels} />;
}
