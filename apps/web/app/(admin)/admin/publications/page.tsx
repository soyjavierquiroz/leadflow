import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { PublicationCard } from "@/components/app-shell/publication-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { getAppShellSnapshot } from "@/lib/app-shell/data";
import { formatCompactNumber } from "@/lib/app-shell/utils";

export default async function AdminPublicationsPage() {
  const data = await getAppShellSnapshot();

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Super Admin / Publicaciones"
        title="Bindings públicos por host y path"
        description="Vista centralizada para entender qué funnels están publicados, sobre qué dominio corren y qué tan listos están sus contextos de tracking y handoff."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Publicaciones"
          value={formatCompactNumber(data.publicationViews.length)}
          hint="Bindings activos o draft listos para servir rutas visibles."
        />
        <KpiCard
          label="Dominios"
          value={formatCompactNumber(data.domains.length)}
          hint="Hosts disponibles para resolver funnels públicos."
        />
        <KpiCard
          label="Tracking listo"
          value={formatCompactNumber(
            data.publicationViews.filter((item) => item.trackingProfileId).length,
          )}
          hint="Publicaciones con contexto de tracking ya asignado."
        />
        <KpiCard
          label="Handoff listo"
          value={formatCompactNumber(
            data.publicationViews.filter((item) => item.handoffStrategyId).length,
          )}
          hint="Publicaciones listas para disparar handoff posterior."
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        {data.publicationViews.map((publication) => (
          <PublicationCard key={publication.id} publication={publication} />
        ))}
      </div>

      <DataTable
        columns={[
          {
            key: "path",
            header: "Path",
            render: (row) => (
              <div>
                <p className="font-semibold text-slate-950">{row.pathPrefix}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {row.domainHost}
                </p>
              </div>
            ),
          },
          {
            key: "funnel",
            header: "Funnel",
            render: (row) => (
              <div>
                <p>{row.funnelName}</p>
                <p className="text-xs text-slate-500">{row.templateName}</p>
              </div>
            ),
          },
          {
            key: "team",
            header: "Team",
            render: (row) => row.teamName,
          },
          {
            key: "status",
            header: "Estado",
            render: (row) => <StatusBadge value={row.status} />,
          },
        ]}
        rows={data.publicationViews}
        emptyTitle="Sin publicaciones visibles"
        emptyDescription="Cuando no exista ninguna publicación activa o draft, esta tabla lo reflejará."
      />
    </div>
  );
}
