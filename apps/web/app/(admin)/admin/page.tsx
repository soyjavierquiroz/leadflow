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
  const activeTeamsCount = data.teams.filter((team) => team.status === "active").length;
  const activeFunnelsCount = data.funnelViews.filter(
    (item) => item.status === "active",
  ).length;
  const activeLeadCount = data.leadViews.filter((lead) =>
    ["captured", "assigned", "qualified", "nurturing"].includes(lead.status),
  ).length;
  const recentPublications = data.publicationViews.slice(0, 3);
  const priorityTeams = data.teams.slice(0, 5);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Super Admin / Plataforma"
        title="Panel de plataforma Leadflow"
        description="Aquí se entiende qué está publicando Leadflow, qué equipos están operando y dónde conviene intervenir primero para que la captación y el handoff no se frenen."
        actions={
          <>
            <Link
              href="/admin/templates"
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Revisar templates
            </Link>
            <Link
              href="/admin/publications"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Ver publicaciones activas
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Teams operando"
          value={formatCompactNumber(activeTeamsCount)}
          hint="Equipos que hoy tienen capacidad para mover funnels, publicaciones y leads."
        />
        <KpiCard
          label="Funnels activos"
          value={formatCompactNumber(activeFunnelsCount)}
          hint="Embudos listos para captación real o para seguirse preparando desde plataforma."
        />
        <KpiCard
          label="Publicaciones live"
          value={formatCompactNumber(
            data.publicationViews.filter((item) => item.status === "active").length,
          )}
          hint="Salidas visibles por host y path que ya representan producto frente al mercado."
        />
        <KpiCard
          label="Leads en movimiento"
          value={formatCompactNumber(activeLeadCount)}
          hint="Oportunidades activas que validan que la plataforma no está solo configurada: ya está trabajando."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
            Lectura rapida de plataforma
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            Lo que conviene mirar primero
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Catálogo y estructura
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {formatCompactNumber(data.templates.length)} templates listos y{" "}
                {formatCompactNumber(data.workspaces.length)} workspace visible
                para seguir escalando sin tocar el modelo base.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Captación activa
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {formatCompactNumber(data.leadViews.length)} leads ya entraron
                por el runtime y {formatCompactNumber(data.assignments.length)}{" "}
                assignments validan el handoff.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Señal de datos
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {liveCollectionCount}/{Object.keys(data.sources).length} colecciones
                están sobre fuente real. El resto sigue visible para no frenar
                lectura de producto.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Prioridad de plataforma
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Mantener claridad entre catálogo, equipos y publicaciones para
                que el rollout se entienda como operación y no como setup
                abstracto.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeader
            eyebrow="Teams"
            title="Equipos bajo supervisión"
            description="Resumen rápido para detectar qué equipos tienen volumen, capacidad y publicaciones activas."
          />
          <DataTable
            columns={[
              {
                key: "name",
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
                key: "capacity",
                header: "Capacidad",
                render: (row) => `${row.sponsorCount} sponsors`,
              },
              {
                key: "reach",
                header: "Salida",
                render: (row) => `${row.publicationCount} publicaciones`,
              },
              {
                key: "pipeline",
                header: "Pipeline",
                render: (row) => `${row.leadCount} leads`,
              },
              {
                key: "status",
                header: "Estado",
                render: (row) => <StatusBadge value={row.status} />,
              },
            ]}
            rows={priorityTeams}
            emptyTitle="Sin teams visibles"
            emptyDescription="Cuando existan más equipos operando, esta vista los mostrará con capacidad, salida y volumen."
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <SectionHeader
            eyebrow="Templates"
            title="Catálogo que sostiene el funnel"
            description="Templates visibles para entender qué experiencias públicas administra plataforma y qué versión está activa."
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
            emptyDescription="Cuando el catálogo esté vacío o el API no entregue templates, este bloque lo dejará claro."
          />
        </div>

        <div className="space-y-4">
          <SectionHeader
            eyebrow="Rollout"
            title="Publicaciones con salida visible"
            description="Lectura rápida para confirmar qué funnels ya se ven como producto en dominio y path reales."
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
