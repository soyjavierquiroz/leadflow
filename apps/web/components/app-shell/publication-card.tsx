import type { ReactNode } from "react";
import { StatusBadge } from "@/components/app-shell/status-badge";
import type { PublicationView } from "@/lib/app-shell/types";

type PublicationCardProps = {
  publication: PublicationView;
  actions?: ReactNode;
};

export function PublicationCard({
  publication,
  actions,
}: PublicationCardProps) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            {publication.domainHost}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">
            {publication.pathPrefix}
          </h3>
        </div>
        <StatusBadge value={publication.status} />
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Funnel</dt>
          <dd className="font-medium text-slate-800">{publication.funnelName}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Template</dt>
          <dd className="font-medium text-slate-800">{publication.templateName}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Tracking</dt>
          <dd className="font-medium text-slate-800">{publication.trackingLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-slate-500">Handoff</dt>
          <dd className="font-medium text-slate-800">{publication.handoffLabel}</dd>
        </div>
      </dl>
      {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
}
