import Link from "next/link";
import { DataTable } from "@/components/app-shell/data-table";
import { EmptyState } from "@/components/app-shell/empty-state";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { SponsorCard } from "@/components/app-shell/sponsor-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { getAppShellSnapshot } from "@/lib/app-shell/data";
import { formatCompactNumber, formatDateTime } from "@/lib/app-shell/utils";

export default async function TeamPage() {
  const data = await getAppShellSnapshot();
  const teamFunnels = data.funnelViews.filter(
    (item) => item.teamId === data.currentTeam.id,
  );
  const teamPublications = data.publicationViews.filter(
    (item) => item.teamId === data.currentTeam.id,
  );
  const teamSponsors = data.sponsors.filter(
    (item) => item.teamId === data.currentTeam.id,
  );
  const teamLeads = data.leadViews.filter(
    (item) => item.teamId === data.currentTeam.id,
  );

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Dashboard"
        title={`Operación de ${data.currentTeam.name}`}
        description="Vista inicial del team para operar funnels, sponsors, publicaciones y leads con datos reales cuando la API está disponible."
        actions={
          <>
            <Link
              href="/team/publications"
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Ver publicaciones
            </Link>
            <Link
              href="/team/leads"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Ir a leads
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Funnels activos"
          value={formatCompactNumber(
            teamFunnels.filter((item) => item.status === "active").length,
          )}
          hint="Instancias del team ya listas para operar sobre templates aprobados."
        />
        <KpiCard
          label="Publicaciones activas"
          value={formatCompactNumber(
            teamPublications.filter((item) => item.status === "active").length,
          )}
          hint="Rutas visibles sobre dominio real o mock del workspace."
        />
        <KpiCard
          label="Sponsors habilitados"
          value={formatCompactNumber(
            teamSponsors.filter((item) => item.status === "active").length,
          )}
          hint="Miembros comerciales listos para recibir handoffs."
        />
        <KpiCard
          label="Leads en pipeline"
          value={formatCompactNumber(teamLeads.length)}
          hint="Leads capturados desde el runtime público y listos para seguimiento."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <SectionHeader
            eyebrow="Sponsors"
            title="Capacidad actual del team"
            description="Cards rápidas para revisar disponibilidad y volumen asignado."
          />
          {teamSponsors.length > 0 ? (
            <div className="grid gap-4">
              {teamSponsors.map((sponsor) => (
                <SponsorCard
                  key={sponsor.id}
                  sponsor={sponsor}
                  leadCount={
                    teamLeads.filter((lead) => lead.sponsorId === sponsor.id).length
                  }
                  assignmentCount={
                    data.assignments.filter((item) => item.sponsorId === sponsor.id)
                      .length
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No hay sponsors visibles"
              description="Cuando el team tenga miembros operativos aparecerán aquí con su capacidad actual."
            />
          )}
        </div>

        <div className="space-y-4">
          <SectionHeader
            eyebrow="Leads recientes"
            title="Pipeline operativo"
            description="El team puede revisar aquí el estado de los leads provenientes del funnel público."
          />
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
                      {row.companyName ?? row.email ?? "Sin compañía"}
                    </p>
                  </div>
                ),
              },
              {
                key: "source",
                header: "Origen",
                render: (row) => (
                  <div>
                    <p>{row.sourceChannel}</p>
                    <p className="text-xs text-slate-500">
                      {row.publicationPath ?? "Sin publicación"}
                    </p>
                  </div>
                ),
              },
              {
                key: "assignment",
                header: "Asignación",
                render: (row) =>
                  row.sponsorName ? (
                    <div>
                      <p>{row.sponsorName}</p>
                      <p className="text-xs text-slate-500">
                        {formatDateTime(row.assignedAt)}
                      </p>
                    </div>
                  ) : (
                    "Pendiente"
                  ),
              },
              {
                key: "status",
                header: "Estado",
                render: (row) => <StatusBadge value={row.status} />,
              },
            ]}
            rows={teamLeads.slice(0, 6)}
            emptyTitle="Sin leads para este team"
            emptyDescription="Los leads del runtime público aparecerán aquí en cuanto existan capturas o asignaciones."
          />
        </div>
      </section>
    </div>
  );
}
