"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { formatDateTime } from "@/lib/app-shell/utils";
import type { LeadView } from "@/lib/app-shell/types";
import {
  createLeadNote,
  getLeadTimelineDetail,
  type LeadQualificationGrade,
  type LeadTimelineDetail,
  updateLeadFollowUp,
  updateLeadQualification,
} from "@/lib/lead-qualification";

type LeadQualificationTimelinePanelProps = {
  leadId: string;
  onLeadChange?: (
    leadId: string,
    updates: Partial<
      Pick<
        LeadView,
        | "qualificationGrade"
        | "summaryText"
        | "nextActionLabel"
        | "followUpAt"
        | "lastContactedAt"
        | "lastQualifiedAt"
        | "status"
        | "updatedAt"
      >
    >,
  ) => void;
};

const qualificationOptions: Array<{
  value: LeadQualificationGrade | "none";
  label: string;
}> = [
  { value: "none", label: "Sin calificación" },
  { value: "cold", label: "Cold" },
  { value: "warm", label: "Warm" },
  { value: "hot", label: "Hot" },
];

const toDateTimeLocalValue = (value: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.valueOf())) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const fromDateTimeLocalValue = (value: string) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
};

const formatMaybeDate = (value: string | null, fallback: string) =>
  value ? formatDateTime(value) : fallback;

