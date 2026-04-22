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
    label: "Desconectado",
    tone: "border-rose-500/20 bg-rose-500/10 text-rose-100",
    description:
      "La instancia no tiene sesión activa. Genera un QR nuevo y escanéalo desde WhatsApp.",
  },
  loading_qr: {
    label: "Cargando QR",
    tone: "border-sky-500/20 bg-sky-500/10 text-sky-100",
    description:
      "Estamos preparando una sesión limpia y consultando el QR más reciente.",
  },
  qr_ready: {
    label: "QR listo",
    tone: "border-amber-500/20 bg-amber-500/10 text-amber-100",
    description:
      "Escanea el QR desde tu teléfono. Mientras siga visible, verificamos la conexión automáticamente.",
  },
  connected: {
    label: "Conectado",
    tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
    description:
      "La sesión ya quedó abierta. Leadflow puede usar esta instancia para handoff y eventos entrantes.",
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
  title = "Conexión de WhatsApp",
  description = "Genera, supervisa y reinicia el QR operativo de tu instancia sin cambiar el nombre con el que Leadflow la reconoce.",
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
                : "No pudimos consultar el estado de la instancia.",
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
            "La instancia respondió, pero todavía no entregó un QR utilizable. Intenta recargar en unos segundos.",
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
            : "No pudimos generar un nuevo QR para la instancia.",
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
        },
      );

      setFeedback({
        tone: "success",
        message:
          "La instancia se reinició correctamente. Estamos generando un QR nuevo.",
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
            : "No pudimos reiniciar la instancia de WhatsApp.",
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
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.10),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.98)_0%,_rgba(2,6,23,0.98)_100%)] p-4 shadow-[0_22px_60px_rgba(2,6,23,0.3)]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-cyan-300">
              Canal / WhatsApp / Evolution
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-white md:text-xl">
              {title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">
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
            <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-xs font-medium text-slate-300">
              Estado remoto: {currentStatus || "close"}
            </span>
            <span className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-xs font-medium text-slate-300">
              Instancia: {instanceName}
            </span>
          </div>
        </div>

        {!isCompactConnected ? (
          <p className="text-sm leading-6 text-slate-400">
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
        <div className="mt-4 rounded-[1.4rem] border border-slate-800 bg-slate-950/60 p-4">
          <div className="h-5 w-36 animate-pulse rounded-full bg-slate-800" />
          <div className="mt-4 h-56 animate-pulse rounded-[1.25rem] bg-slate-900" />
        </div>
      ) : null}

      {!isBootstrapping && uiState === "connected" ? (
        <div className="mt-4 rounded-[1.25rem] border border-emerald-500/20 bg-emerald-500/10 p-4">
          <div
            className={`flex gap-4 ${
              isCompactConnected
                ? "flex-col xl:flex-row xl:items-center xl:justify-between"
                : "flex-col lg:flex-row lg:items-center lg:justify-between"
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex items-center justify-center rounded-2xl border border-emerald-500/20 bg-slate-950/80 text-emerald-200 ${
                  isCompactConnected ? "h-10 w-10" : "h-12 w-12"
                }`}
              >
                <CheckCircle2
                  className={isCompactConnected ? "h-5 w-5" : "h-6 w-6"}
                />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  WhatsApp listo para operar
                </h3>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-emerald-50/85">
                  La sesión quedó abierta en Evolution. Si el dispositivo se
                  traba, puedes reiniciar la instancia desde aquí sin cambiar
                  su identificador operativo.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-emerald-500/20 bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-emerald-100">
                Handoff habilitado
              </span>
              <button
                type="button"
                onClick={() => {
                  void restartInstance();
                }}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-400/25 bg-slate-950/90 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw className="h-4 w-4" />
                Reiniciar instancia
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!isBootstrapping && uiState !== "connected" ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="rounded-[1.4rem] border border-slate-800 bg-slate-950/60 p-4">
            <div
              className={`relative flex min-h-[21rem] items-center justify-center overflow-hidden rounded-[1.25rem] border ${
                qrExpired
                  ? "border-slate-800 bg-slate-950"
                  : "border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.08),_transparent_36%),linear-gradient(180deg,_rgba(15,23,42,0.92)_0%,_rgba(2,6,23,0.96)_100%)]"
              }`}
            >
              {uiState === "loading_qr" ? (
                <div className="flex flex-col items-center text-center">
                  <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-300" />
                  <p className="mt-4 text-sm font-medium text-slate-300">
                    Solicitando un QR limpio a Evolution...
                  </p>
                </div>
              ) : null}

              {uiState !== "loading_qr" && qrImageSrc && !qrExpired ? (
                <div className="flex flex-col items-center gap-4 p-4">
                  <img
                    src={qrImageSrc}
                    alt="QR de conexión de WhatsApp"
                    className="h-[16rem] w-[16rem] rounded-[1.2rem] border border-slate-700 bg-white p-3 shadow-[0_18px_45px_rgba(2,6,23,0.28)] md:h-[18rem] md:w-[18rem]"
                  />
                  {pairingCode ? (
                    <div className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold tracking-[0.24em] text-slate-200">
                      {pairingCode}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {uiState !== "loading_qr" && (!qrImageSrc || qrExpired) ? (
                <div className="flex max-w-md flex-col items-center px-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 text-slate-300">
                    {qrExpired ? (
                      <RefreshCcw className="h-6 w-6" />
                    ) : (
                      <Smartphone className="h-6 w-6" />
                    )}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-white">
                    {qrExpired ? "El QR venció" : "Todavía no hay QR visible"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {qrExpired
                      ? "Genera un QR nuevo para seguir con el emparejamiento."
                      : "Cuando la instancia entregue un QR o pairing code, aparecerá aquí automáticamente."}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-[1.25rem] border border-slate-800 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Temporizador
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    {uiState === "qr_ready" && !qrExpired
                      ? `${secondsRemaining}s`
                      : qrExpired
                        ? "Expiró"
                        : "--"}
                  </p>
                </div>

                <div className="rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-300">
                  Polling {Math.round(pollingIntervalMs / 1000)}s
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    qrExpired
                      ? "bg-slate-600"
                      : uiState === "qr_ready"
                        ? "bg-[linear-gradient(90deg,_#f59e0b_0%,_#f97316_100%)]"
                        : "bg-[linear-gradient(90deg,_#22d3ee_0%,_#38bdf8_100%)]"
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

              <p className="mt-3 text-sm leading-6 text-slate-400">
                {qrExpired
                  ? "El QR anterior ya no debe usarse. Genera uno nuevo para reintentar."
                  : currentStatus === "connecting"
                    ? "El dispositivo ya está negociando la sesión. Mantén esta vista abierta unos segundos más."
                    : "Aquí ves el tiempo restante del intento actual."}
              </p>
            </div>

            <div className="rounded-[1.25rem] border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Pasos rápidos
              </p>
              <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                <li>1. Abre WhatsApp en tu celular.</li>
                <li>2. Entra a Dispositivos vinculados.</li>
                <li>3. Escanea el QR o usa el pairing code.</li>
                <li>4. Espera a que el estado cambie a <code>open</code>.</li>
              </ol>
            </div>

            <div className="rounded-[1.25rem] border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Acciones
              </p>
              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void connect();
                  }}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCcw className="h-4 w-4" />
                  {uiState === "qr_ready" && !qrExpired
                    ? "Recargar QR"
                    : isSubmitting && uiState === "loading_qr"
                      ? "Preparando QR..."
                      : "Generar QR"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void restartInstance();
                  }}
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ShieldAlert className="h-4 w-4" />
                  Reiniciar instancia
                </button>
              </div>

              <div className="mt-4 rounded-[1rem] border border-slate-800 bg-slate-900/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Señal actual
                </p>
                <p className="mt-2 text-base font-semibold text-white">
                  {currentStatus || "close"}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  {currentStatus === "open"
                    ? "Sesión activa y lista para handoff."
                    : currentStatus === "connecting"
                      ? "WhatsApp está terminando de vincular el dispositivo."
                      : "La instancia está lista para pedir un QR nuevo."}
                </p>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
