import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { PublicationCard } from "@/components/app-shell/publication-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { getAppShellSnapshot } from "@/lib/app-shell/data";
import { formatCompactNumber } from "@/lib/app-shell/utils";

export default async function TeamPublicationsPage() {
  const data = await getAppShellSnapshot();
  const rows = data.publicationViews.filter(
    (item) => item.teamId === data.currentTeam.id,
  );

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Publicaciones"
        title="Rutas visibles del team"
        description="La superficie del team ya puede revisar qué dominios y paths están activos, aunque la edición completa llegue en una fase posterior."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Publicaciones"
          value={formatCompactNumber(rows.length)}
          hint="Bindings activos o draft bajo ownership del team."
        />
        <KpiCard
          label="Root routes"
          value={formatCompactNumber(rows.filter((item) => item.pathPrefix === "/").length)}
          hint="Landings principales del dominio."
        />
        <KpiCard
          label="Subrutas"
          value={formatCompactNumber(rows.filter((item) => item.pathPrefix !== "/").length)}
          hint="Entradas específicas como oportunidades u ofertas."
        />
        <KpiCard
          label="Tracking listo"
          value={formatCompactNumber(rows.filter((item) => item.trackingProfileId).length)}
          hint="Publicaciones con contexto de tracking conectado."
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {rows.map((publication) => (
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
                <p className="text-xs text-slate-500">{row.domainHost}</p>
              </div>
            ),
          },
          {
            key: "funnel",
            header: "Funnel",
            render: (row) => row.funnelName,
          },
          {
            key: "tracking",
            header: "Tracking",
            render: (row) => row.trackingLabel,
          },
          {
            key: "status",
            header: "Estado",
            render: (row) => <StatusBadge value={row.status} />,
          },
        ]}
        rows={rows}
        emptyTitle="Sin publicaciones para este team"
        emptyDescription="Cuando el team publique funnels sobre dominios propios, esta tabla se llenará automáticamente."
      />
    </div>
  );
}
