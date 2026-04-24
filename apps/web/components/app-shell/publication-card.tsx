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
    <article className="w-full rounded-3xl border border-app-border bg-app-card p-5 text-left shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
            {publication.domainHost}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-app-text">
            {publication.pathPrefix}
          </h3>
        </div>
        <StatusBadge value={publication.status} />
      </div>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-app-text-soft">Funnel</dt>
          <dd className="font-medium text-app-text">{publication.funnelName}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-app-text-soft">Template</dt>
          <dd className="font-medium text-app-text">{publication.templateName}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-app-text-soft">Tracking</dt>
          <dd className="font-medium text-app-text">{publication.trackingLabel}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-app-text-soft">Handoff</dt>
          <dd className="font-medium text-app-text">{publication.handoffLabel}</dd>
        </div>
      </dl>
      {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
}
