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
  connected: "Conectado",
  error: "Con error",
};

export function MemberChannelClient({ sponsor }: MemberChannelClientProps) {
  const [snapshot, setSnapshot] = useState<MemberMessagingSnapshot | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [action, setAction] = useState<
    "connect" | "refresh" | "disconnect" | null
  >(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [formState, setFormState] = useState({
    phone: sponsor.phone ?? "",
    automationWebhookUrl: "",
  });

  const loadSnapshot = useEffectEvent(
    async (options?: { preserveFeedback?: boolean }) => {
      setIsLoading(true);

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
        setIsLoading(false);
      }
    },
  );

  useEffect(() => {
    void loadSnapshot();
  }, []);

  const handleConnect = async () => {
    setAction("connect");
    setFeedback(null);

    try {
      const nextSnapshot =
        await memberOperationRequest<MemberMessagingSnapshot>(
          "/messaging-integrations/me/connect",
          {
            method: "POST",
            body: JSON.stringify({
              phone: formState.phone || null,
              automationWebhookUrl: formState.automationWebhookUrl || null,
            }),
          },
        );

      setSnapshot(nextSnapshot);
      setFeedback({
        tone: "success",
        message:
          nextSnapshot.connection?.status === "connected"
            ? "Canal conectado correctamente."
            : "Instancia creada. Escanea el QR o usa el pairing code para terminar la conexión.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos iniciar la conexión con Evolution.",
      });
    } finally {
      setAction(null);
    }
  };

  const handleRefresh = async () => {
    setAction("refresh");
    setFeedback(null);

    try {
      const nextSnapshot =
        await memberOperationRequest<MemberMessagingSnapshot>(
          "/messaging-integrations/me/refresh",
          {
            method: "POST",
            body: JSON.stringify({}),
          },
        );

      setSnapshot(nextSnapshot);
      setFeedback({
        tone: "success",
        message: "Estado del canal actualizado.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos refrescar el canal.",
      });
    } finally {
      setAction(null);
    }
  };

  const handleDisconnect = async () => {
    setAction("disconnect");
    setFeedback(null);

    try {
      const nextSnapshot =
        await memberOperationRequest<MemberMessagingSnapshot>(
          "/messaging-integrations/me/disconnect",
          {
            method: "POST",
            body: JSON.stringify({}),
          },
        );

      setSnapshot(nextSnapshot);
      setFeedback({
        tone: "success",
        message: "Canal desactivado. El handoff sigue funcionando vía wa.me.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos desconectar el canal.",
      });
    } finally {
      setAction(null);
    }
  };

  const connection = snapshot?.connection ?? null;
  const provider = snapshot?.provider ?? null;

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Sponsor / Member / Canal"
        title="Conexión WhatsApp del member"
        description="Cada sponsor puede administrar su propia instancia de mensajería. En esta fase dejamos lista la conexión con Evolution y el terreno para n8n, sin cambiar todavía el fallback comercial actual."
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
          hint="Persistido por sponsor y visible para el member autenticado."
        />
        <KpiCard
          label="Número operativo"
          value={connection?.normalizedPhone ?? sponsor.phone ?? "Pendiente"}
          hint="El handoff actual sigue usando wa.me si todavía no existe un canal real."
        />
        <KpiCard
          label="Webhook listo"
          value={connection?.automationEnabled ? "Sí" : "No"}
          hint="Base opcional para la orquestación futura con n8n."
        />
        <KpiCard
          label="Fallback actual"
          value={provider?.fallbackWaMeEnabled ? "wa.me activo" : "Desactivado"}
          hint="Reveal & handoff actual permanece compatible mientras evoluciona la mensajería."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
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
                Provider {provider?.provider ?? "EVOLUTION"} con ownership
                ligado a tu sponsor. Aquí quedará la base para handoff directo y
                futura automatización.
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
                {connection?.externalInstanceId ?? "Se generará al conectar"}
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
              <dt className="text-slate-500">Webhook</dt>
              <dd className="mt-1 break-all font-medium text-slate-900">
                {connection?.automationWebhookUrl ?? "Pendiente"}
              </dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-slate-500">Nota del provider</dt>
              <dd className="mt-1 leading-6 text-slate-800">
                {provider?.note ??
                  "Evolution configurado. Puedes crear o refrescar tu conexión individual."}
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
                    width={160}
                    height={160}
                    unoptimized
                    className="h-40 w-40 rounded-3xl border border-slate-200 bg-white p-3"
                  />
                ) : null}

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-950">
                    Emparejamiento pendiente
                  </h3>
                  <p className="text-sm leading-6 text-slate-600">
                    Escanea este QR desde la app de WhatsApp o usa el código de
                    pairing si Evolution ya lo devolvió.
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
          ) : null}
        </div>

        <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              Gestionar conexión
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              El canal pertenece al sponsor actual. Si todavía no existe
              conexión real, el negocio sigue operando con el CTA público a
              `wa.me`.
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
                Webhook de automatización
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
              {action === "connect" ? "Conectando..." : "Conectar canal"}
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
              el estado persistido y preparar el canal, pero `Conectar canal`
              quedará disponible recién cuando existan las variables de entorno
              reales.
            </div>
          ) : null}

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
            <p className="font-medium text-slate-900">Compatibilidad actual</p>
            <p className="mt-2">
              Reveal & Handoff v1 no cambia todavía su comportamiento comercial:
              si no hay conexión real, el thank-you sigue usando el enlace
              público a WhatsApp. Esta fase solo deja lista la capa de canal por
              sponsor.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
