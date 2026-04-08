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
  const leadsNeedingAttention = teamLeads.filter((item) => item.needsAttention);
  const teamReadyFunnels = teamFunnels.filter((item) => item.trackingReady);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Operacion"
        title={`Centro operativo de ${data.currentTeam.name}`}
        description="Esta vista resume captación, capacidad comercial y seguimiento para que el team sepa qué revisar primero y dónde está el próximo bloqueo."
        actions={
          <>
            <Link
              href="/team/leads"
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Revisar leads
            </Link>
            <Link
              href="/team/members"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Gestionar equipo
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
          hint="Embudos del team que ya sostienen la captación o están listos para hacerlo."
        />
        <KpiCard
          label="Publicaciones activas"
          value={formatCompactNumber(
            teamPublications.filter((item) => item.status === "active").length,
          )}
          hint="Salidas visibles donde el team ya está captando o validando demanda."
        />
        <KpiCard
          label="Sponsors habilitados"
          value={formatCompactNumber(
            teamSponsors.filter(
              (item) => item.status === "active" && item.isActive,
            ).length,
          )}
          hint="Miembros comerciales que hoy pueden absorber handoffs sin fricción."
        />
        <KpiCard
          label="Leads en pipeline"
          value={formatCompactNumber(teamLeads.length)}
          hint="Volumen total que el team tiene hoy entre captación, asignación y seguimiento."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
            Prioridades del team
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            Lo que conviene mover hoy
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Capacidad comercial
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {formatCompactNumber(
                  teamSponsors.filter(
                    (item) =>
                      item.availabilityStatus === "available" && item.isActive,
                  ).length,
                )}{" "}
                sponsors disponibles para tomar leads ahora mismo.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Seguimiento con riesgo
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {formatCompactNumber(leadsNeedingAttention.length)} leads ya
                requieren atención para que la oportunidad no se enfríe.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Readiness de funnels
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {formatCompactNumber(teamReadyFunnels.length)} de{" "}
                {formatCompactNumber(teamFunnels.length)} funnels ya tienen
                tracking resuelto para salir con mejor lectura.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Siguiente superficie
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                La bandeja de leads ya concentra reminders, próxima acción y
                playbook para ordenar la operación diaria.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeader
            eyebrow="Sponsors"
            title="Capacidad comercial actual"
            description="Lectura rápida de quién está disponible, con cuántos leads está cargado y dónde se puede seguir asignando."
          />
          {teamSponsors.length > 0 ? (
            <div className="grid gap-4">
              {teamSponsors.map((sponsor) => (
                <SponsorCard
                  key={sponsor.id}
                  sponsor={sponsor}
                  leadCount={
                    teamLeads.filter((lead) => lead.sponsorId === sponsor.id)
                      .length
                  }
                  assignmentCount={
                    data.assignments.filter(
                      (item) => item.sponsorId === sponsor.id,
                    ).length
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
            title="Pulso de la bandeja"
            description="Muestra rápida del pipeline que ya está entrando desde el funnel público y cómo se está distribuyendo."
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
                header: "Entrada",
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
                header: "Responsable",
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
            emptyEyebrow="Sin actividad todavía"
            emptyTitle="Sin leads para este team"
            emptyDescription="Cuando el funnel capture o rote nuevas oportunidades, aparecerán aquí para lectura rápida del equipo."
            emptyAction={
              <Link
                href="/team/publications/new-vsl"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Crear mi primer funnel
              </Link>
            }
          />
        </div>
      </section>
    </div>
  );
}
