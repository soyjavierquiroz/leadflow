"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useState } from "react";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import type { SponsorRecord } from "@/lib/app-shell/types";
import {
  memberOperationRequest,
  type MemberMessagingSnapshot,
} from "@/lib/member-operations";

type MemberChannelClientProps = {
  sponsor: SponsorRecord;
};

type ChannelAction =
  | "connect"
  | "qr"
  | "refresh"
  | "reset"
  | "disconnect"
  | null;

const POLLABLE_STATUSES = new Set(["provisioning", "qr_ready", "connecting"]);

const formatDateTime = (value: string | null) => {
  if (!value) {
    return "Sin dato";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const channelStatusLabel: Record<
  NonNullable<MemberMessagingSnapshot["connection"]>["status"],
  string
> = {
  disconnected: "Desconectado",
  provisioning: "Provisionando",
  qr_ready: "QR listo",
  connecting: "Conectando",
  connected: "Conectado",
  error: "Con error",
};

const routingModeLabel: Record<
  MemberMessagingSnapshot["provider"]["routingMode"],
  string
> = {
  internal: "Interna",
  public: "Pública",
  unconfigured: "Sin configurar",
};

export function MemberChannelClient({ sponsor }: MemberChannelClientProps) {
  const [snapshot, setSnapshot] = useState<MemberMessagingSnapshot | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [action, setAction] = useState<ChannelAction>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [formState, setFormState] = useState({
    phone: sponsor.phone ?? "",
    automationWebhookUrl: "",
  });

  const loadSnapshot = useEffectEvent(
    async (options?: { preserveFeedback?: boolean; background?: boolean }) => {
      if (!options?.background) {
        setIsLoading(true);
      }

      if (!options?.preserveFeedback) {
        setFeedback(null);
      }

      try {
        const nextSnapshot =
          await memberOperationRequest<MemberMessagingSnapshot>(
            "/messaging-integrations/me",
            {
              method: "GET",
            },
          );

        setSnapshot(nextSnapshot);
        setFormState((current) => ({
          phone:
            nextSnapshot.connection?.phone ?? sponsor.phone ?? current.phone,
          automationWebhookUrl:
            nextSnapshot.connection?.automationWebhookUrl ??
            current.automationWebhookUrl,
        }));
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

  const currentStatus = snapshot?.connection?.status ?? null;

  useEffect(() => {
    if (!currentStatus || !POLLABLE_STATUSES.has(currentStatus)) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadSnapshot({
        preserveFeedback: true,
        background: true,
      });
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [currentStatus]);

  const submitAction = async (params: {
    action: Exclude<ChannelAction, null>;
    path: string;
    body?: Record<string, unknown>;
    successMessage: (nextSnapshot: MemberMessagingSnapshot) => string;
  }) => {
    setAction(params.action);
    setFeedback(null);

    try {
      const nextSnapshot =
        await memberOperationRequest<MemberMessagingSnapshot>(params.path, {
          method: "POST",
          body: JSON.stringify(params.body ?? {}),
        });

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

  const handleConnect = async () => {
    await submitAction({
      action: "connect",
      path: "/messaging-integrations/me/connect",
      body: {
        phone: formState.phone || null,
        automationWebhookUrl: formState.automationWebhookUrl || null,
      },
      successMessage: (nextSnapshot) =>
        nextSnapshot.connection?.status === "connected"
          ? "Canal conectado correctamente."
          : "Instancia lista. Escanea el QR o usa el pairing code para completar la conexión.",
    });
  };

  const handleQrRefresh = async () => {
    await submitAction({
      action: "qr",
      path: "/messaging-integrations/me/qr",
      body: {
        phone: formState.phone || null,
        automationWebhookUrl: formState.automationWebhookUrl || null,
      },
      successMessage: (nextSnapshot) =>
        nextSnapshot.connection?.status === "qr_ready"
          ? "QR actualizado correctamente."
          : "El canal ya no requiere un QR nuevo en este momento.",
    });
  };

  const handleRefresh = async () => {
    await submitAction({
      action: "refresh",
      path: "/messaging-integrations/me/refresh",
      successMessage: () => "Estado del canal actualizado.",
    });
  };

  const handleReset = async () => {
    await submitAction({
      action: "reset",
      path: "/messaging-integrations/me/reset",
      body: {
        phone: formState.phone || null,
        automationWebhookUrl: formState.automationWebhookUrl || null,
      },
      successMessage: () =>
        "La instancia fue reseteada y quedó lista para reconectar por QR.",
    });
  };

  const handleDisconnect = async () => {
    await submitAction({
      action: "disconnect",
      path: "/messaging-integrations/me/disconnect",
      successMessage: () =>
        "Canal desactivado. Reveal & Handoff sigue funcionando con wa.me.",
    });
  };

  const connection = snapshot?.connection ?? null;
  const provider = snapshot?.provider ?? null;
  const isPolling = currentStatus
    ? POLLABLE_STATUSES.has(currentStatus)
    : false;

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Sponsor / Member / Canal"
        title="Evolution QR Connect"
        description="El member administra su WhatsApp real desde Leadflow Web, mientras Leadflow API habla con Evolution por backend. El handoff público actual sigue cayendo a wa.me como fallback comercial."
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Estado del canal"
          value={
            connection ? channelStatusLabel[connection.status] : "Sin conectar"
          }
          hint="Persistido por sponsor y sincronizado con Evolution cuando el provider está disponible."
        />
        <KpiCard
          label="Routing Evolution"
          value={
            provider ? routingModeLabel[provider.routingMode] : "Pendiente"
          }
          hint="La ruta principal debe ser interna; la URL pública solo queda como respaldo."
        />
        <KpiCard
          label="Instance ID"
          value={connection?.instanceId ?? "Se generará al conectar"}
          hint="Identificador estable y reproducible por sponsor/member."
        />
        <KpiCard
          label="Fallback actual"
          value={provider?.fallbackWaMeEnabled ? "wa.me activo" : "Desactivado"}
          hint="Reveal & Handoff no se rompe aunque la conexión real todavía no exista."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                Estado actual
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                {sponsor.displayName}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                El canal pertenece a tu sponsor y su lifecycle se resuelve
                siempre desde backend. Nunca exponemos Evolution directamente al
                navegador.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <StatusBadge value={connection?.status ?? "disconnected"} />
              <StatusBadge value={sponsor.availabilityStatus} />
            </div>
          </div>

          <dl className="grid gap-4 text-sm md:grid-cols-2">
            <div>
              <dt className="text-slate-500">Instance ID</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {connection?.instanceId ?? "Se generará al conectar"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Webhook event</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {provider?.webhookEvent ?? "messages.upsert"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Último sync</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {formatDateTime(connection?.lastSyncedAt ?? null)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Última conexión</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {formatDateTime(connection?.lastConnectedAt ?? null)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Número normalizado</dt>
              <dd className="mt-1 font-medium text-slate-900">
                {connection?.normalizedPhone ?? "Pendiente"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Webhook</dt>
              <dd className="mt-1 break-all font-medium text-slate-900">
                {connection?.automationWebhookUrl ?? "Pendiente"}
              </dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-slate-500">Nota del provider</dt>
              <dd className="mt-1 leading-6 text-slate-800">
                {provider?.note ??
                  "Evolution configurado. Puedes conectar, pedir QR, refrescar y resetear tu instancia individual."}
              </dd>
            </div>
            {connection?.lastErrorMessage ? (
              <div className="md:col-span-2">
                <dt className="text-slate-500">Último error</dt>
                <dd className="mt-1 leading-6 text-rose-700">
                  {connection.lastErrorMessage}
                </dd>
              </div>
            ) : null}
          </dl>

          {connection?.qrCodeData || connection?.pairingCode ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <div className="flex flex-col gap-5 md:flex-row md:items-center">
                {connection.qrCodeData ? (
                  <Image
                    src={connection.qrCodeData}
                    alt="QR para conectar WhatsApp"
                    width={176}
                    height={176}
                    unoptimized
                    className="h-44 w-44 rounded-3xl border border-slate-200 bg-white p-3"
                  />
                ) : null}

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-950">
                    QR disponible
                  </h3>
                  <p className="text-sm leading-6 text-slate-600">
                    Escanea este QR desde WhatsApp. Si Evolution devuelve un
                    código de pairing, también lo dejamos visible aquí.
                  </p>
                  <p className="text-sm font-medium text-slate-900">
                    Pairing code: {connection.pairingCode ?? "Pendiente"}
                  </p>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Expira:{" "}
                    {formatDateTime(connection.pairingExpiresAt ?? null)}
                  </p>
                </div>
              </div>
            </div>
          ) : connection?.status === "provisioning" ||
            connection?.status === "connecting" ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5">
              <h3 className="text-lg font-semibold text-slate-950">
                Esperando señal de Evolution
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                La instancia ya está en movimiento. Seguimos refrescando el
                estado automáticamente cada 8 segundos para captar el cambio a
                QR listo o conectado.
              </p>
            </div>
          ) : null}
        </div>

        <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-slate-950">
                Gestionar conexión
              </h2>
              {isPolling ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Auto refresh 8s
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              El flujo operativo es: asegurar instancia, crear si falta,
              configurar webhook, pedir QR, refrescar estado y resetear cuando
              haga falta.
            </p>
          </div>

          <div className="grid gap-4">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">
                Número del canal
              </span>
              <input
                value={formState.phone}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
                placeholder="+52 55 5000 0099"
                className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">
                Webhook base opcional
              </span>
              <input
                value={formState.automationWebhookUrl}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    automationWebhookUrl: event.target.value,
                  }))
                }
                placeholder="https://n8n.exitosos.com/webhook/leadflow/member-ana"
                className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={action !== null || isLoading || !provider?.configured}
              onClick={handleConnect}
              className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {action === "connect" ? "Conectando..." : "Conectar"}
            </button>

            <button
              type="button"
              disabled={action !== null || isLoading || !provider?.configured}
              onClick={handleQrRefresh}
              className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {action === "qr" ? "Pidiendo QR..." : "Refrescar QR"}
            </button>

            <button
              type="button"
              disabled={action !== null || isLoading}
              onClick={handleRefresh}
              className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {action === "refresh" ? "Refrescando..." : "Refrescar estado"}
            </button>

            <button
              type="button"
              disabled={action !== null || isLoading || !provider?.configured}
              onClick={handleReset}
              className="rounded-full border border-amber-200 bg-amber-50 px-5 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {action === "reset" ? "Reseteando..." : "Resetear"}
            </button>

            <button
              type="button"
              disabled={action !== null || isLoading || !connection}
              onClick={handleDisconnect}
              className="rounded-full border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {action === "disconnect" ? "Desconectando..." : "Desconectar"}
            </button>
          </div>

          {!provider?.configured ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              Evolution todavía no está configurado en este entorno. Puedes ver
              el estado persistido, pero las acciones que dependen del provider
              real quedarán disponibles recién cuando exista una base URL y API
              key válidas.
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            <p className="font-medium text-slate-900">Compatibilidad actual</p>
            <p className="mt-2">
              Esta fase no cambia todavía el handoff comercial final. Aunque el
              sponsor conecte su WhatsApp real, Reveal & Handoff sigue operando
              con `wa.me` como fallback hasta que llegue la fase de mensajería
              activa.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
