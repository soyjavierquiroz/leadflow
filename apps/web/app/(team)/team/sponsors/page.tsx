import { EmptyState } from "@/components/app-shell/empty-state";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { SponsorCard } from "@/components/app-shell/sponsor-card";
import { getAppShellSnapshot } from "@/lib/app-shell/data";
import { formatCompactNumber } from "@/lib/app-shell/utils";

export default async function TeamSponsorsPage() {
  const data = await getAppShellSnapshot();
  const rows = data.sponsors.filter((item) => item.teamId === data.currentTeam.id);

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Sponsors"
        title="Miembros operativos del team"
        description="Cards base para observar disponibilidad, contacto y carga comercial de cada sponsor sin entrar todavía en permisos finos."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Sponsors"
          value={formatCompactNumber(rows.length)}
          hint="Miembros ligados al team actual."
        />
        <KpiCard
          label="Disponibles"
          value={formatCompactNumber(
            rows.filter((item) => item.availabilityStatus === "available").length,
          )}
          hint="Capacidad actual para recibir handoffs."
        />
        <KpiCard
          label="Portal habilitado"
          value={formatCompactNumber(
            rows.filter((item) => item.memberPortalEnabled).length,
          )}
          hint="Sponsors listos para usar la superficie member."
        />
        <KpiCard
          label="Routing total"
          value={formatCompactNumber(
            rows.reduce((total, item) => total + item.routingWeight, 0),
          )}
          hint="Peso agregado de distribución para round robin y reglas futuras."
        />
      </section>

      {rows.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map((sponsor) => (
            <SponsorCard
              key={sponsor.id}
              sponsor={sponsor}
              leadCount={data.leadViews.filter((item) => item.sponsorId === sponsor.id).length}
              assignmentCount={
                data.assignments.filter((item) => item.sponsorId === sponsor.id).length
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Sin sponsors operativos"
          description="Cuando el team tenga miembros activos aparecerán aquí con una vista más clara de carga y disponibilidad."
        />
      )}
    </div>
  );
}
