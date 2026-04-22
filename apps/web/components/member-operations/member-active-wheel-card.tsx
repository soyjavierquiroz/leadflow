"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { MemberInlineBanner } from "@/components/member-operations/member-inline-banner";
import {
  formatAdWheelSeatPrice,
  type MemberActiveAdWheelSnapshot,
} from "@/lib/ad-wheels";
import { formatDateTime } from "@/lib/app-shell/utils";
import {
  MemberOperationRequestError,
  memberOperationRequest,
} from "@/lib/member-operations";

export function MemberActiveWheelCard() {
  const [snapshot, setSnapshot] = useState<MemberActiveAdWheelSnapshot | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const loadSnapshot = useEffectEvent(
    async (options?: { preserveFeedback?: boolean }) => {
      setIsLoading(true);

      if (!options?.preserveFeedback) {
        setFeedback(null);
      }

      try {
        const nextSnapshot =
          await memberOperationRequest<MemberActiveAdWheelSnapshot>(
            "/sponsors/me/wheels/active",
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
              : "No pudimos consultar la rueda activa.",
        });
      } finally {
        setIsLoading(false);
      }
    },
  );

  useEffect(() => {
    void loadSnapshot();
  }, []);

  const handleJoin = async () => {
    const currentWheel = snapshot?.wheel;

    if (!currentWheel || snapshot?.isParticipating) {
      return;
    }

    const previousSnapshot = snapshot;

    setIsJoining(true);
    setFeedback(null);
    setSnapshot((current) =>
      current && current.wheel
        ? {
            ...current,
            isParticipating: true,
          }
        : current,
    );

    try {
      await memberOperationRequest(`/sponsors/me/wheels/${currentWheel.id}/join`, {
        method: "POST",
      });

      setFeedback({
        tone: "success",
        message: "Tu asiento quedó comprado. Ya entraste a la rueda actual.",
      });
    } catch (error) {
      setSnapshot(previousSnapshot);
      setFeedback({
        tone: "error",
        message:
          error instanceof MemberOperationRequestError && error.status === 402
            ? "Saldo insuficiente en tu Billetera. Recarga para participar."
            : error instanceof Error
              ? error.message
              : "No pudimos completar tu buy-in en esta rueda.",
      });
    } finally {
      setIsJoining(false);
    }
  };

  const toneClassName = snapshot?.wheel
    ? snapshot.isParticipating
      ? "border-emerald-500/20 bg-[linear-gradient(180deg,_rgba(6,78,59,0.34)_0%,_rgba(2,6,23,0.98)_100%)]"
      : "border-amber-500/20 bg-[linear-gradient(180deg,_rgba(120,53,15,0.24)_0%,_rgba(2,6,23,0.98)_100%)]"
    : "border-slate-800 bg-[linear-gradient(180deg,_rgba(15,23,42,0.98)_0%,_rgba(2,6,23,0.96)_100%)]";

  return (
    <aside
      className={`rounded-[1.6rem] border p-4 shadow-[0_18px_45px_rgba(2,6,23,0.28)] ${toneClassName}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Rueda Publicitaria
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Espacio rápido para entrar al round activo sin salir del dashboard.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1 text-xs font-medium text-slate-300">
          CTA compacto
        </span>
      </div>

      {isLoading && !snapshot ? (
        <div className="mt-4 space-y-3">
          <div className="h-5 w-36 animate-pulse rounded-full bg-slate-800" />
          <div className="h-24 animate-pulse rounded-[1.25rem] bg-slate-900" />
        </div>
      ) : null}

      {!isLoading && !snapshot?.wheel ? (
        <div className="mt-4 rounded-[1.25rem] border border-slate-800 bg-slate-950/70 p-4">
          <h2 className="text-lg font-semibold text-white">
            No hay campañas activas
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Cuando el team abra una rueda nueva, aquí verás el buy-in para
            entrar de inmediato.
          </p>
        </div>
      ) : null}

      {snapshot?.wheel ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-[1.25rem] border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">
                {snapshot.wheel.name}
              </h2>
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  snapshot.isParticipating
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                    : "border-amber-500/20 bg-amber-500/10 text-amber-100"
                }`}
              >
                {snapshot.isParticipating ? "Adentro" : "Disponible"}
              </span>
            </div>

            <p className="mt-2 text-sm text-slate-400">
              Ventana activa hasta {formatDateTime(snapshot.wheel.endDate)}.
            </p>
          </div>

          {snapshot.isParticipating ? (
            <div className="rounded-[1.25rem] border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-sm font-semibold text-emerald-100">
                Ya estás en la rueda actual
              </p>
              <p className="mt-2 text-sm leading-6 text-emerald-50/85">
                Tu asiento quedó confirmado y el round robin ya puede
                considerarte.
              </p>
            </div>
          ) : (
            <div className="rounded-[1.25rem] border border-amber-500/20 bg-slate-950/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Buy-In Disponible
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {formatAdWheelSeatPrice(snapshot.wheel.seatPrice)}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Compra tu asiento para entrar a la rueda activa desde esta
                misma vista.
              </p>
              <button
                type="button"
                onClick={handleJoin}
                disabled={isJoining}
                className="mt-4 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isJoining ? "Procesando..." : "Comprar Asiento"}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {feedback ? (
        <div className="mt-4">
          <MemberInlineBanner tone={feedback.tone} message={feedback.message} />
        </div>
      ) : null}
    </aside>
  );
}
