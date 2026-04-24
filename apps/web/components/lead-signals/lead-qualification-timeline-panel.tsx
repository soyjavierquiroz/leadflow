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
  const surfaceCardClassName =
    "rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 text-sm";
  const panelClassName =
    "space-y-4 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4";
  const fieldClassName =
    "w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] px-4 py-2.5 text-sm text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-text-soft)] focus:border-[var(--app-border-strong)] focus:ring-2 focus:ring-[var(--app-accent-soft)]";
  const textAreaClassName =
    "w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] px-4 py-3 text-sm text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-text-soft)] focus:border-[var(--app-border-strong)] focus:ring-2 focus:ring-[var(--app-accent-soft)]";
  const primaryButtonClassName =
    "rounded-full bg-[var(--app-text)] px-4 py-2 text-sm font-semibold text-[var(--app-bg)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
  const secondaryButtonClassName =
    "rounded-full border border-[var(--app-border)] bg-[var(--app-card)] px-4 py-2 text-sm font-semibold text-[var(--app-text)] transition hover:border-[var(--app-border-strong)] hover:bg-[var(--app-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60";
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
      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] p-4 text-sm text-[var(--app-muted)]">
        Cargando resumen operativo y timeline del lead...
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="rounded-2xl border border-[var(--app-danger-border)] bg-[var(--app-danger-soft)] p-4 text-sm text-[var(--app-danger)]">
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
        <div className={surfaceCardClassName}>
          <p className="text-[var(--app-text-soft)]">Calificación</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge value={detail.lead.status} />
            <StatusBadge
              value={detail.lead.assignmentStatus ?? "sin_assignment"}
            />
            {detail.lead.qualificationGrade ? (
              <StatusBadge value={detail.lead.qualificationGrade} />
            ) : null}
          </div>
          <p className="mt-3 text-[var(--app-muted)]">
            {detail.lead.summaryText ??
              "Todavía no hay resumen operativo manual."}
          </p>
        </div>

        <div className={surfaceCardClassName}>
          <p className="text-[var(--app-text-soft)]">Siguiente acción</p>
          <p className="mt-2 font-medium text-[var(--app-text)]">
            {detail.workflow.effectiveNextAction}
          </p>
          <p className="mt-1 text-[var(--app-muted)]">
            {detail.workflow.reminder.label} ·{" "}
            {formatMaybeDate(detail.lead.followUpAt, "Sin follow-up agendado")}
          </p>
        </div>

        <div className={surfaceCardClassName}>
          <p className="text-[var(--app-text-soft)]">Último contacto</p>
          <p className="mt-2 font-medium text-[var(--app-text)]">
            {formatMaybeDate(
              detail.lead.lastContactedAt,
              "Todavía sin contacto registrado",
            )}
          </p>
          <p className="mt-1 text-[var(--app-muted)]">
            Sponsor: {detail.lead.sponsorName ?? "Pendiente"}
          </p>
        </div>

        <div className={surfaceCardClassName}>
          <p className="text-[var(--app-text-soft)]">Última calificación</p>
          <p className="mt-2 font-medium text-[var(--app-text)]">
            {formatMaybeDate(
              detail.lead.lastQualifiedAt,
              "Sin señal o actualización manual",
            )}
          </p>
          <p className="mt-1 text-[var(--app-muted)]">
            Team: {detail.lead.teamName ?? "Sin team"}
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className={panelClassName}>
          <div className="rounded-2xl border border-[var(--app-success-border)] bg-[var(--app-success-soft)] p-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={detail.workflow.reminder.bucket} />
              <StatusBadge value={detail.workflow.playbook.key} />
            </div>
            <p className="mt-3 font-semibold text-[var(--app-text)]">
              {detail.workflow.playbook.title}
            </p>
            <p className="mt-1 text-[var(--app-muted)]">
              {detail.workflow.playbook.description}
            </p>
            <ul className="mt-3 space-y-2 text-[var(--app-muted)]">
              {detail.workflow.playbook.checklist.map((item) => (
                <li key={item}>- {item}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-[var(--app-text)]">
              Calificación rápida
            </p>
            <p className="text-xs text-[var(--app-text-soft)]">
              Resumen corto, temperatura comercial y siguiente movimiento.
            </p>
          </div>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--app-text)]">Temperatura</span>
            <select
              value={qualificationGrade}
              onChange={(event) =>
                setQualificationGrade(
                  event.target.value as LeadQualificationGrade | "none",
                )
              }
              className={fieldClassName}
            >
              {qualificationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--app-text)]">
              Resumen operativo
            </span>
            <textarea
              value={summaryText}
              onChange={(event) => setSummaryText(event.target.value)}
              rows={4}
              placeholder="Qué sabemos del lead y por qué vale la pena seguirlo."
              className={textAreaClassName}
            />
          </label>

          <button
            type="button"
            className={primaryButtonClassName}
            disabled={pendingAction === "qualification"}
            onClick={() => void handleQualificationSubmit()}
          >
            Guardar calificación
          </button>

          <div className="h-px bg-[var(--app-border)]" />

          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--app-text)]">Siguiente acción</span>
            <input
              value={nextActionLabel}
              onChange={(event) => setNextActionLabel(event.target.value)}
              placeholder="Ej. enviar voice note o reagendar llamada"
              className={fieldClassName}
            />
          </label>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--app-text)]">Follow-up</span>
            <input
              type="datetime-local"
              value={followUpAt}
              onChange={(event) => setFollowUpAt(event.target.value)}
              className={fieldClassName}
            />
          </label>

          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={pendingAction === "followUp"}
            onClick={() => void handleFollowUpSubmit()}
          >
            Guardar seguimiento
          </button>
        </div>

        <div className={panelClassName}>
          <div>
            <p className="text-sm font-semibold text-[var(--app-text)]">
              Timeline del lead
            </p>
            <p className="text-xs text-[var(--app-text-soft)]">
              Notas internas y eventos operativos del gateway en una sola vista.
            </p>
          </div>

          <label className="space-y-2 text-sm">
            <span className="font-medium text-[var(--app-text)]">Agregar nota</span>
            <textarea
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
              rows={3}
              placeholder="Ej. respondió que revisa la propuesta mañana a las 9."
              className={textAreaClassName}
            />
          </label>

          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={pendingAction === "note" || noteBody.trim().length === 0}
            onClick={() => void handleNoteSubmit()}
          >
            Guardar nota
          </button>

          {detail.timeline.length === 0 ? (
            <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] px-4 py-3 text-sm text-[var(--app-muted)]">
              Todavía no hay actividad registrada en este lead.
            </div>
          ) : (
            <div className="space-y-3">
              {detail.timeline.map((item) => (
                <article
                  key={`${item.itemType}:${item.id}`}
                  className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] px-4 py-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={item.itemType} />
                    {item.statusLabel ? (
                      <StatusBadge value={item.statusLabel} />
                    ) : null}
                  </div>
                  <p className="mt-3 font-semibold text-[var(--app-text)]">
                    {item.title}
                  </p>
                  <p className="mt-1 text-[var(--app-muted)]">{item.description}</p>
                  <p className="mt-2 text-xs text-[var(--app-text-soft)]">
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
