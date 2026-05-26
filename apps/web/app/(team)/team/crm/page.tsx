import { TeamCrmClient } from "@/components/team-operations/team-crm-client";
import { getTeamCrmInboxSnapshot } from "@/lib/team-crm";

export default async function TeamCrmPage() {
  const snapshot = await getTeamCrmInboxSnapshot({
    tab: "all",
    limit: 50,
  });

  return <TeamCrmClient initialSnapshot={snapshot} />;
}
