import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { getAppShellSnapshot } from "@/lib/app-shell/data";
import { buildInitials } from "@/lib/app-shell/utils";

export default async function MemberProfilePage() {
  const data = await getAppShellSnapshot();

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Sponsor / Member / Perfil"
        title="Perfil operativo del sponsor"
        description="Superficie inicial de perfil personal. En esta fase mezcla datos reales del sponsor con preferencias mock claramente separadas hasta integrar auth y persistencia de usuario."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Disponibilidad"
          value={data.currentSponsor.availabilityStatus}
          hint="Estado comercial visible para rotación y handoff."
        />
        <KpiCard
          label="Peso routing"
          value={String(data.currentSponsor.routingWeight)}
          hint="Valor actual usado por reglas simples de distribución."
        />
        <KpiCard
          label="Timezone"
          value={data.memberProfile.timezone}
          hint="Preferencia mock separada del dominio productivo."
        />
        <KpiCard
          label="Ventana de respuesta"
          value={data.memberProfile.responseWindow}
          hint="Se convertirá luego en preferencia persistida por sponsor."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-base font-semibold text-white">
              {buildInitials(data.currentSponsor.displayName)}
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-slate-950">
                {data.currentSponsor.displayName}
              </h2>
              <p className="text-sm text-slate-600">{data.memberProfile.title}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <StatusBadge value={data.currentSponsor.status} />
            <StatusBadge value={data.currentSponsor.availabilityStatus} />
          </div>

          <dl className="mt-6 space-y-4 text-sm">
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {data.currentSponsor.email ?? "Sin email"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Teléfono</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {data.currentSponsor.phone ?? "Sin teléfono"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Foco actual</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {data.memberProfile.focus}
              </dd>
            </div>
          </dl>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <h2 className="text-xl font-semibold text-slate-950">
            Preferencias temporales
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Esta sección sigue mockeada de forma explícita hasta que exista auth
            real y storage por sponsor.
          </p>

          <dl className="mt-6 space-y-5 text-sm">
            <div>
              <dt className="text-slate-500">Canales preferidos</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {data.memberProfile.channels.map((channel) => (
                  <span
                    key={channel}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700"
                  >
                    {channel}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Notas</dt>
              <dd className="mt-1 leading-6 text-slate-800">
                {data.memberProfile.notes}
              </dd>
            </div>
          </dl>
        </article>
      </section>
    </div>
  );
}
