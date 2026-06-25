"use client";

import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Rocket,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SectionHeader } from "@/components/app-shell/section-header";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import {
  memberOperationRequest,
  type MemberOperationRequestError,
} from "@/lib/member-operations";
import type {
  FunnelArsenalSnapshot,
  FunnelArsenalTemplate,
} from "@/lib/funnel-arsenal";

type FunnelArsenalClientProps = {
  initialSnapshot: FunnelArsenalSnapshot;
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

const difficultyLabel: Record<FunnelArsenalTemplate["difficulty"], string> = {
  basic: "Básico",
  intermediate: "Intermedio",
  advanced: "Avanzado",
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "No pudimos habilitar el embudo.";

const isReferralUrl = (url: string | undefined) => {
  if (!url) {
    return false;
  }

  try {
    return new URL(url).pathname.startsWith("/ref/");
  } catch {
    return url.startsWith("/ref/");
  }
};

export function FunnelArsenalClient({
  initialSnapshot,
}: FunnelArsenalClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [enablingTemplateKey, setEnablingTemplateKey] = useState<string | null>(
    null,
  );
  const [copiedTemplateKey, setCopiedTemplateKey] = useState<string | null>(
    null,
  );
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const handleEnable = async (templateKey: string) => {
    setEnablingTemplateKey(templateKey);
    setFeedback(null);

    try {
      const enabledTemplate =
        await memberOperationRequest<FunnelArsenalTemplate>(
          `/funnel-arsenal/me/${encodeURIComponent(templateKey)}/enable`,
          {
            method: "POST",
          },
        );

      setSnapshot((current) => ({
        ...current,
        templates: current.templates.map((template) =>
          template.templateKey === enabledTemplate.templateKey
            ? enabledTemplate
            : template,
        ),
      }));
      setFeedback({
        tone: "success",
        message: "Embudo habilitado.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message: getErrorMessage(error as MemberOperationRequestError),
      });
    } finally {
      setEnablingTemplateKey(null);
    }
  };

  const handleCopy = async (templateKey: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedTemplateKey(templateKey);
      window.setTimeout(() => {
        setCopiedTemplateKey((current) =>
          current === templateKey ? null : current,
        );
      }, 1800);
    } catch {
      setFeedback({
        tone: "error",
        message: "No pudimos copiar la URL.",
      });
    }
  };

  const hasEnabledPublication = snapshot.templates.some(
    (template) =>
      template.enabled &&
      template.publicUrl &&
      !isReferralUrl(template.publicUrl),
  );

  return (
    <div className="w-full space-y-8">
      <SectionHeader
        title="Arsenal de embudos"
        description="Estos embudos están preparados para tu tipo de negocio."
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      {snapshot.requiresCommercialProfile ? (
        <section className="rounded-lg border border-app-warning-border bg-app-warning-bg p-5 text-app-warning-text">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-base font-semibold">
                Completa tu perfil comercial
              </h2>
              <p className="mt-1 text-sm leading-6">
                Completa tu tipo de negocio para recomendarte embudos adecuados.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {!snapshot.requiresCommercialProfile && !hasEnabledPublication ? (
        <section className="rounded-lg border border-dashed border-app-border bg-app-surface p-5 text-app-text-muted">
          <h2 className="text-base font-semibold text-app-text">
            Aún no tienes un embudo habilitado
          </h2>
          <p className="mt-1 text-sm leading-6">
            Elige un embudo del arsenal para obtener una página pública lista
            para compartir.
          </p>
          <Link
            href="/member/funnels"
            className="mt-4 inline-flex items-center justify-center rounded-lg border border-app-border bg-app-card px-4 py-2.5 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted"
          >
            Ver arsenal de embudos
          </Link>
        </section>
      ) : null}

      {!snapshot.requiresCommercialProfile &&
      snapshot.templates.length === 0 ? (
        <section className="rounded-lg border border-app-border bg-app-surface p-5 text-app-text-muted">
          <h2 className="text-base font-semibold text-app-text">
            No hay plantillas para este blueprint
          </h2>
          <p className="mt-1 text-sm leading-6">
            Actualiza tu perfil comercial para recibir una recomendación de
            embudo.
          </p>
        </section>
      ) : null}

      <section className="grid w-full gap-4 xl:grid-cols-2">
        {snapshot.templates.map((template) => {
          const isEnabling = enablingTemplateKey === template.templateKey;
          const isCopied = copiedTemplateKey === template.templateKey;
          const hasFunnelPublicationUrl =
            template.enabled &&
            template.publicUrl &&
            !isReferralUrl(template.publicUrl);

          return (
            <article
              key={template.templateKey}
              className="flex min-h-[320px] flex-col justify-between rounded-lg border border-app-border bg-app-surface p-5 shadow-[0_18px_45px_rgba(2,6,23,0.08)]"
            >
              <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-app-border bg-app-card px-3 py-1 text-xs font-semibold text-app-text-muted">
                        {difficultyLabel[template.difficulty]}
                      </span>
                      {hasFunnelPublicationUrl ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-app-success-border bg-app-success-bg px-3 py-1 text-xs font-semibold text-app-success-text">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Habilitado
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold tracking-tight text-app-text">
                      {template.label}
                    </h2>
                  </div>
                </div>

                <p className="text-sm leading-7 text-app-text-muted">
                  {template.description}
                </p>

                <dl className="grid gap-3 text-sm text-app-text-muted">
                  <div className="rounded-lg border border-app-border bg-app-card px-4 py-3">
                    <dt className="font-semibold text-app-text">Objetivo</dt>
                    <dd className="mt-1 leading-6">{template.goal}</dd>
                  </div>
                  <div className="rounded-lg border border-app-border bg-app-card px-4 py-3">
                    <dt className="font-semibold text-app-text">
                      Recomendado para
                    </dt>
                    <dd className="mt-1 leading-6">
                      {template.recommendedFor}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="mt-6 space-y-3 border-t border-app-border pt-5">
                {hasFunnelPublicationUrl ? (
                  <>
                    <p className="break-all rounded-lg border border-app-success-border bg-app-success-bg px-3 py-2 text-sm font-medium text-app-success-text">
                      {template.publicUrl}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <a
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-app-accent px-4 py-2.5 text-sm font-semibold text-app-accent-contrast transition hover:opacity-90"
                        href={template.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        Ver embudo
                      </a>
                      <button
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-app-border bg-app-card px-4 py-2.5 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted"
                        type="button"
                        onClick={() =>
                          void handleCopy(
                            template.templateKey,
                            template.publicUrl!,
                          )
                        }
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                        {isCopied ? "URL copiada" : "Copiar URL"}
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-app-accent px-4 py-2.5 text-sm font-semibold text-app-accent-contrast transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                    type="button"
                    disabled={isEnabling}
                    onClick={() => void handleEnable(template.templateKey)}
                  >
                    <Rocket className="h-4 w-4" aria-hidden="true" />
                    {isEnabling ? "Habilitando..." : "Habilitar"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
