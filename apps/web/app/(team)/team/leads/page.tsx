import { TeamLeadsClient } from "@/components/team-operations/team-leads-client";
import { getTeamLeadInboxSnapshot } from "@/lib/team-leads";

export default async function TeamLeadsPage() {
  const snapshot = await getTeamLeadInboxSnapshot();

  return (
    <TeamLeadsClient
      initialRows={snapshot.items}
      availableSponsors={snapshot.availableSponsors}
    />
  );
}
