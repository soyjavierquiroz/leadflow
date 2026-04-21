"use client";

import { useState } from "react";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { memberOperationRequest } from "@/lib/member-operations";

type SsoBlacklistResponse = {
  url: string;
};

type MemberProtectionHubButtonProps = {
  advisorPhone: string | null;
  isSsoAvailable: boolean;
};

export function MemberProtectionHubButton({
  advisorPhone,
  isSsoAvailable,
}: MemberProtectionHubButtonProps) {
  const [isOpening, setIsOpening] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const isDisabled = isOpening || !isSsoAvailable || !advisorPhone;
  const title = advisorPhone
    ? `Gestiona tu lista externa para ${advisorPhone}`
    : "Gestiona tu lista externa para tu asesor";

  const handleOpen = async () => {
    if (isDisabled) {
      return;
    }

    setIsOpening(true);
    setFeedback(null);
    const popup = window.open("", "_blank");

    if (popup) {
      popup.opener = null;
      popup.document.title = "Abriendo Kurukin Hub...";
      popup.document.body.innerHTML =
        '<p style="font-family: sans-serif; padding: 24px;">Conectando con Kurukin Hub...</p>';
    }

    try {
      const response = await memberOperationRequest<SsoBlacklistResponse>(
        "/sso/blacklist",
        {
          method: "GET",
        },
      );

      if (popup) {
        popup.location.href = response.url;
      } else {
        const fallback = window.open(response.url, "_blank", "noopener,noreferrer");

        if (!fallback) {
          throw new Error(
            "Tu navegador bloqueó la nueva pestaña. Permite pop-ups e inténtalo de nuevo.",
          );
        }
      }

      setFeedback({
        tone: "success",
        message: "Kurukin Hub se abrió en una nueva pestaña con tu acceso SSO.",
      });
    } catch (error) {
      popup?.close();
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos abrir Kurukin Hub.",
      });
    } finally {
      setIsOpening(false);
    }
  };

  return (
    <section className="space-y-5 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Lista de Protección
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Leadflow ya no administra esta lista localmente. Usa este acceso
            directo para entrar a Kurukin Hub con un token temporal firmado y
            continuar la gestión desde allá.
          </p>
          {advisorPhone ? (
            <p className="mt-3 text-sm font-medium text-slate-700">
              Identidad del asesor: {advisorPhone}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void handleOpen()}
          disabled={isDisabled}
          className="inline-flex min-h-16 items-center justify-center rounded-[1.5rem] bg-slate-950 px-8 py-4 text-base font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 lg:min-w-[24rem]"
        >
          {isOpening
            ? "Abriendo Kurukin Hub..."
            : "Gestionar Lista de Protección (Kurukin Hub)"}
        </button>
      </div>

      {!isSsoAvailable ? (
        <OperationBanner
          tone="error"
          message="Kurukin Hub no está disponible ahora mismo porque el SSO todavía no está configurado."
        />
      ) : null}

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}
    </section>
  );
}
