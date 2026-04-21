"use client";

import { useState } from "react";
import { Crown, Zap } from "lucide-react";
import { webPublicConfig } from "@/lib/public-env";

type SsoBlacklistAdminResponse = {
  url: string;
};

type ErrorPayload = {
  error?: string;
  message?: string;
};

const isSsoBlacklistAdminResponse = (
  payload: ErrorPayload | SsoBlacklistAdminResponse | null,
): payload is SsoBlacklistAdminResponse =>
  Boolean(payload && typeof payload === "object" && "url" in payload);

const getErrorMessage = (
  payload: ErrorPayload | SsoBlacklistAdminResponse | null,
) => {
  if (payload && typeof payload === "object" && "message" in payload) {
    return typeof payload.message === "string"
      ? payload.message
      : "No pudimos abrir el acceso maestro de Kurukin Blacklist.";
  }

  if (payload && typeof payload === "object" && "error" in payload) {
    return typeof payload.error === "string"
      ? payload.error
      : "No pudimos abrir el acceso maestro de Kurukin Blacklist.";
  }

  return "No pudimos abrir el acceso maestro de Kurukin Blacklist.";
};

export function SuperAdminBlacklistButton() {
  const [isOpening, setIsOpening] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const handleOpen = async () => {
    if (isOpening) {
      return;
    }

    setIsOpening(true);
    setFeedback(null);

    const popup = window.open("", "_blank");

    if (popup) {
      popup.opener = null;
      popup.document.title = "Abriendo Kurukin Blacklist...";
      popup.document.body.innerHTML =
        '<p style="font-family: sans-serif; padding: 24px;">Conectando con Kurukin Blacklist...</p>';
    }

    try {
      const response = await fetch(
        `${webPublicConfig.urls.api}/v1/system/sso/blacklist-admin`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | ErrorPayload
        | SsoBlacklistAdminResponse
        | null;

      if (!response.ok || !isSsoBlacklistAdminResponse(payload)) {
        throw new Error(getErrorMessage(payload));
      }

      if (popup) {
        popup.location.href = payload.url;
      } else {
        const fallback = window.open(
          payload.url,
          "_blank",
          "noopener,noreferrer",
        );

        if (!fallback) {
          throw new Error(
            "Tu navegador bloqueó la nueva pestaña. Permite pop-ups e inténtalo de nuevo.",
          );
        }
      }

      setFeedback({
        tone: "success",
        message:
          "Kurukin Blacklist se abrió en una nueva pestaña con acceso maestro temporal.",
      });
    } catch (error) {
      popup?.close();
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos abrir el acceso maestro de Kurukin Blacklist.",
      });
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <section className="w-full overflow-hidden rounded-[2rem] border border-amber-200 bg-[linear-gradient(135deg,rgba(15,23,42,1),rgba(30,41,59,0.96)_58%,rgba(180,83,9,0.92))] p-6 text-left shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-200">
            <Crown className="h-4 w-4" />
            Olimpo
          </div>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
            Acceso Maestro: Kurukin Blacklist
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
            Entra al dashboard administrativo global de Kurukin Blacklist con un
            SSO temporal firmado por Leadflow. Este acceso ignora el filtro por
            asesor y habilita la vista completa para operación de plataforma.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleOpen()}
          disabled={isOpening}
          className="inline-flex min-h-16 items-center justify-center gap-3 rounded-[1.5rem] bg-amber-400 px-8 py-4 text-base font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60 lg:min-w-[22rem]"
        >
          <Zap className="h-5 w-5" />
          {isOpening
            ? "Abriendo acceso maestro..."
            : "Acceso Maestro: Kurukin Blacklist"}
        </button>
      </div>

      {feedback ? (
        <div
          className={`mt-5 rounded-[1.5rem] border px-4 py-3 text-sm ${
            feedback.tone === "success"
              ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100"
              : "border-rose-300/40 bg-rose-400/10 text-rose-100"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}
    </section>
  );
}
