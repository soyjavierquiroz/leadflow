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
import { OperationBanner } from "@/components/team-operations/operation-banner";
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
    tone: "border-slate-200 bg-slate-100 text-slate-700",
    description:
      "La instancia todavía no tiene una sesión activa. Genera un QR y escanéalo desde WhatsApp.",
  },
  loading_qr: {
    label: "Cargando QR",
    tone: "border-sky-200 bg-sky-50 text-sky-700",
    description:
      "Estamos preparando una sesión limpia en Evolution y consultando el QR más reciente.",
  },
  qr_ready: {
    label: "QR Listo",
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    description:
      "Escanea el código con tu teléfono. Mientras esté visible, verificamos el estado automáticamente.",
  },
  connected: {
    label: "Conectado",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    description:
      "Tu WhatsApp ya quedó enlazado. Leadflow puede usar esta instancia para el handoff y los eventos entrantes.",
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
  title = "Conexion de WhatsApp",
  description = "Genera, supervisa y reinicia el QR operativo de tu instancia sin cambiar el nombre con el que Leadflow la reconoce.",
  qrTtlSeconds = DEFAULT_QR_TTL_SECONDS,
  pollingIntervalMs = DEFAULT_POLLING_INTERVAL_MS,
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
            setFeedback({
              tone: "success",
              message: "WhatsApp conectado exitosamente.",
            });
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
      <Wifi className="h-5 w-5" />
    ) : uiState === "qr_ready" ? (
      <Smartphone className="h-5 w-5" />
    ) : (
      <WifiOff className="h-5 w-5" />
    );

  return (
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.12),_transparent_32%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
            Canal / WhatsApp / Evolution
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 md:text-3xl">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${statusCopy.tone}`}
            >
              {statusIcon}
              {statusCopy.label}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
              Estado remoto: {currentStatus || "close"}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
              Instancia: {instanceName}
            </span>
          </div>
          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">
            {statusCopy.description}
          </p>
        </div>
      </div>

      {feedback ? (
        <div className="mt-5">
          <OperationBanner tone={feedback.tone} message={feedback.message} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[1.9rem] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,255,255,0.96)_0%,_rgba(248,250,252,0.96)_100%)] p-5 shadow-[0_20px_50px_rgba(15,23,42,0.07)] md:p-7">
          {isBootstrapping ? (
            <div className="space-y-5">
              <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200" />
              <div className="mx-auto aspect-square max-w-[24rem] animate-pulse rounded-[1.9rem] bg-slate-100" />
            </div>
          ) : null}

          {!isBootstrapping && uiState === "connected" ? (
            <div className="flex min-h-[26rem] flex-col items-center justify-center rounded-[1.9rem] border border-emerald-200 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_38%),linear-gradient(180deg,_#ecfdf5_0%,_#ffffff_100%)] p-8 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-600 shadow-[0_22px_45px_rgba(16,185,129,0.18)]">
                <CheckCircle2 className="h-12 w-12" />
              </div>
              <h3 className="mt-6 text-3xl font-semibold text-slate-950">
                WhatsApp Conectado Exitosamente
              </h3>
              <p className="mt-3 max-w-lg text-sm leading-7 text-slate-600">
                La sesión quedó abierta en Evolution. Si el asesor se queda
                trabado o quiere reemparejar el dispositivo, puede usar el botón
                de reinicio sin cambiar el denominativo de la instancia.
              </p>
            </div>
          ) : null}

          {!isBootstrapping && uiState !== "connected" ? (
            <div className="space-y-4">
              <div
                className={`relative flex min-h-[26rem] items-center justify-center overflow-hidden rounded-[1.9rem] border transition ${
                  qrExpired
                    ? "border-slate-200 bg-slate-50"
                    : "border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.08),_transparent_45%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)]"
                }`}
              >
                {uiState === "loading_qr" ? (
                  <div className="flex flex-col items-center text-center">
                    <div className="h-20 w-20 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />
                    <p className="mt-6 text-sm font-medium text-slate-700">
                      Solicitando un QR limpio a Evolution...
                    </p>
                  </div>
                ) : null}

                {uiState !== "loading_qr" && qrImageSrc && !qrExpired ? (
                  <div className="flex flex-col items-center gap-5 p-6">
                    <img
                      src={qrImageSrc}
                      alt="QR de conexion de WhatsApp"
                      className="h-[18rem] w-[18rem] rounded-[1.7rem] border border-slate-200 bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.12)] md:h-[22rem] md:w-[22rem]"
                    />
                    {pairingCode ? (
                      <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold tracking-[0.24em] text-slate-700 shadow-sm">
                        {pairingCode}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {uiState !== "loading_qr" && (!qrImageSrc || qrExpired) ? (
                  <div className="flex max-w-md flex-col items-center px-6 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_18px_35px_rgba(15,23,42,0.08)]">
                      {qrExpired ? (
                        <RefreshCcw className="h-8 w-8" />
                      ) : (
                        <Smartphone className="h-8 w-8" />
                      )}
                    </div>
                    <h3 className="mt-5 text-2xl font-semibold text-slate-950">
                      {qrExpired ? "El QR venció" : "Todavía no hay QR visible"}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      {qrExpired
                        ? "Genera un QR nuevo para seguir con el emparejamiento. Mantenemos el mismo instance_name para no perder consistencia operativa."
                        : "Cuando la instancia entregue un QR o pairing code, aparecerá aquí automáticamente."}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="rounded-[1.9rem] border border-slate-200 bg-white/90 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.05)] md:p-6">
          <div className="rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Instrucciones
            </p>
            <ol className="mt-4 space-y-4 text-sm leading-7 text-slate-600">
              <li>1. Abre WhatsApp en tu celular.</li>
              <li>2. Entra a Dispositivos vinculados y toca Vincular un dispositivo.</li>
              <li>3. Escanea este QR antes de que expire o usa el pairing code si aparece.</li>
              <li>4. Espera a que el estado cambie a <code>open</code> para confirmar la conexión.</li>
            </ol>
          </div>

          <div className="mt-5 rounded-[1.6rem] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Temporizador
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  {uiState === "qr_ready" && !qrExpired
                    ? `${secondsRemaining}s`
                    : qrExpired
                      ? "Expiró"
                      : "--"}
                </p>
              </div>

              <div className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
                Polling cada {Math.round(pollingIntervalMs / 1000)}s
              </div>
            </div>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  qrExpired
                    ? "bg-slate-300"
                    : uiState === "qr_ready"
                      ? "bg-[linear-gradient(90deg,_#f59e0b_0%,_#f97316_100%)]"
                      : uiState === "connected"
                        ? "bg-[linear-gradient(90deg,_#10b981_0%,_#14b8a6_100%)]"
                        : "bg-[linear-gradient(90deg,_#0f172a_0%,_#334155_100%)]"
                }`}
                style={{
                  width:
                    uiState === "qr_ready"
                      ? `${progressPercent}%`
                      : uiState === "connected"
                        ? "100%"
                        : "22%",
                }}
              />
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              {qrExpired
                ? "El QR anterior ya no debe usarse. Genera uno nuevo para reintentar el enlace."
                : currentStatus === "connecting"
                  ? "El dispositivo ya está negociando la sesión. Mantén esta pantalla abierta unos segundos más."
                  : currentStatus === "open"
                    ? "La sesión quedó lista para operar."
                    : "Cuando el QR esté activo, aquí verás el avance restante de este intento."}
            </p>
          </div>

          <div className="mt-5 rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Acciones
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  void connect();
                }}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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
                className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldAlert className="h-4 w-4" />
                Reiniciar Instancia
              </button>
            </div>

            <div className="mt-5 rounded-[1.35rem] border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Señal actual
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {currentStatus || "close"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {currentStatus === "open"
                  ? "Sesion activa y lista para handoff."
                  : currentStatus === "connecting"
                    ? "WhatsApp está terminando de vincular el dispositivo."
                    : "La instancia sigue disponible para pedir un QR nuevo."}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
