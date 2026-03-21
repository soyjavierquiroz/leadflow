import type { ReactNode } from "react";
import { buildInitials } from "@/lib/app-shell/utils";
import { StatusBadge } from "@/components/app-shell/status-badge";
import type { SponsorRecord } from "@/lib/app-shell/types";

type SponsorCardProps = {
  sponsor: SponsorRecord;
  leadCount: number;
  assignmentCount: number;
  actions?: ReactNode;
};

export function SponsorCard({
  sponsor,
  leadCount,
  assignmentCount,
  actions,
}: SponsorCardProps) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
            {buildInitials(sponsor.displayName)}
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-950">
              {sponsor.displayName}
            </h3>
            <p className="text-sm text-slate-600">
              {sponsor.email ?? "Sin email"} · {sponsor.phone ?? "Sin teléfono"}
            </p>
          </div>
        </div>
        <StatusBadge value={sponsor.availabilityStatus} />
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-slate-50 p-3">
          <dt className="text-slate-500">Leads activos</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-950">
            {leadCount}
          </dd>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3">
          <dt className="text-slate-500">Assignments</dt>
          <dd className="mt-1 text-lg font-semibold text-slate-950">
            {assignmentCount}
          </dd>
        </div>
      </dl>
      {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
}
