"use client";

import {
  startTransition,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  RefreshCcw,
  ShieldAlert,
  Smartphone,
  Wifi,
  WifiOff,
} from "lucide-react";
import { MemberInlineBanner } from "@/components/member-operations/member-inline-banner";
import {
  type EvolutionConnectResponse,
  type EvolutionStatusResponse,
  memberOperationRequest,
} from "@/lib/member-operations";

type WhatsAppConnectionManagerProps = {
  instanceName: string;
  title?: string;
  description?: string;
  qrTtlSeconds?: number;
  pollingIntervalMs?: number;
  compactWhenConnected?: boolean;
};

type UiState =
  | "disconnected"
  | "loading_qr"
  | "qr_ready"
  | "connected";

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

const DEFAULT_QR_TTL_SECONDS = 40;
const DEFAULT_POLLING_INTERVAL_MS = 5_000;

const STATUS_COPY: Record<
  UiState,
  {
    label: string;
    tone: string;
    description: string;
  }
> = {
  disconnected: {
    label: "Sin conectar",
    tone: "border-app-danger-border bg-app-danger-bg text-app-danger-text",
    description:
      "Tu canal todavía no está activo. Genera un código nuevo y escanéalo desde WhatsApp.",
  },
  loading_qr: {
    label: "Preparando código",
    tone: "border-app-accent bg-app-accent-soft text-app-accent",
    description:
      "Estamos preparando una conexión limpia y consultando el código más reciente.",
  },
  qr_ready: {
    label: "Listo para conectar",
    tone: "border-app-warning-border bg-app-warning-bg text-app-warning-text",
    description:
      "Escanea el código desde tu teléfono. Mientras siga visible, verificamos la conexión automáticamente.",
  },
  connected: {
    label: "Activo",
    tone: "border-app-success-border bg-app-success-bg text-app-success-text",
    description:
      "Tu canal ya quedó activo. Leadflow puede usarlo para handoff y eventos entrantes.",
  },
};

const toQrImageSrc = (value: string | null) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("data:image")) {
    return trimmed;
  }

  return `data:image/png;base64,${trimmed}`;
};

const normalizeEvolutionState = (value: string | null | undefined) =>
  value?.trim().toLowerCase() ?? "close";

const getHumanStatusMeta = (value: string) => {
  switch (value) {
    case "open":
      return {
        label: "Activo",
        tone: "border-app-success-border bg-app-success-bg text-app-success-text",
        description: "Tu canal está conectado y listo para operar.",
      };
    case "connecting":
      return {
        label: "Iniciando",
        tone: "border-app-warning-border bg-app-warning-bg text-app-warning-text",
        description: "Tu teléfono está terminando la vinculación.",
      };
    case "close":
    default:
      return {
        label: "Sin conectar",
        tone: "border-app-border bg-app-surface-muted text-app-text-muted",
        description: "Puedes generar un código nuevo para volver a vincularlo.",
      };
  }
};

