import { TeamLeadsClient } from "@/components/team-operations/team-leads-client";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

export default async function TeamLeadsPage() {
  const data = await getAppShellSnapshot();
  const rows = data.leadViews.filter(
    (item) => item.teamId === data.currentTeam.id,
  );
  const activeRows = rows.filter((item) => item.reminderBucket !== "none");
  const remindersSummary = {
    ...data.remindersSummary,
    totals: {
      active: activeRows.length,
      overdue: activeRows.filter((item) => item.reminderBucket === "overdue")
        .length,
      dueToday: activeRows.filter((item) => item.reminderBucket === "due_today")
        .length,
      upcoming: activeRows.filter((item) => item.reminderBucket === "upcoming")
        .length,
      unscheduled: activeRows.filter(
        (item) => item.reminderBucket === "unscheduled",
      ).length,
      needsAttention: activeRows.filter((item) => item.needsAttention).length,
    },
  };

  return (
    <TeamLeadsClient initialRows={rows} remindersSummary={remindersSummary} />
  );
}
