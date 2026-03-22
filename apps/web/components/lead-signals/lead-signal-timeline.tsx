"use client";

import { StatusBadge } from "@/components/app-shell/status-badge";
import type { LeadConversationSignal } from "@/lib/conversation-signals";
import { formatDateTime } from "@/lib/app-shell/utils";

type LeadSignalTimelineProps = {
  signals: LeadConversationSignal[];
  loading: boolean;
  error: string | null;
  emptyDescription: string;
};

const signalTypeLabel: Record<LeadConversationSignal["signalType"], string> = {
  conversation_started: "Conversación iniciada",
  message_inbound: "Mensaje inbound",
  message_outbound: "Mensaje outbound",
  lead_contacted: "Lead contactado",
  lead_qualified: "Lead calificado",
  lead_follow_up: "Follow-up",
  lead_won: "Lead ganado",
  lead_lost: "Lead perdido",
};

const sourceLabel: Record<LeadConversationSignal["source"], string> = {
  n8n: "n8n",
  evolution: "Evolution",
};

const buildSignalSummary = (signal: LeadConversationSignal) => {
  const parts = [
    signal.leadStatusAfter ? `Lead -> ${signal.leadStatusAfter}` : null,
    signal.assignmentStatusAfter
      ? `Assignment -> ${signal.assignmentStatusAfter}`
      : null,
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" · ");
  }

  if (signal.processingStatus === "ignored") {
    return "Se persistió la señal, pero no impactó estado operativo.";
  }

  if (signal.processingStatus === "failed") {
    return signal.errorMessage ?? "La señal falló durante el procesamiento.";
  }

  return "La señal quedó registrada para trazabilidad operativa.";
};

export function LeadSignalTimeline({
  signals,
  loading,
  error,
  emptyDescription,
}: LeadSignalTimelineProps) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Señales de conversación
          </p>
          <p className="text-xs text-slate-500">
            Historial ligero de automation y mensajería, sin abrir todavía un
            inbox.
          </p>
        </div>
        {loading ? (
          <span className="text-xs font-medium text-slate-500">
            Cargando...
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {!loading && signals.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {emptyDescription}
        </div>
      ) : null}

      {signals.length > 0 ? (
        <div className="space-y-3">
          {signals.map((signal) => (
            <article
              key={signal.id}
              className="rounded-2xl bg-slate-50 px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={signal.signalType} />
                <StatusBadge value={signal.processingStatus} />
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  {sourceLabel[signal.source]}
                </span>
              </div>
              <p className="mt-3 font-semibold text-slate-950">
                {signalTypeLabel[signal.signalType]}
              </p>
              <p className="mt-1 text-slate-600">{buildSignalSummary(signal)}</p>
              <p className="mt-2 text-xs text-slate-500">
                {formatDateTime(signal.occurredAt)}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
