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
  const isDisabled = isOpening || !isSsoAvailable;

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
    <section className="space-y-5 rounded-[2rem] border border-app-border bg-[radial-gradient(circle_at_top_left,var(--app-accent-soft),transparent_42%),linear-gradient(180deg,var(--app-surface)_0%,var(--app-surface-strong)_100%)] p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-5">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-accent">
            Lista de Protección
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-app-text">
            Protege tu canal sin salir del dashboard
          </h2>
          <p className="mt-3 text-sm leading-6 text-app-text-muted">
            Abre Kurukin Hub con acceso temporal y sigue la revisión de números
            protegidos sin perder el contexto de tu operación diaria.
          </p>
          {advisorPhone ? (
            <p className="mt-3 text-sm font-medium text-app-text">
              Canal vinculado: {advisorPhone}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => void handleOpen()}
          disabled={isDisabled}
          className="inline-flex min-h-14 items-center justify-center rounded-[1.35rem] bg-app-text px-5 py-3 text-sm font-semibold text-app-bg transition hover:opacity-92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60 sm:self-start"
        >
          {isOpening
            ? "Abriendo Kurukin Hub..."
            : "Abrir Lista de Protección"}
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
