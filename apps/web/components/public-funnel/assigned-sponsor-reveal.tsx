"use client";

import { useEffect, useState } from "react";
import { readSubmissionContext } from "@/lib/public-funnel-session";

type AssignedSponsorRevealProps = {
  publicationId: string;
  title: string;
  description?: string;
};

export function AssignedSponsorReveal({
  publicationId,
  title,
  description,
}: AssignedSponsorRevealProps) {
  const [context, setContext] = useState<ReturnType<
    typeof readSubmissionContext
  > | null>(null);

  useEffect(() => {
    setContext(readSubmissionContext(publicationId));
  }, [publicationId]);

  const assignment = context?.assignment;

  return (
    <section className="rounded-[1.75rem] border border-amber-200 bg-amber-50/90 p-8 shadow-[0_18px_50px_rgba(245,158,11,0.12)]">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700">
          {description}
        </p>
      ) : null}
      <div className="mt-6 rounded-2xl border border-amber-200 bg-white p-5">
        {assignment ? (
          <>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-700">
              Sponsor asignado
            </p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {assignment.sponsor.displayName}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Estado
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {assignment.status}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Email
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {assignment.sponsor.email ?? "Sin email"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  WhatsApp
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {assignment.sponsor.phone ?? "Sin telefono"}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Este dato vive solo como contexto de la sesion del runtime v1. Mas
              adelante lo conectaremos con handoff, seguimiento y tracking
              reales.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-700">
              Todavia no hay un sponsor asignado en esta sesion.
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Completa el formulario del funnel para ver aqui el assignment que
              resolvio el round robin.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
