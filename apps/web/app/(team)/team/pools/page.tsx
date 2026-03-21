import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { getAppShellSnapshot } from "@/lib/app-shell/data";
import { formatCompactNumber } from "@/lib/app-shell/utils";

export default async function TeamPoolsPage() {
  const data = await getAppShellSnapshot();
  const rows = data.rotationPools.filter(
    (item) => item.teamId === data.currentTeam.id,
  );

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Pools"
        title="Pools de rotación del team"
        description="Vista SaaS base para revisar contenedores de routing, cobertura de sponsors y uso operativo por funnels."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Pools"
          value={formatCompactNumber(rows.length)}
          hint="Contenedores de round robin activos o draft."
        />
        <KpiCard
          label="Fallback"
          value={formatCompactNumber(rows.filter((item) => item.isFallbackPool).length)}
          hint="Pools de respaldo para reglas operativas futuras."
        />
        <KpiCard
          label="Sponsors cubiertos"
          value={formatCompactNumber(
            rows.reduce((total, item) => total + item.sponsorIds.length, 0),
          )}
          hint="Miembros conectados a la capa de distribución."
        />
        <KpiCard
          label="Funnels conectados"
          value={formatCompactNumber(
            rows.reduce((total, item) => total + item.funnelIds.length, 0),
          )}
          hint="Embudos que ya dependen de la rotación del team."
        />
      </section>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Pool",
            render: (row) => (
              <div>
                <p className="font-semibold text-slate-950">{row.name}</p>
                <p className="text-xs text-slate-500">{row.strategy}</p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Estado",
            render: (row) => <StatusBadge value={row.status} />,
          },
          {
            key: "coverage",
            header: "Cobertura",
            render: (row) => `${row.sponsorIds.length} sponsors`,
          },
          {
            key: "funnels",
            header: "Funnels",
            render: (row) => `${row.funnelIds.length} conectados`,
          },
          {
            key: "fallback",
            header: "Fallback",
            render: (row) => (row.isFallbackPool ? "Sí" : "No"),
          },
        ]}
        rows={rows}
        emptyTitle="Sin pools para este team"
        emptyDescription="Cuando el team configure pools activos aparecerán aquí con sus sponsors y funnels conectados."
      />
    </div>
  );
}