function useInterval(callback: () => void, delay: number | null) {
  const onTick = useEffectEvent(callback);

  useEffect(() => {
    if (delay === null) {
      return;
    }

    const intervalId = window.setInterval(() => {
      onTick();
    }, delay);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [delay, onTick]);
}

export function WhatsAppConnectionManager({
  instanceName,
  title = "Tu canal de WhatsApp",
  description = "Conecta, revisa y reinicia tu canal sin salir del dashboard.",
  qrTtlSeconds = DEFAULT_QR_TTL_SECONDS,
  pollingIntervalMs = DEFAULT_POLLING_INTERVAL_MS,
  compactWhenConnected = false,
}: WhatsAppConnectionManagerProps) {
  const [uiState, setUiState] = useState<UiState>("disconnected");
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(qrTtlSeconds);
  const [currentStatus, setCurrentStatus] = useState<string>("close");

  const qrImageSrc = useMemo(() => toQrImageSrc(qrBase64), [qrBase64]);
  const qrExpired = uiState === "qr_ready" && secondsRemaining <= 0;
  const statusCopy = STATUS_COPY[uiState];
  const humanStatus = getHumanStatusMeta(currentStatus);
  const isCompactConnected =
    compactWhenConnected && !isBootstrapping && uiState === "connected";
  const progressPercent = Math.max(
    0,
    Math.min(100, Math.round((secondsRemaining / qrTtlSeconds) * 100)),
  );

  const applyConnectResponse = useEffectEvent(
    (response: EvolutionConnectResponse) => {
      const normalizedState = normalizeEvolutionState(response.connectionState);
      const hasQr = Boolean(response.base64 || response.pairingCode);

      startTransition(() => {
        setQrBase64(response.base64);
        setPairingCode(response.pairingCode);
        setCurrentStatus(normalizedState);

        if (normalizedState === "open") {
          setUiState("connected");
          setSecondsRemaining(qrTtlSeconds);
          return;
        }

        if (hasQr) {
          setUiState("qr_ready");
          setSecondsRemaining(qrTtlSeconds);
          return;
        }

        setUiState("disconnected");
        setSecondsRemaining(qrTtlSeconds);
      });
    },
  );

  const loadStatus = useEffectEvent(
    async (options?: { silent?: boolean }): Promise<EvolutionStatusResponse | null> => {
      try {
        const response = await memberOperationRequest<EvolutionStatusResponse>(
          `/evolution/status?instanceName=${encodeURIComponent(instanceName)}`,
          {
            method: "GET",
          },
        );

        const normalizedState = normalizeEvolutionState(response.state);

        startTransition(() => {
          setCurrentStatus(normalizedState);

          if (normalizedState === "open") {
            setUiState("connected");
            setQrBase64(null);
            setPairingCode(null);
            setSecondsRemaining(qrTtlSeconds);

            if (!options?.silent && uiState !== "connected") {
              setFeedback({
                tone: "success",
                message: "WhatsApp conectado exitosamente.",
              });
            }

            return;
          }

          if (uiState === "connected" && normalizedState !== "open") {
            setUiState("disconnected");
          }
        });

        return response;
      } catch (error) {
        if (!options?.silent) {
          setFeedback({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : "No pudimos consultar el estado del canal.",
          });
        }

        return null;
      }
    },
  );

  const connect = useEffectEvent(async (options?: { preserveFeedback?: boolean }) => {
    setIsSubmitting(true);

    if (!options?.preserveFeedback) {
      setFeedback(null);
    }

    startTransition(() => {
      setUiState("loading_qr");
    });

    try {
      const response = await memberOperationRequest<EvolutionConnectResponse>(
        "/evolution/connect",
        {
          method: "POST",
          body: JSON.stringify({ instanceName }),
        },
      );

      applyConnectResponse(response);

      if (!response.base64 && !response.pairingCode) {
        setFeedback({
          tone: "error",
          message:
            "El canal respondió, pero todavía no entregó un código utilizable. Intenta recargar en unos segundos.",
        });
      }
    } catch (error) {
      startTransition(() => {
        setUiState("disconnected");
        setQrBase64(null);
        setPairingCode(null);
      });
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos generar un nuevo código para tu canal.",
      });
    } finally {
      setIsSubmitting(false);
      setIsBootstrapping(false);
    }
  });

  const restartInstance = useEffectEvent(async () => {
    setIsSubmitting(true);
    setFeedback(null);

    try {
      await memberOperationRequest<{ success: boolean; instanceName: string }>(
        `/evolution/restart?instanceName=${encodeURIComponent(instanceName)}`,
        {
          method: "DELETE",
          body: JSON.stringify({}),
        },
      );

      setFeedback({
        tone: "success",
        message:
          "Reiniciamos el canal correctamente. Estamos generando un código nuevo.",
      });

      await connect({ preserveFeedback: true });
    } catch (error) {
      startTransition(() => {
        setUiState("disconnected");
        setQrBase64(null);
        setPairingCode(null);
      });
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos reiniciar tu canal de WhatsApp.",
      });
      setIsSubmitting(false);
    }
  });

  useEffect(() => {
    void loadStatus({ silent: true }).then((status) => {
      if (status?.connected) {
        setUiState("connected");
        setIsBootstrapping(false);
        return;
      }

      setIsBootstrapping(false);
    });
  }, [loadStatus]);

  useInterval(
    () => {
      setSecondsRemaining((current) => {
        if (current <= 1) {
          return 0;
        }

        return current - 1;
      });
    },
    uiState === "qr_ready" && !qrExpired ? 1_000 : null,
  );

  useInterval(
    () => {
      void loadStatus({ silent: true });
    },
    uiState === "qr_ready" && !qrExpired ? pollingIntervalMs : null,
  );

  useEffect(() => {
    if (qrExpired) {
      setQrBase64(null);
    }
  }, [qrExpired]);

  const statusIcon =
    uiState === "connected" ? (
      <Wifi className="h-4 w-4" />
    ) : uiState === "qr_ready" ? (
      <Smartphone className="h-4 w-4" />
    ) : (
      <WifiOff className="h-4 w-4" />
    );

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-app-border bg-[radial-gradient(circle_at_top,var(--app-accent-soft),transparent_34%),linear-gradient(180deg,var(--app-surface)_0%,var(--app-surface-strong)_100%)] p-4 shadow-[0_22px_60px_rgba(2,6,23,0.12)]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-app-accent">
              Canal / WhatsApp
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-app-text md:text-xl">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-app-text-muted">
              {description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusCopy.tone}`}
            >
              {statusIcon}
              {statusCopy.label}
            </span>
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${humanStatus.tone}`}
            >
              Estado: {humanStatus.label}
            </span>
          </div>
        </div>

        {!isCompactConnected ? (
          <p className="text-sm leading-6 text-app-text-muted">
            {statusCopy.description}
          </p>
        ) : null}
      </div>

      {feedback ? (
        <div className="mt-4">
          <MemberInlineBanner tone={feedback.tone} message={feedback.message} />
        </div>
      ) : null}

      {isBootstrapping ? (
        <div className="mt-4 rounded-[1.4rem] border border-app-border bg-app-surface-muted p-4">
          <div className="h-5 w-36 animate-pulse rounded-full bg-app-border" />
          <div className="mt-4 h-56 animate-pulse rounded-[1.25rem] bg-app-surface-strong" />
        </div>
      ) : null}

      {!isBootstrapping && uiState === "connected" ? (
        <div className="mt-4 rounded-[1.25rem] border border-app-success-border bg-app-success-bg p-4">
          <div
            className={`flex gap-4 ${
              isCompactConnected
                ? "flex-col xl:flex-row xl:items-center xl:justify-between"
                : "flex-col lg:flex-row lg:items-center lg:justify-between"
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex items-center justify-center rounded-2xl border border-app-success-border bg-app-surface-strong text-app-success-text ${
                  isCompactConnected ? "h-10 w-10" : "h-12 w-12"
                }`}
              >
                <CheckCircle2
                  className={isCompactConnected ? "h-5 w-5" : "h-6 w-6"}
                />
              </div>
              <div>
                <h3 className="text-base font-semibold text-app-text">
                  WhatsApp listo para operar
                </h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-app-text-muted">
                  El canal ya quedó activo. Si el teléfono se congela o pierde
                  enlace, puedes reiniciar la conexión desde aquí.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-app-success-border bg-app-surface-strong px-3 py-1.5 text-xs font-medium text-app-success-text">
                Handoff habilitado
              </span>
              <button
                type="button"
                onClick={() => {
                  void restartInstance();
                }}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-app-success-border bg-app-surface-strong px-4 py-2 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw className="h-4 w-4" />
                Reiniciar conexión
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!isBootstrapping && uiState !== "connected" ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-[1.4rem] border border-app-border bg-app-surface-muted p-4">
            <div
              className={`relative flex min-h-[21rem] items-center justify-center overflow-hidden rounded-[1.25rem] border ${
                qrExpired
                  ? "border-app-border bg-app-surface-strong"
                  : "border-app-border bg-[radial-gradient(circle_at_top,var(--app-accent-soft),transparent_36%),linear-gradient(180deg,var(--app-surface)_0%,var(--app-surface-strong)_100%)]"
              }`}
            >
              {uiState === "loading_qr" ? (
                <div className="flex flex-col items-center text-center">
                  <div className="h-16 w-16 animate-spin rounded-full border-4 border-app-border border-t-app-accent" />
                  <p className="mt-4 text-sm font-medium text-app-text-muted">
                    Solicitando un código nuevo para tu canal...
                  </p>
                </div>
              ) : null}

              {uiState !== "loading_qr" && qrImageSrc && !qrExpired ? (
                <div className="flex flex-col items-center gap-4 p-4">
                  <img
                    src={qrImageSrc}
                    alt="QR de conexión de WhatsApp"
                    className="h-[16rem] w-[16rem] rounded-[1.2rem] border border-app-border bg-white p-3 shadow-[0_18px_45px_rgba(2,6,23,0.12)] md:h-[18rem] md:w-[18rem]"
                  />
                  {pairingCode ? (
                    <div className="rounded-full border border-app-border bg-app-surface-strong px-4 py-2 text-sm font-semibold tracking-[0.24em] text-app-text">
                      {pairingCode}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {uiState !== "loading_qr" && (!qrImageSrc || qrExpired) ? (
                <div className="flex max-w-md flex-col items-center px-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-app-border bg-app-surface-strong text-app-text-muted">
                    {qrExpired ? (
                      <RefreshCcw className="h-6 w-6" />
                    ) : (
                      <Smartphone className="h-6 w-6" />
                    )}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-app-text">
                    {qrExpired ? "El código venció" : "Todavía no hay código visible"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-app-text-muted">
                    {qrExpired
                      ? "Genera uno nuevo para seguir con la conexión."
                      : "Cuando el canal entregue un QR o pairing code, aparecerá aquí automáticamente."}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-[1.25rem] border border-app-border bg-app-surface-muted p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-soft">
                    Temporizador
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-app-text">
                    {uiState === "qr_ready" && !qrExpired
                      ? `${secondsRemaining}s`
                      : qrExpired
                        ? "Expiró"
                        : "--"}
                  </p>
                </div>

                <div className="rounded-full border border-app-border bg-app-surface-strong px-3 py-1 text-xs font-medium text-app-text-soft">
                  Polling {Math.round(pollingIntervalMs / 1000)}s
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-app-border">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    qrExpired
                      ? "bg-app-text-soft"
                      : uiState === "qr_ready"
                        ? "bg-[linear-gradient(90deg,_#f59e0b_0%,_#fb923c_100%)]"
                        : "bg-[linear-gradient(90deg,_#43c6ac_0%,_#0891b2_100%)]"
                  }`}
                  style={{
                    width:
                      uiState === "qr_ready"
                        ? `${progressPercent}%`
                        : uiState === "loading_qr"
                          ? "45%"
                          : "18%",
                  }}
                />
              </div>

              <p className="mt-3 text-sm leading-6 text-app-text-muted">
                {qrExpired
                  ? "El código anterior ya no debe usarse. Genera uno nuevo para reintentar."
                  : currentStatus === "connecting"
                    ? "Tu teléfono ya está terminando la conexión. Mantén esta vista abierta unos segundos más."
                    : "Aquí ves el tiempo restante del intento actual."}
              </p>
            </div>

            <div className="rounded-[1.25rem] border border-app-border bg-app-surface-muted p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-soft">
                Pasos rápidos
              </p>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-app-text-muted">
                <li>1. Abre WhatsApp en tu celular.</li>
                <li>2. Entra a Dispositivos vinculados.</li>
                <li>3. Escanea el QR o usa el pairing code.</li>
                <li>4. Espera a que el estado cambie a Activo.</li>
              </ol>
            </div>

            <div className="rounded-[1.25rem] border border-app-border bg-app-surface-muted p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-soft">
                Acciones
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void connect();
                  }}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-app-text px-4 py-2 text-sm font-semibold text-app-bg transition hover:opacity-92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCcw className="h-4 w-4" />
                  {uiState === "qr_ready" && !qrExpired
                    ? "Recargar código"
                    : isSubmitting && uiState === "loading_qr"
                      ? "Preparando código..."
                      : "Generar código"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void restartInstance();
                  }}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-app-danger-border bg-app-danger-bg px-4 py-2 text-sm font-semibold text-app-danger-text transition hover:opacity-92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ShieldAlert className="h-4 w-4" />
                  Reiniciar canal
                </button>
              </div>

              <div className="mt-4 rounded-[1rem] border border-app-border bg-app-surface-strong p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-app-text-soft">
                  Estado actual
                </p>
                <p className="mt-2 text-base font-semibold text-app-text">
                  {humanStatus.label}
                </p>
                <p className="mt-1 text-sm leading-6 text-app-text-muted">
                  {humanStatus.description}
                </p>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
