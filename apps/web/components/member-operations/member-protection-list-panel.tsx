"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { DataTable } from "@/components/app-shell/data-table";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { formatDateTime } from "@/lib/app-shell/utils";
import { validateKurukinPhone } from "@/lib/kurukin-blacklist";
import {
  memberOperationRequest,
  type MemberProtectionListSnapshot,
} from "@/lib/member-operations";

export function MemberProtectionListPanel() {
  const [snapshot, setSnapshot] = useState<MemberProtectionListSnapshot | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [blockedPhone, setBlockedPhone] = useState("");
  const [reason, setReason] = useState("manual_member_blacklist");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const loadSnapshot = useEffectEvent(async () => {
    setLoading(true);

    try {
      const nextSnapshot =
        await memberOperationRequest<MemberProtectionListSnapshot>(
          "/kurukin-blacklist/me",
          {
            method: "GET",
          },
        );

      setSnapshot(nextSnapshot);
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos cargar la lista de protección.",
      });
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void loadSnapshot();
  }, []);

  const handleAdd = async () => {
    const validation = validateKurukinPhone(blockedPhone);

    if (!validation.ok) {
      setFeedback({
        tone: "error",
        message: validation.error,
      });
      return;
    }

    setAdding(true);
    setFeedback(null);

    try {
      await memberOperationRequest("/kurukin-blacklist/me", {
        method: "POST",
        body: JSON.stringify({
          blockedPhone: validation.value,
          reason: reason.trim() || "manual_member_blacklist",
        }),
      });

      setBlockedPhone("");
      await loadSnapshot();
      setFeedback({
        tone: "success",
        message: "Número añadido a la lista de protección.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos añadir el número al blacklist.",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (input: {
    blockedPhone: string;
    entryId: string | null;
  }) => {
    const operationKey = input.entryId ?? input.blockedPhone;

    setRemovingKey(operationKey);
    setFeedback(null);

    try {
      await memberOperationRequest("/kurukin-blacklist/me", {
        method: "DELETE",
        body: JSON.stringify({
          entryId: input.entryId,
          blockedPhone: input.blockedPhone,
        }),
      });

      await loadSnapshot();
      setFeedback({
        tone: "success",
        message: "Bloqueo eliminado correctamente.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos eliminar el bloqueo.",
      });
    } finally {
      setRemovingKey(null);
    }
  };

  const advisorPhone = snapshot?.ownerPhone ?? null;
  const title = advisorPhone
    ? `Gestiona tus bloqueos personales para ${advisorPhone}`
    : "Gestiona tus bloqueos personales para tu asesor";
  const description = advisorPhone
    ? "Leadflow escribe y administra tu blacklist personal en Kurukin Hub usando la identidad del asesor por número, no por instancia."
    : loading
      ? "Estamos cargando el número del asesor para personalizar esta lista."
      : "Cuando el número del asesor esté configurado, verás aquí una gestión personalizada de la lista de protección.";

  return (
    <section className="space-y-5 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Lista de Protección
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">
            {title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
            {description}
          </p>
        </div>

        {snapshot ? (
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
            <p className="text-slate-500">Número del asesor</p>
            <p className="mt-1 font-semibold text-slate-950">
              {snapshot.ownerPhone}
            </p>
          </div>
        ) : null}
      </div>

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <div className="grid gap-4 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 md:grid-cols-[1.3fr_1.2fr_auto]">
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">
            Número a proteger
          </span>
          <input
            value={blockedPhone}
            onChange={(event) => setBlockedPhone(event.target.value)}
            placeholder="Ej. 525551234567"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
          />
          <p className="text-xs leading-5 text-slate-500">
            Se eliminan automáticamente `+`, espacios, guiones y paréntesis.
          </p>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Motivo</span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="manual_member_blacklist"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
          />
        </label>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={adding || loading}
            className="w-full rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {adding ? "Añadiendo..." : "Añadir a blacklist"}
          </button>
        </div>
      </div>

      {loading && !snapshot ? (
        <div className="h-40 animate-pulse rounded-[1.75rem] border border-slate-200 bg-slate-50" />
      ) : null}

      {snapshot ? (
        <DataTable
          columns={[
            {
              key: "blockedPhone",
              header: "Número bloqueado",
              render: (row) => (
                <div>
                  <p className="font-semibold text-slate-950">
                    {row.blockedPhone}
                  </p>
                  <p className="text-xs text-slate-500">
                    {row.label ?? "opt-out"} · {row.scope ?? "personal"}
                  </p>
                </div>
              ),
            },
            {
              key: "reason",
              header: "Motivo",
              render: (row) => row.reason ?? "Sin motivo explícito",
            },
            {
              key: "createdAt",
              header: "Registrado",
              render: (row) =>
                row.createdAt ? formatDateTime(row.createdAt) : "Sin fecha",
            },
            {
              key: "actions",
              header: "Acción",
              render: (row) => (
                <button
                  type="button"
                  onClick={() =>
                    void handleRemove({
                      blockedPhone: row.blockedPhone,
                      entryId: row.id,
                    })
                  }
                  disabled={removingKey === (row.id ?? row.blockedPhone)}
                  className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {removingKey === (row.id ?? row.blockedPhone)
                    ? "Eliminando..."
                    : "Eliminar bloqueo"}
                </button>
              ),
            },
          ]}
          rows={snapshot.items}
          emptyTitle="Sin bloqueos registrados"
          emptyDescription="Cuando añadas números aquí o registres bajas desde la ficha del lead, aparecerán en esta lista."
        />
      ) : null}
    </section>
  );
}
