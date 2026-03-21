import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { getAppShellSnapshot } from "@/lib/app-shell/data";
import { formatCompactNumber } from "@/lib/app-shell/utils";

export default async function AdminTeamsPage() {
  const data = await getAppShellSnapshot();

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Super Admin / Teams"
        title="Ownership operativo por team"
        description="El backend todavía no expone un endpoint HTTP de teams. Esta vista combina métricas reales derivadas desde sponsors, funnels, pools, dominios y publicaciones con metadata temporal del team."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Teams detectados"
          value={formatCompactNumber(data.teams.length)}
          hint="Derivados desde activos operativos y preparados para conectarse a auth posterior."
        />
        <KpiCard
          label="Sponsors"
          value={formatCompactNumber(data.sponsors.length)}
          hint="Capacidad comercial visible hoy desde el workspace."
        />
        <KpiCard
          label="Funnels"
          value={formatCompactNumber(data.funnelViews.length)}
          hint="Instancias que cada team puede operar sobre templates aprobados."
        />
        <KpiCard
          label="Pools"
          value={formatCompactNumber(data.rotationPools.length)}
          hint="Contenedores de round robin y handoff diferido disponibles."
        />
      </section>

      <DataTable
        columns={[
          {
            key: "team",
            header: "Team",
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
            key: "status",
            header: "Estado",
            render: (row) => <StatusBadge value={row.status} />,
          },
          {
            key: "capacity",
            header: "Capacidad",
            render: (row) => (
              <div className="space-y-1 text-sm">
                <p>{row.sponsorCount} sponsors</p>
                <p>{row.poolCount} pools</p>
              </div>
            ),
          },
          {
            key: "delivery",
            header: "Delivery",
            render: (row) => (
              <div className="space-y-1 text-sm">
                <p>{row.funnelCount} funnels</p>
                <p>{row.publicationCount} publicaciones</p>
              </div>
            ),
          },
          {
            key: "pipeline",
            header: "Pipeline",
            render: (row) => (
              <div className="space-y-1 text-sm">
                <p>{row.leadCount} leads</p>
                <p>{row.assignmentCount} assignments</p>
              </div>
            ),
          },
        ]}
        rows={data.teams}
        emptyTitle="No hay teams visibles"
        emptyDescription="Cuando la capa operativa tenga más equipos, aparecerán aquí con métricas consolidadas."
      />
    </div>
  );
}
