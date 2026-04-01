"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { OperationBanner } from "@/components/team-operations/operation-banner";
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
      ? "border-emerald-200 bg-[linear-gradient(180deg,_#ecfdf5_0%,_#ffffff_100%)]"
      : "border-amber-200 bg-[linear-gradient(180deg,_#fff7ed_0%,_#ffffff_100%)]"
    : "border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)]";

  return (
    <aside
      className={`rounded-[2rem] border p-6 shadow-[0_20px_55px_rgba(15,23,42,0.06)] ${toneClassName}`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
        Rueda Publicitaria Actual
      </p>

      {isLoading && !snapshot ? (
        <div className="mt-4 space-y-3">
          <div className="h-7 w-3/4 animate-pulse rounded-full bg-slate-200" />
          <div className="h-20 animate-pulse rounded-[1.5rem] bg-slate-100" />
        </div>
      ) : null}

      {!isLoading && !snapshot?.wheel ? (
        <div className="mt-4">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            No hay campañas activas en este momento
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Cuando el team abra una nueva rueda, aquí verás el buy-in
            disponible para entrar.
          </p>
        </div>
      ) : null}

      {snapshot?.wheel ? (
        <div className="mt-4">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            {snapshot.wheel.name}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Ventana activa hasta {formatDateTime(snapshot.wheel.endDate)}.
          </p>

          {snapshot.isParticipating ? (
            <div className="mt-5 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">
                ¡Estás en la Rueda! Esperando leads...
              </p>
              <p className="mt-2 text-sm leading-6 text-emerald-700">
                Tu asiento ya quedó confirmado dentro de la campaña activa.
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-[1.5rem] border border-amber-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Buy-In Disponible
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                {formatAdWheelSeatPrice(snapshot.wheel.seatPrice)}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Compra tu asiento para entrar al round robin condicional de la
                rueda actual.
              </p>
              <button
                type="button"
                onClick={handleJoin}
                disabled={isJoining}
                className="mt-5 rounded-full bg-[linear-gradient(135deg,_#f97316_0%,_#dc2626_100%)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_35px_rgba(249,115,22,0.28)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isJoining ? "Procesando..." : "Comprar Asiento"}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {feedback ? (
        <div className="mt-5">
          <OperationBanner tone={feedback.tone} message={feedback.message} />
        </div>
      ) : null}
    </aside>
  );
}
