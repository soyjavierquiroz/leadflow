"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useState } from "react";
import { SectionHeader } from "@/components/app-shell/section-header";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import {
  memberOperationRequest,
  type MemberSponsorDashboard,
} from "@/lib/member-operations";

type ChannelAction = "connect" | "qr" | "refresh" | "reset" | null;

const POLLABLE_STATUSES = new Set<MemberSponsorDashboard["status"]>([
  "PROVISIONED",
  "REGISTERED",
]);

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

  useEffect(() => {
    void loadSnapshot();
  }, []);

  useEffect(() => {
    if (!snapshot || snapshot.isConnected || !POLLABLE_STATUSES.has(snapshot.status)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadSnapshot({
        preserveFeedback: true,
        background: true,
      });
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [snapshot]);

  const submitAction = async (params: {
    action: Exclude<ChannelAction, null>;
    path: string;
    successMessage: (nextSnapshot: MemberSponsorDashboard) => string;
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
    const shouldRefreshQr = Boolean(snapshot?.qrCode);

    await submitAction({
      action: shouldRefreshQr ? "qr" : "connect",
      path: shouldRefreshQr
        ? "/messaging-integrations/me/qr"
        : "/messaging-integrations/me/connect",
      successMessage: (nextSnapshot) =>
        nextSnapshot.isConnected
          ? "Tu canal ya quedó conectado correctamente."
          : shouldRefreshQr
            ? "Actualizamos el QR para que puedas terminar la conexión."
            : "Tu QR ya está listo para escanearlo desde WhatsApp.",
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
  const currentCopy = currentSnapshot
    ? statusCopy[currentSnapshot.status]
    : statusCopy.PROVISIONED;

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
                  {currentSnapshot.qrCode ? (
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
                      Genera o actualiza tu QR para conectarlo desde la app de
                      WhatsApp.
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-2xl font-semibold text-slate-950">
                    Conecta tu WhatsApp
                  </h3>
                  <p className="text-sm leading-6 text-slate-600">
                    {currentSnapshot.qrCode
                      ? "Escanea este QR desde WhatsApp en tu teléfono para terminar el enlace."
                      : "Tu canal todavía no tiene un QR visible. Puedes generarlo desde aquí y seguiremos refrescando el estado automáticamente."}
                  </p>
                  {POLLABLE_STATUSES.has(currentSnapshot.status) ? (
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                      Auto refresh 8s
                    </span>
                  ) : null}
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
                  {action === "connect"
                    ? "Generando QR..."
                    : action === "qr"
                      ? "Actualizando QR..."
                      : currentSnapshot.qrCode
                        ? "Actualizar QR"
                        : "Generar QR"}
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
