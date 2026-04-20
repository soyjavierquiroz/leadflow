"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useState } from "react";
import { SectionHeader } from "@/components/app-shell/section-header";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import {
  MemberOperationRequestError,
  memberOperationRequest,
  type MemberSponsorDashboard,
} from "@/lib/member-operations";

type ChannelAction = "connect" | "qr" | "refresh" | "reset" | null;

const POLLABLE_CONNECTION_STATUSES = new Set<
  NonNullable<MemberSponsorDashboard["connectionStatus"]>
>(["provisioning", "qr_ready", "connecting"]);

const formatQrCountdown = (remainingMs: number) => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const statusCopy: Record<
  MemberSponsorDashboard["status"],
  {
    eyebrow: string;
    title: string;
    description: string;
  }
> = {
  PROVISIONED: {
    eyebrow: "Canal en preparación",
    title: "Conecta tu WhatsApp",
    description:
      "Estamos dejando listo tu canal para generar un QR y completar el enlace desde WhatsApp.",
  },
  REGISTERED: {
    eyebrow: "QR disponible",
    title: "Conecta tu WhatsApp",
    description:
      "Tu canal ya fue registrado correctamente. Solo falta escanear el QR para dejarlo operativo.",
  },
  READY: {
    eyebrow: "Estado final",
    title: "Canal Activo y Operativo",
    description:
      "Tu WhatsApp ya está conectado y disponible para operar sin pasos adicionales en esta pantalla.",
  },
};

