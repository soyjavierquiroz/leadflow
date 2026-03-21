import Link from "next/link";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { SponsorCard } from "@/components/app-shell/sponsor-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { getAppShellSnapshot } from "@/lib/app-shell/data";
import { formatCompactNumber, formatDateTime } from "@/lib/app-shell/utils";

export default async function MemberPage() {
  const data = await getAppShellSnapshot();
  const memberLeads = data.leadViews.filter(
    (item) => item.sponsorId === data.currentSponsor.id,
  );
  const memberAssignments = data.assignments.filter(
    (item) => item.sponsorId === data.currentSponsor.id,
  );

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Sponsor / Member"
        title="Resumen operativo personal"
        description="Primera vista para sponsors, pensada para integrarse luego con auth real y permisos por perfil sin rehacer el shell."
        actions={
          <>
            <Link
              href="/member/leads"
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Ver mis leads
            </Link>
            <Link
              href="/member/profile"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            >
              Revisar perfil
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Leads asignados"
          value={formatCompactNumber(memberLeads.length)}
          hint="Prospectos hoy visibles para el sponsor demo activo."
        />
        <KpiCard
          label="Assignments activos"
          value={formatCompactNumber(
            memberAssignments.filter((item) => item.resolvedAt === null).length,
          )}
          hint="Volumen de trabajo todavía en seguimiento."
        />
        <KpiCard
          label="Aceptados"
          value={formatCompactNumber(
            memberAssignments.filter((item) => item.status === "accepted").length,
          )}
          hint="Señal rápida del pipeline ya tomado por el sponsor."
        />
        <KpiCard
          label="Canales"
          value={formatCompactNumber(data.memberProfile.channels.length)}
          hint="Preferencias del perfil demo listas para volverse persistentes luego."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <SponsorCard
          sponsor={data.currentSponsor}
          leadCount={memberLeads.length}
          assignmentCount={memberAssignments.length}
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
              key: "path",
              header: "Entrada",
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
              key: "date",
              header: "Asignado",
              render: (row) => formatDateTime(row.assignedAt),
            },
            {
              key: "status",
              header: "Estado",
              render: (row) => <StatusBadge value={row.assignmentStatus ?? row.status} />,
            },
          ]}
          rows={memberLeads.slice(0, 5)}
          emptyTitle="Sin leads asignados"
          emptyDescription="Cuando este sponsor reciba handoffs, el dashboard mostrará los leads aquí."
        />
      </section>
    </div>
  );
}