export function LeadQualificationTimelinePanel({
  leadId,
  onLeadChange,
}: LeadQualificationTimelinePanelProps) {
  const [detail, setDetail] = useState<LeadTimelineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qualificationGrade, setQualificationGrade] = useState<
    LeadQualificationGrade | "none"
  >("none");
  const [summaryText, setSummaryText] = useState("");
  const [nextActionLabel, setNextActionLabel] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "qualification" | "followUp" | "note" | null
  >(null);

  useEffect(() => {
    let ignore = false;

    const loadDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        const nextDetail = await getLeadTimelineDetail(leadId);

        if (ignore) {
          return;
        }

        setDetail(nextDetail);
        setQualificationGrade(nextDetail.lead.qualificationGrade ?? "none");
        setSummaryText(nextDetail.lead.summaryText ?? "");
        setNextActionLabel(nextDetail.lead.nextActionLabel ?? "");
        setFollowUpAt(toDateTimeLocalValue(nextDetail.lead.followUpAt));
      } catch (loadError) {
        if (!ignore) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No pudimos cargar el detalle enriquecido del lead.",
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      ignore = true;
    };
  }, [leadId]);

  const refreshDetail = async () => {
    const nextDetail = await getLeadTimelineDetail(leadId);
    setDetail(nextDetail);
    setQualificationGrade(nextDetail.lead.qualificationGrade ?? "none");
    setSummaryText(nextDetail.lead.summaryText ?? "");
    setNextActionLabel(nextDetail.lead.nextActionLabel ?? "");
    setFollowUpAt(toDateTimeLocalValue(nextDetail.lead.followUpAt));
  };

  const handleQualificationSubmit = async () => {
    setPendingAction("qualification");
    setFeedback(null);

    try {
      const updatedLead = await updateLeadQualification(leadId, {
        qualificationGrade:
          qualificationGrade === "none" ? null : qualificationGrade,
        summaryText: summaryText.trim() ? summaryText.trim() : null,
      });

      onLeadChange?.(leadId, {
        qualificationGrade: updatedLead.qualificationGrade,
        summaryText: updatedLead.summaryText,
        lastQualifiedAt: updatedLead.lastQualifiedAt,
        status: updatedLead.status,
        updatedAt: updatedLead.updatedAt,
      });
      await refreshDetail();
      setFeedback({
        tone: "success",
        message: "Calificación operativa actualizada.",
      });
    } catch (submitError) {
      setFeedback({
        tone: "error",
        message:
          submitError instanceof Error
            ? submitError.message
            : "No pudimos guardar la calificación.",
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleFollowUpSubmit = async () => {
    setPendingAction("followUp");
    setFeedback(null);

    try {
      const updatedLead = await updateLeadFollowUp(leadId, {
        nextActionLabel: nextActionLabel.trim() ? nextActionLabel.trim() : null,
        followUpAt: fromDateTimeLocalValue(followUpAt),
      });

      onLeadChange?.(leadId, {
        nextActionLabel: updatedLead.nextActionLabel,
        followUpAt: updatedLead.followUpAt,
        updatedAt: updatedLead.updatedAt,
      });
      await refreshDetail();
      setFeedback({
        tone: "success",
        message: "Plan de seguimiento actualizado.",
      });
    } catch (submitError) {
      setFeedback({
        tone: "error",
        message:
          submitError instanceof Error
            ? submitError.message
            : "No pudimos guardar el follow-up.",
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleNoteSubmit = async () => {
    setPendingAction("note");
    setFeedback(null);

    try {
      await createLeadNote(leadId, { body: noteBody });
      setNoteBody("");
      await refreshDetail();
      setFeedback({
        tone: "success",
        message: "Nota agregada al timeline del lead.",
      });
    } catch (submitError) {
      setFeedback({
        tone: "error",
        message:
          submitError instanceof Error
            ? submitError.message
            : "No pudimos guardar la nota.",
      });
    } finally {
      setPendingAction(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Cargando resumen operativo y timeline del lead...
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error ?? "No pudimos resolver el detalle del lead."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="text-slate-500">Calificación</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge value={detail.lead.status} />
            <StatusBadge value={detail.lead.assignmentStatus ?? "sin_assignment"} />
            {detail.lead.qualificationGrade ? (
              <StatusBadge value={detail.lead.qualificationGrade} />
            ) : null}
          </div>
          <p className="mt-3 text-slate-700">
            {detail.lead.summaryText ?? "Todavía no hay resumen operativo manual."}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="text-slate-500">Siguiente acción</p>
          <p className="mt-2 font-medium text-slate-950">
            {detail.lead.nextActionLabel ?? "Pendiente de definir"}
          </p>
          <p className="mt-1 text-slate-700">
            {formatMaybeDate(detail.lead.followUpAt, "Sin follow-up agendado")}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="text-slate-500">Último contacto</p>
          <p className="mt-2 font-medium text-slate-950">
            {formatMaybeDate(
              detail.lead.lastContactedAt,
              "Todavía sin contacto registrado",
            )}
          </p>
          <p className="mt-1 text-slate-700">
            Sponsor: {detail.lead.sponsorName ?? "Pendiente"}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="text-slate-500">Última calificación</p>
          <p className="mt-2 font-medium text-slate-950">
            {formatMaybeDate(
              detail.lead.lastQualifiedAt,
              "Sin señal o actualización manual",
            )}
          </p>
          <p className="mt-1 text-slate-700">
            Team: {detail.lead.teamName ?? "Sin team"}
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Calificación rápida
            </p>
            <p className="text-xs text-slate-500">
              Resumen corto, temperatura comercial y siguiente movimiento.
            </p>
          </div>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Temperatura</span>
            <select
              value={qualificationGrade}
              onChange={(event) =>
                setQualificationGrade(
                  event.target.value as LeadQualificationGrade | "none",
                )
              }
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            >
              {qualificationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Resumen operativo</span>
            <textarea
              value={summaryText}
              onChange={(event) => setSummaryText(event.target.value)}
              rows={4}
              placeholder="Qué sabemos del lead y por qué vale la pena seguirlo."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
          </label>

          <button
            type="button"
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pendingAction === "qualification"}
            onClick={() => void handleQualificationSubmit()}
          >
            Guardar calificación
          </button>

          <div className="h-px bg-slate-200" />

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Siguiente acción</span>
            <input
              value={nextActionLabel}
              onChange={(event) => setNextActionLabel(event.target.value)}
              placeholder="Ej. enviar voice note o reagendar llamada"
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Follow-up</span>
            <input
              type="datetime-local"
              value={followUpAt}
              onChange={(event) => setFollowUpAt(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
          </label>

          <button
            type="button"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pendingAction === "followUp"}
            onClick={() => void handleFollowUpSubmit()}
          >
            Guardar seguimiento
          </button>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-200 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Timeline del lead
            </p>
            <p className="text-xs text-slate-500">
              Señales entrantes, notas y eventos manuales en una sola vista.
            </p>
          </div>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-slate-700">Agregar nota</span>
            <textarea
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              rows={3}
              placeholder="Ej. respondió que revisa la propuesta mañana a las 9."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
          </label>

          <button
            type="button"
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pendingAction === "note" || noteBody.trim().length === 0}
            onClick={() => void handleNoteSubmit()}
          >
            Guardar nota
          </button>

          {detail.timeline.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Todavía no hay actividad registrada en este lead.
            </div>
          ) : (
            <div className="space-y-3">
              {detail.timeline.map((item) => (
                <article
                  key={`${item.itemType}:${item.id}`}
                  className="rounded-2xl bg-slate-50 px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={item.itemType} />
                    {item.statusLabel ? (
                      <StatusBadge value={item.statusLabel} />
                    ) : null}
                  </div>
                  <p className="mt-3 font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-slate-600">{item.description}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {item.actorLabel} · {formatDateTime(item.occurredAt)}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