export function MemberChannelClient() {
  const [snapshot, setSnapshot] = useState<MemberSponsorDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [action, setAction] = useState<ChannelAction>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const loadSnapshot = useEffectEvent(
    async (options?: { preserveFeedback?: boolean; background?: boolean }) => {
      if (!options?.background) {
        setIsLoading(true);
      }

      if (!options?.preserveFeedback) {
        setFeedback(null);
      }

      try {
        const nextSnapshot = await memberOperationRequest<MemberSponsorDashboard>(
          "/messaging-integrations/me",
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
              : "No pudimos cargar el estado del canal.",
        });
      } finally {
        if (!options?.background) {
          setIsLoading(false);
        }
      }
    },
  );

  const refreshSnapshot = useEffectEvent(
    async (options?: { preserveFeedback?: boolean; background?: boolean }) => {
      if (!options?.background) {
        setIsLoading(true);
      }

      if (!options?.preserveFeedback) {
        setFeedback(null);
      }

      try {
        const nextSnapshot = await memberOperationRequest<MemberSponsorDashboard>(
          "/messaging-integrations/me/refresh",
          {
            method: "POST",
            body: JSON.stringify({}),
          },
        );

        setSnapshot(nextSnapshot);
      } catch (error) {
        if (!options?.background) {
          setFeedback({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : "No pudimos refrescar el estado del canal.",
          });
        }
      } finally {
        if (!options?.background) {
          setIsLoading(false);
        }
      }
    },
  );

  useEffect(() => {
    void loadSnapshot();
  }, []);

  useEffect(() => {
    const shouldPollSnapshot =
      Boolean(
        snapshot &&
          !snapshot.isConnected &&
          action === null &&
          snapshot.connectionStatus &&
          POLLABLE_CONNECTION_STATUSES.has(snapshot.connectionStatus),
      );

    if (!shouldPollSnapshot) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshSnapshot({
        preserveFeedback: true,
        background: true,
      });
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [action, snapshot?.connectionStatus, snapshot?.isConnected]);

  useEffect(() => {
    if (!snapshot?.qrExpiresAt || snapshot.isConnected) {
      return;
    }

    setCurrentTime(Date.now());

    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [snapshot?.isConnected, snapshot?.qrExpiresAt]);

  const submitAction = async (params: {
    action: Exclude<ChannelAction, null>;
    path: string;
    successMessage: (nextSnapshot: MemberSponsorDashboard) => string;
    recoverExpiredQr?: boolean;
  }) => {
    setAction(params.action);
    setFeedback(null);

    try {
      const nextSnapshot = await memberOperationRequest<MemberSponsorDashboard>(
        params.path,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );

      setSnapshot(nextSnapshot);
      setFeedback({
        tone: "success",
        message: params.successMessage(nextSnapshot),
      });
    } catch (error) {
      if (
        params.recoverExpiredQr &&
        error instanceof MemberOperationRequestError &&
        error.status === 410
      ) {
        try {
          const recoveredSnapshot =
            await memberOperationRequest<MemberSponsorDashboard>(
              "/messaging-integrations/me/reset",
              {
                method: "POST",
                body: JSON.stringify({}),
              },
            );

          setSnapshot(recoveredSnapshot);
          setFeedback({
            tone: "success",
            message: "El QR anterior venció. Generamos uno nuevo automáticamente.",
          });
          return;
        } catch (recoveryError) {
          setFeedback({
            tone: "error",
            message:
              recoveryError instanceof Error
                ? recoveryError.message
                : "No pudimos regenerar el QR vencido.",
          });
          return;
        }
      }

      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos completar la operación sobre el canal.",
      });
    } finally {
      setAction(null);
    }
  };

  const handlePrepareConnection = async () => {
    const shouldResetQr =
      isQrExpired ||
      snapshot?.connectionStatus === "disconnected" ||
      snapshot?.connectionStatus === "error";
    const shouldRefreshQr = !shouldResetQr && Boolean(snapshot?.qrCode);

    await submitAction({
      action: shouldResetQr ? "reset" : shouldRefreshQr ? "qr" : "connect",
      path: shouldResetQr
        ? "/messaging-integrations/me/reset"
        : shouldRefreshQr
        ? "/messaging-integrations/me/qr"
        : "/messaging-integrations/me/connect",
      successMessage: (nextSnapshot) =>
        nextSnapshot.isConnected
          ? "Tu canal ya quedó conectado correctamente."
          : shouldResetQr
            ? "Generamos un nuevo QR para volver a intentar la conexión."
            : shouldRefreshQr
            ? "Actualizamos el QR para que puedas terminar la conexión."
            : "Tu QR ya está listo para escanearlo desde WhatsApp.",
      recoverExpiredQr: true,
    });
  };

  const handleRefresh = async () => {
    await submitAction({
      action: "refresh",
      path: "/messaging-integrations/me/refresh",
      successMessage: (nextSnapshot) =>
        nextSnapshot.isConnected
          ? "Confirmamos que tu canal sigue activo y operativo."
          : "Actualizamos el estado del canal.",
    });
  };

  const handleReset = async () => {
    await submitAction({
      action: "reset",
      path: "/messaging-integrations/me/reset",
      successMessage: () =>
        "Generamos un nuevo proceso de enlace para volver a conectar tu WhatsApp.",
    });
  };

  const currentSnapshot = snapshot;
  const qrExpiresAtTimestamp =
    currentSnapshot?.qrExpiresAt !== null &&
    currentSnapshot?.qrExpiresAt !== undefined
      ? new Date(currentSnapshot.qrExpiresAt).getTime()
      : null;
  const qrExpiresAtIsValid =
    qrExpiresAtTimestamp !== null && !Number.isNaN(qrExpiresAtTimestamp);
  const qrRemainingMs = qrExpiresAtIsValid
    ? Math.max(0, qrExpiresAtTimestamp - currentTime)
    : 0;
  const isQrExpired = Boolean(
    currentSnapshot &&
      !currentSnapshot.isConnected &&
      (currentSnapshot.qrExpired ||
        (qrExpiresAtIsValid && qrRemainingMs <= 0)),
  );
  const currentCopy =
    currentSnapshot &&
    (isQrExpired || currentSnapshot.connectionStatus === "disconnected")
      ? {
          eyebrow: "QR vencido",
          title: "Genera un nuevo QR",
          description:
            "La sesión anterior venció o se desconectó antes del escaneo. Genera un QR nuevo para continuar la conexión.",
        }
      : currentSnapshot
        ? statusCopy[currentSnapshot.status]
        : statusCopy.PROVISIONED;
  const primaryActionLabel =
    action === "connect"
      ? "Generando QR..."
      : action === "qr"
        ? "Actualizando QR..."
        : action === "reset"
          ? "Generando QR nuevo..."
          : isQrExpired || currentSnapshot?.connectionStatus === "disconnected"
            ? "Generar nuevo QR"
            : currentSnapshot?.qrCode
              ? "Actualizar QR"
              : "Generar QR";

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Sponsor / Member / Canal"
        title="Mi canal de WhatsApp"
        description="Conecta tu número y revisa en una sola pantalla si tu canal ya quedó operativo."
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      {isLoading && !currentSnapshot ? (
        <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="h-[28rem] animate-pulse rounded-[2rem] border border-slate-200 bg-white" />
          <div className="h-[28rem] animate-pulse rounded-[2rem] border border-slate-200 bg-white" />
        </section>
      ) : null}

      {!isLoading && !currentSnapshot ? (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <h2 className="text-2xl font-semibold text-slate-950">
            No pudimos cargar tu canal
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Intenta refrescar esta vista para consultar nuevamente el estado
            real de tu conexión.
          </p>
          <button
            type="button"
            onClick={() => void loadSnapshot()}
            className="mt-6 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Reintentar
          </button>
        </section>
      ) : null}

      {currentSnapshot ? (
        <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {currentCopy.eyebrow}
                </p>
                <h2 className="mt-3 text-3xl font-semibold text-slate-950">
                  {currentSnapshot.sponsorName}
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  {currentCopy.description}
                </p>
              </div>

              <span
                className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                  currentSnapshot.isConnected
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {currentSnapshot.status}
              </span>
            </div>

            {currentSnapshot.isConnected ? (
              <div className="mt-8 rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-6">
                <h3 className="text-2xl font-semibold text-emerald-950">
                  Canal Activo y Operativo
                </h3>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-900/80">
                  Tu canal ya quedó enlazado. No hay advertencias de
                  configuración pendientes en esta vista.
                </p>
              </div>
            ) : (
              <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                <div className="flex justify-center rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6">
                  {currentSnapshot.qrCode && !isQrExpired ? (
                    <Image
                      src={currentSnapshot.qrCode}
                      alt="QR para conectar WhatsApp"
                      width={320}
                      height={320}
                      unoptimized
                      className="h-72 w-72 rounded-[1.5rem] border border-slate-200 bg-white p-4"
                    />
                  ) : (
                    <div className="flex h-72 w-72 items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300 bg-white px-8 text-center text-sm leading-6 text-slate-500">
                      {isQrExpired
                        ? "El QR anterior venció. Genera uno nuevo para continuar desde WhatsApp."
                        : "Genera o actualiza tu QR para conectarlo desde la app de WhatsApp."}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-2xl font-semibold text-slate-950">
                    {currentCopy.title}
                  </h3>
                  <p className="text-sm leading-6 text-slate-600">
                    {isQrExpired
                      ? "El intento anterior ya no sirve. Genera un QR nuevo y seguiremos sincronizando el estado automáticamente."
                      : currentSnapshot.qrCode
                        ? "Escanea este QR desde WhatsApp en tu teléfono para terminar el enlace."
                        : "Tu canal todavía no tiene un QR visible. Puedes generarlo desde aquí y seguiremos refrescando el estado automáticamente."}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {qrExpiresAtIsValid && !isQrExpired ? (
                      <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                        QR vence en {formatQrCountdown(qrRemainingMs)}
                      </span>
                    ) : null}

                    {isQrExpired ? (
                      <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                        QR vencido
                      </span>
                    ) : null}

                    {currentSnapshot.connectionStatus &&
                    POLLABLE_CONNECTION_STATUSES.has(
                      currentSnapshot.connectionStatus,
                    ) ? (
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                        Auto refresh 8s
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>

          <aside className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Acciones
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-slate-950">
              {currentSnapshot.isConnected
                ? "Mantener el canal al día"
                : "Terminar la conexión"}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {currentSnapshot.isConnected
                ? "Puedes refrescar el estado del canal o generar un nuevo proceso de enlace si necesitas reconectarlo."
                : "Genera el QR, escanéalo desde tu teléfono y actualiza el estado para confirmar cuando el canal quede listo."}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {!currentSnapshot.isConnected ? (
                <button
                  type="button"
                  disabled={action !== null || isLoading}
                  onClick={handlePrepareConnection}
                  className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {primaryActionLabel}
                </button>
              ) : null}

              <button
                type="button"
                disabled={action !== null || isLoading}
                onClick={handleRefresh}
                className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {action === "refresh" ? "Actualizando..." : "Actualizar estado"}
              </button>

              {currentSnapshot.isConnected ? (
                <button
                  type="button"
                  disabled={action !== null || isLoading}
                  onClick={handleReset}
                  className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {action === "reset" ? "Preparando..." : "Reconectar canal"}
                </button>
              ) : null}
            </div>

            <div className="mt-8 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-950">
                Estado actual
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {currentSnapshot.isConnected
                  ? "El canal ya está confirmado como listo."
                  : isQrExpired
                    ? "El QR anterior expiró. Genera uno nuevo para retomar la conexión."
                    : currentSnapshot.qrCode
                    ? "El siguiente paso es escanear el QR para completar la conexión."
                    : "El siguiente paso es generar el QR para iniciar la conexión."}
              </p>
            </div>
          </aside>
        </section>
      ) : null}
    </div>
  );
}
