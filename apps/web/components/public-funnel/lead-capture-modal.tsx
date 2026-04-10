"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  usePathname,
  useSearchParams,
  type ReadonlyURLSearchParams,
} from "next/navigation";
import type { Country } from "react-phone-number-input";
import { cx } from "@/components/public-funnel/adapters/public-funnel-primitives";
import { SmartPhoneInput } from "@/components/public-funnel/smart-phone-input";
import { usePublicRuntimeLeadSubmit } from "@/components/public-runtime/public-runtime-lead-submit-provider";
import { jakawiPremiumClassNames } from "@/styles/templates/jakawi-premium";
import {
  getOrCreateAnonymousId,
  persistSubmissionContext,
  submitPublicLeadCapture,
} from "@/lib/public-funnel-session";
import {
  createRuntimeEventId,
  emitPublicRuntimeEvent,
  getOrCreateRuntimeSessionId,
} from "@/lib/public-runtime-tracking";

export type LeadCaptureModalConfig = {
  title: string;
  description: string;
  defaultCountry: string;
  nameLabel: string;
  namePlaceholder: string;
  nameErrorMessage?: string;
  phoneLabel: string;
  phonePlaceholder: string;
  phoneErrorMessage: string;
  ctaText: string;
  ctaSubtext?: string;
  successRedirect?: string;
};

type LeadCaptureModalProps = {
  publicationId: string;
  currentStepId: string;
  triggerLabel: string;
  triggerClassName: string;
  triggerAction?: string | null;
  modalConfig: LeadCaptureModalConfig;
  sourceChannel?: string | null;
  tags?: string[];
  renderTrigger?: boolean;
};

function readUrlAttribution(
  searchParams: URLSearchParams | ReadonlyURLSearchParams,
) {
  return {
    utmSource: searchParams.get("utm_source"),
    utmCampaign: searchParams.get("utm_campaign"),
    utmMedium: searchParams.get("utm_medium"),
    utmContent: searchParams.get("utm_content"),
    utmTerm: searchParams.get("utm_term"),
    fbclid: searchParams.get("fbclid"),
    gclid: searchParams.get("gclid"),
    ttclid: searchParams.get("ttclid"),
  };
}

const getNameValidationError = (
  value: string,
  customMessage?: string,
) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return customMessage?.trim() || "Por favor, ingresa tu nombre.";
  }

  if (trimmed.length < 2) {
    return customMessage?.trim() || "Por favor, ingresa un nombre válido.";
  }

  return null;
};

const getPhoneValidationError = (
  value: string,
  isPhoneValid: boolean,
  customMessage?: string,
) => {
  if (!value.trim() || !isPhoneValid) {
    return customMessage?.trim() || "Por favor, ingresa un número válido.";
  }

  return null;
};

const resolveLeadCaptureRedirect = (successRedirect?: string) => {
  const trimmedRedirect = successRedirect?.trim();
  if (trimmedRedirect) {
    return trimmedRedirect;
  }

  if (typeof window === "undefined") {
    return "/gracias";
  }

  const normalizedPath = window.location.pathname.replace(/\/+$/, "");
  if (!normalizedPath) {
    return "/gracias";
  }

  return normalizedPath.endsWith("/gracias")
    ? normalizedPath
    : `${normalizedPath}/gracias`;
};

