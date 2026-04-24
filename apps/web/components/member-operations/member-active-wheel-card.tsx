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
      ? "border-app-success-border bg-[linear-gradient(180deg,var(--app-success-bg)_0%,var(--app-surface-strong)_100%)]"
      : "border-app-warning-border bg-[linear-gradient(180deg,var(--app-warning-bg)_0%,var(--app-surface-strong)_100%)]"
    : "border-app-border bg-[linear-gradient(180deg,var(--app-surface)_0%,var(--app-surface-strong)_100%)]";

  return (
    <aside
      className={`rounded-[1.35rem] border p-4 shadow-[0_18px_45px_rgba(2,6,23,0.24)] ${toneClassName}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-app-text-soft">
            Rueda Publicitaria
          </p>
          <p className="mt-1 text-sm text-app-text-muted">
            Espacio rápido para entrar al round activo sin salir del dashboard.
          </p>
        </div>
        <span className="rounded-full border border-app-border bg-app-surface-muted px-3 py-1 text-xs font-medium text-app-text-soft">
          Acción rápida
        </span>
      </div>

      {isLoading && !snapshot ? (
        <div className="mt-4 space-y-3">
          <div className="h-5 w-36 animate-pulse rounded-full bg-app-border" />
          <div className="h-24 animate-pulse rounded-[1.25rem] bg-app-surface-muted" />
        </div>
      ) : null}

      {!isLoading && !snapshot?.wheel ? (
        <div className="mt-4 rounded-[1rem] border border-app-border bg-app-surface-muted p-4">
          <h2 className="text-base font-semibold text-app-text">
            No hay campañas activas
          </h2>
          <p className="mt-2 text-sm leading-6 text-app-text-muted">
            Cuando el team abra una rueda nueva, aquí verás el buy-in para
            entrar de inmediato.
          </p>
        </div>
      ) : null}

      {snapshot?.wheel ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-[1rem] border border-app-border bg-app-surface-muted p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-app-text">
                {snapshot.wheel.name}
              </h2>
              <span
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  snapshot.isParticipating
                    ? "border-app-success-border bg-app-success-bg text-app-success-text"
                    : "border-app-warning-border bg-app-warning-bg text-app-warning-text"
                }`}
              >
                {snapshot.isParticipating ? "Adentro" : "Disponible"}
              </span>
            </div>

            <p className="mt-2 text-sm text-app-text-muted">
              Ventana activa hasta {formatDateTime(snapshot.wheel.endDate)}.
            </p>
          </div>

          {snapshot.isParticipating ? (
            <div className="rounded-[1rem] border border-app-success-border bg-app-success-bg p-4">
              <p className="text-sm font-semibold text-app-success-text">
                Ya estás en la rueda actual
              </p>
              <p className="mt-2 text-sm leading-6 text-app-text-muted">
                Tu asiento quedó confirmado y el round robin ya puede
                considerarte.
              </p>
            </div>
          ) : (
            <div className="rounded-[1rem] border border-app-warning-border bg-app-surface-muted p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-soft">
                Buy-In Disponible
              </p>
              <p className="mt-2 text-xl font-semibold tracking-tight text-app-text">
                {formatAdWheelSeatPrice(snapshot.wheel.seatPrice)}
              </p>
              <p className="mt-2 text-sm leading-6 text-app-text-muted">
                Compra tu asiento para entrar a la rueda activa desde esta
                misma vista.
              </p>
              <button
                type="button"
                onClick={handleJoin}
                disabled={isJoining}
                className="mt-4 rounded-full bg-app-text px-4 py-2 text-sm font-semibold text-app-bg transition hover:opacity-92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
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
