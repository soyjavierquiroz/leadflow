import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { getAppShellSnapshot } from "@/lib/app-shell/data";
import { formatCompactNumber, formatDateTime } from "@/lib/app-shell/utils";

export default async function MemberLeadsPage() {
  const data = await getAppShellSnapshot();
  const rows = data.leadViews.filter((item) => item.sponsorId === data.currentSponsor.id);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Sponsor / Member / Leads"
        title="Leads asignados al sponsor"
        description="Listado base para el sponsor con el pipeline de leads actualmente vinculados a su perfil demo."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Leads"
          value={formatCompactNumber(rows.length)}
          hint="Listado personal de leads conectados al sponsor."
        />
        <KpiCard
          label="Assigned"
          value={formatCompactNumber(
            rows.filter((item) => item.assignmentStatus === "assigned").length,
          )}
          hint="Leads asignados y pendientes de tomar."
        />
        <KpiCard
          label="Accepted"
          value={formatCompactNumber(
            rows.filter((item) => item.assignmentStatus === "accepted").length,
          )}
          hint="Handoffs ya aceptados por el sponsor."
        />
        <KpiCard
          label="Con empresa"
          value={formatCompactNumber(
            rows.filter((item) => Boolean(item.companyName)).length,
          )}
          hint="Señal de enriquecimiento básico del perfil del lead."
        />
      </section>

      <DataTable
        columns={[
          {
            key: "lead",
            header: "Lead",
            render: (row) => (
              <div>
                <p className="font-semibold text-slate-950">
                  {row.fullName ?? "Lead sin nombre"}
                </p>
                <p className="text-xs text-slate-500">
                  {row.companyName ?? row.email ?? row.phone ?? "Sin contacto"}
                </p>
              </div>
            ),
          },
          {
            key: "origin",
            header: "Origen",
            render: (row) => (
              <div>
                <p>{row.publicationPath ?? "Sin publicación"}</p>
                <p className="text-xs text-slate-500">
                  {row.domainHost ?? "Host pendiente"}
                </p>
              </div>
            ),
          },
          {
            key: "assignedAt",
            header: "Asignado",
            render: (row) => formatDateTime(row.assignedAt),
          },
          {
            key: "leadStatus",
            header: "Lead",
            render: (row) => <StatusBadge value={row.status} />,
          },
          {
            key: "assignmentStatus",
            header: "Assignment",
            render: (row) => <StatusBadge value={row.assignmentStatus} />,
          },
        ]}
        rows={rows}
        emptyTitle="Sin leads asignados"
        emptyDescription="Cuando el sponsor reciba más handoffs, este listado los mostrará automáticamente."
      />
    </div>
  );
}
