import Link from "next/link";
import { DataTable } from "@/components/app-shell/data-table";
import { EmptyState } from "@/components/app-shell/empty-state";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { PublicationCard } from "@/components/app-shell/publication-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { getAppShellSnapshot } from "@/lib/app-shell/data";
import { formatCompactNumber } from "@/lib/app-shell/utils";

export default async function AdminPage() {
  const data = await getAppShellSnapshot();
  const liveCollectionCount = Object.values(data.sources).filter(
    (value) => value === "live",
  ).length;
  const recentPublications = data.publicationViews.slice(0, 3);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Surface / Super Admin"
        title="Control estructural de la plataforma"
        description="Primera superficie visible para supervisar templates, equipos, publicaciones y el estado general del workspace sin depender todavía de auth final."
        actions={
          <>
            <Link
              href="/admin/templates"
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Ver templates
            </Link>
            <Link
              href="/admin/publications"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Revisar publicaciones
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Workspaces visibles"
          value={formatCompactNumber(data.workspaces.length)}
          hint="Hoy el shell trabaja sobre el workspace principal, listo para auth y multitenancy posterior."
        />
        <KpiCard
          label="Templates"
          value={formatCompactNumber(data.templates.length)}
          hint="Catálogo estructural controlado por plataforma para funnels JSON-driven."
        />
        <KpiCard
          label="Publicaciones activas"
          value={formatCompactNumber(
            data.publicationViews.filter((item) => item.status === "active").length,
          )}
          hint="Bindings visibles por host + path ya conectables con el runtime público."
        />
        <KpiCard
          label="Colecciones live"
          value={`${liveCollectionCount}/${Object.keys(data.sources).length}`}
          hint="El shell usa API real cuando está disponible y cae a mocks aislados solo cuando hace falta."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <SectionHeader
            eyebrow="Templates"
            title="Catálogo estructural"
            description="Versión inicial del control de templates con señal clara de ownership para plataforma."
          />
          <DataTable
            columns={[
              {
                key: "name",
                header: "Template",
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
                key: "type",
                header: "Tipo",
                render: (row) => row.funnelType,
              },
              {
                key: "version",
                header: "Versión",
                render: (row) => `v${row.version}`,
              },
              {
                key: "status",
                header: "Estado",
                render: (row) => <StatusBadge value={row.status} />,
              },
            ]}
            rows={data.templates}
            emptyTitle="Sin templates cargados"
            emptyDescription="Cuando la API no tenga templates o el catálogo esté vacío, este listado mostrará ese estado claramente."
          />
        </div>

        <div className="space-y-4">
          <SectionHeader
            eyebrow="Highlights"
            title="Publicaciones recientes"
            description="Vista rápida para detectar qué funnels están ya expuestos."
          />
          {recentPublications.length > 0 ? (
            <div className="space-y-4">
              {recentPublications.map((publication) => (
                <PublicationCard
                  key={publication.id}
                  publication={publication}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No hay publicaciones recientes"
              description="Las publicaciones activas aparecerán aquí para acelerar la supervisión del rollout."
            />
          )}
        </div>
      </section>
    </div>
  );
}