export function LeadCaptureModal({
  publicationId,
  currentStepId,
  triggerLabel,
  triggerClassName,
  triggerAction,
  modalConfig,
  sourceChannel,
  tags,
  renderTrigger = true,
}: LeadCaptureModalProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const attribution = useMemo(
    () => readUrlAttribution(searchParams),
    [searchParams],
  );
  const runtimeLeadSubmit = usePublicRuntimeLeadSubmit();
  const currentNameError = getNameValidationError(
    fullName,
    modalConfig.nameErrorMessage,
  );
  const currentPhoneError = getPhoneValidationError(
    phone,
    isPhoneValid,
    modalConfig.phoneErrorMessage,
  );
  const nameError = hasAttemptedSubmit ? currentNameError : null;
  const phoneError = hasAttemptedSubmit ? currentPhoneError : null;
  const isFormReady = !currentNameError && !currentPhoneError;
  const nameErrorId = "lead-capture-name-error";

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 10);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const syncFromHash = () => {
      if (window.location.hash === "#lead-capture-modal") {
        setOpen(true);
      }
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const handleTriggerClick = () => {
    setOpen(true);

    void emitPublicRuntimeEvent({
      eventName: "cta_clicked",
      publicationId,
      stepId: currentStepId,
      anonymousId: getOrCreateAnonymousId(publicationId),
      currentPath: pathname,
      ctaLabel: triggerLabel,
      ctaHref: "#lead-capture-modal",
      ctaAction: triggerAction ?? "open_lead_capture_modal",
      metadata: {
        sessionId: getOrCreateRuntimeSessionId(),
        blockType: "lead_capture_modal",
      },
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setHasAttemptedSubmit(false);
      setSubmitError(null);
    }

    if (
      !nextOpen &&
      typeof window !== "undefined" &&
      window.location.hash === "#lead-capture-modal"
    ) {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setHasAttemptedSubmit(true);
    setSubmitError(null);

    if (!isFormReady) {
      return;
    }

    setIsSubmitting(true);

    const anonymousId = getOrCreateAnonymousId(publicationId);
    const submissionEventId = createRuntimeEventId("form_submitted");
    const leadData = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      fieldValues: {
        fullName: fullName.trim(),
        phone: phone.trim(),
      },
    };

    try {
      void emitPublicRuntimeEvent({
        eventId: submissionEventId,
        eventName: "form_submitted",
        publicationId,
        stepId: currentStepId,
        anonymousId,
        currentPath: pathname,
        metadata: {
          sessionId: getOrCreateRuntimeSessionId(),
          blockType: "lead_capture_modal",
          leadData,
          attribution,
        },
      });

      const submitLeadCapture =
        runtimeLeadSubmit?.submitLeadCapture ?? submitPublicLeadCapture;
      const response = await submitLeadCapture({
        publicationId,
        currentStepId,
        anonymousId,
        submissionEventId,
        sourceUrl:
          typeof window !== "undefined"
            ? window.location.href
            : (pathname ?? null),
        utmSource: attribution.utmSource,
        utmCampaign: attribution.utmCampaign,
        utmMedium: attribution.utmMedium,
        utmContent: attribution.utmContent,
        utmTerm: attribution.utmTerm,
        fbclid: attribution.fbclid,
        gclid: attribution.gclid,
        ttclid: attribution.ttclid,
        fullName: fullName.trim(),
        phone: phone.trim(),
        fieldValues: {
          fullName: fullName.trim(),
          phone: phone.trim(),
          source: "lead_capture_modal",
        },
        tags: ["lead-capture-modal", ...(tags ?? [])],
        sourceChannel: sourceChannel ?? "lead_capture_modal",
      });

      if (response.success === false) {
        throw new Error("No pudimos asignarte un asesor en este momento.");
      }

      persistSubmissionContext(publicationId, response);
      setOpen(false);
      window.location.assign(
        resolveLeadCaptureRedirect(modalConfig.successRedirect),
      );
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "No pudimos procesar tu solicitud en este momento.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      {renderTrigger ? (
        <Dialog.Trigger asChild>
          <button
            type="button"
            className={triggerClassName}
            onClick={handleTriggerClick}
          >
            {triggerLabel}
          </button>
        </Dialog.Trigger>
      ) : null}

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-sm" />
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 z-[90] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 outline-none ${jakawiPremiumClassNames.modalPanel}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="pr-4">
              <Dialog.Title className="text-2xl font-black tracking-tight text-slate-950">
                {modalConfig.title}
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm leading-6 text-slate-600">
                {modalConfig.description}
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form
            className="mt-6 flex w-full min-w-0 flex-col gap-4"
            onSubmit={handleSubmit}
            noValidate
          >
            <label className="grid w-full min-w-0 gap-2 text-sm font-semibold text-slate-800">
              <span>{modalConfig.nameLabel}</span>
              <input
                ref={nameInputRef}
                type="text"
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value);
                  setSubmitError(null);
                }}
                placeholder={modalConfig.namePlaceholder}
                autoComplete="name"
                required
                minLength={2}
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? nameErrorId : undefined}
                className={cx(
                  jakawiPremiumClassNames.compactInput,
                  nameError
                    ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                    : "",
                )}
              />
            </label>

            {nameError ? (
              <p id={nameErrorId} className="-mt-2 text-xs text-red-600">
                {nameError}
              </p>
            ) : null}

            <SmartPhoneInput
              label={modalConfig.phoneLabel}
              value={phone}
              onChange={(nextPhone) => {
                setPhone(nextPhone);
                setSubmitError(null);
              }}
              placeholder={modalConfig.phonePlaceholder}
              error={phoneError ?? undefined}
              invalidMessage={modalConfig.phoneErrorMessage}
              defaultCountry={modalConfig.defaultCountry as Country}
              required
              onValidityChange={setIsPhoneValid}
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className={cx(
                "mt-6 mb-2 flex w-full items-center justify-center rounded-md bg-orange-500 py-4 font-black text-white shadow-md transition-colors",
                isSubmitting
                  ? "cursor-not-allowed opacity-70"
                  : "cursor-pointer hover:bg-orange-600",
              )}
            >
              {isSubmitting ? "Procesando..." : modalConfig.ctaText}
            </button>

            {modalConfig.ctaSubtext ? (
              <p className="text-center text-xs text-slate-500">
                {modalConfig.ctaSubtext}
              </p>
            ) : null}

            {submitError ? (
              <p className="text-sm text-rose-600">{submitError}</p>
            ) : null}
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
