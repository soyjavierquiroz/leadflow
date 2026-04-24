import type { ReactNode } from "react";
import { buildInitials } from "@/lib/app-shell/utils";
import { StatusBadge } from "@/components/app-shell/status-badge";

type SponsorCardProps = {
  sponsor: {
    displayName: string;
    email: string | null;
    phone: string | null;
    availabilityStatus: string;
    avatarUrl?: string | null;
  };
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
    <article className="rounded-3xl border border-app-border bg-app-card p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {sponsor.avatarUrl ? (
            <img
              src={sponsor.avatarUrl}
              alt={`Avatar de ${sponsor.displayName}`}
              className="h-12 w-12 rounded-2xl object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-app-text text-sm font-semibold text-app-bg">
              {buildInitials(sponsor.displayName)}
            </div>
          )}
          <div>
            <h3 className="text-base font-semibold text-app-text">
              {sponsor.displayName}
            </h3>
            <p className="text-sm text-app-text-muted">
              {sponsor.email ?? "Sin email"} · {sponsor.phone ?? "Sin teléfono"}
            </p>
          </div>
        </div>
        <StatusBadge value={sponsor.availabilityStatus} />
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-app-surface-muted p-3">
          <dt className="text-app-text-soft">Leads activos</dt>
          <dd className="mt-1 text-lg font-semibold text-app-text">
            {leadCount}
          </dd>
        </div>
        <div className="rounded-2xl bg-app-surface-muted p-3">
          <dt className="text-app-text-soft">Assignments</dt>
          <dd className="mt-1 text-lg font-semibold text-app-text">
            {assignmentCount}
          </dd>
        </div>
      </dl>
      {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
}
