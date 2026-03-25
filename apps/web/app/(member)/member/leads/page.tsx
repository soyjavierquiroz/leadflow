import { MemberLeadsClient } from "@/components/member-operations/member-leads-client";
import { getAppShellSnapshot } from "@/lib/app-shell/data";

export default async function MemberLeadsPage() {
  const data = await getAppShellSnapshot();
  const rows = data.leadViews.filter(
    (item) => item.sponsorId === data.currentSponsor.id,
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
    <MemberLeadsClient initialRows={rows} remindersSummary={remindersSummary} />
  );
}
