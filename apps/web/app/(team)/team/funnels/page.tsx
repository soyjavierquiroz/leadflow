import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { getAppShellSnapshot } from "@/lib/app-shell/data";
import { formatCompactNumber } from "@/lib/app-shell/utils";

export default async function TeamFunnelsPage() {
  const data = await getAppShellSnapshot();
  const rows = data.funnelViews.filter((item) => item.teamId === data.currentTeam.id);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Funnels"
        title="Instancias operativas del team"
        description="Lectura base de funnels activos para el team, con conexión a templates, publicaciones y readiness de tracking."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Funnels"
          value={formatCompactNumber(rows.length)}
          hint="Instancias activas o draft listas para publicación."
        />
        <KpiCard
          label="Tracking listo"
          value={formatCompactNumber(rows.filter((item) => item.trackingReady).length)}
          hint="Funnels con perfil de tracking ya resuelto."
        />
        <KpiCard
          label="Con publicaciones"
          value={formatCompactNumber(
            rows.filter((item) => item.publicationCount > 0).length,
          )}
          hint="Instancias que ya están conectadas a un host + path."
        />
        <KpiCard
          label="Pool asignado"
          value={formatCompactNumber(
            rows.filter((item) => item.rotationPoolId).length,
          )}
          hint="Cobertura operativa para round robin simple."
        />
      </section>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Funnel",
            render: (row) => (
              <div>
                <p className="font-semibold text-slate-950">{row.name}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {row.code}
                </p>
              </div>
            ),
          },
          {
            key: "template",
            header: "Template",
            render: (row) => row.templateName,
          },
          {
            key: "publications",
            header: "Publicaciones",
            render: (row) => `${row.publicationCount} activas/draft`,
          },
          {
            key: "ops",
            header: "Operación",
            render: (row) => (
              <div className="space-y-1">
                <p>{row.rotationLabel}</p>
                <p className="text-xs text-slate-500">
                  {row.trackingReady ? "Tracking listo" : "Tracking pendiente"}
                </p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Estado",
            render: (row) => <StatusBadge value={row.status} />,
          },
        ]}
        rows={rows}
        emptyTitle="Sin funnels operativos"
        emptyDescription="Cuando el team tenga instancias activas o draft aparecerán aquí con su readiness."
      />
    </div>
  );
}
