"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  usePathname,
  useSearchParams,
  type ReadonlyURLSearchParams,
} from "next/navigation";
import type { Country } from "react-phone-number-input";
import {
  FunnelButtonContent,
  RichHeadline,
  captureModalPrimaryButtonClassName,
  cx,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
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
  triggerSubtext?: string | null;
  triggerClassName: string;
  triggerAction?: string | null;
  modalConfig: LeadCaptureModalConfig;
  sourceChannel?: string | null;
  tags?: string[];
  renderTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (nextOpen: boolean) => void;
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

const captureModalScopeStyle = {
  "--jakawi-text-main": "var(--theme-section-capture-modal-text-color)",
  "--jakawi-text-muted": "var(--theme-text-caption-color)",
  "--jakawi-input-border": "var(--theme-base-divider)",
  "--jakawi-input-focus": "var(--theme-brand-trust)",
  "--jakawi-input-ring":
    "color-mix(in srgb, var(--theme-brand-trust) 18%, transparent)",
} as CSSProperties & Record<string, string>;

export function LeadCaptureModal({
  publicationId,
  currentStepId,
  triggerLabel,
  triggerSubtext,
  triggerClassName,
  triggerAction,
  modalConfig,
  sourceChannel,
  tags,
  renderTrigger = true,
  open: controlledOpen,
  onOpenChange,
}: LeadCaptureModalProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
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
  const open = controlledOpen ?? internalOpen;
  const nameError = hasAttemptedSubmit ? currentNameError : null;
  const phoneError = hasAttemptedSubmit ? currentPhoneError : null;
  const isFormReady = !currentNameError && !currentPhoneError;
  const nameErrorId = "lead-capture-name-error";

  useEffect(() => {
    setMounted(true);
  }, []);

  const setModalOpen = (nextOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(nextOpen);
      return;
    }

    setInternalOpen(nextOpen);
  };

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
        setModalOpen(true);
      }
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const handleTriggerClick = () => {
    setModalOpen(true);

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
    setModalOpen(nextOpen);

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

  const closeModal = useEffectEvent(() => {
    handleOpenChange(false);
  });

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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
      setModalOpen(false);
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

  const modalContent =
    open && mounted && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 2147483647 }}
          >
            <div
              className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm"
              style={{
                background:
                  "var(--theme-section-capture-modal-overlay-bg, rgb(15 23 42 / 0.9))",
                backdropFilter:
                  "blur(var(--theme-section-capture-modal-overlay-blur, 4px))",
              }}
              onClick={() => handleOpenChange(false)}
              aria-hidden="true"
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="lead-capture-modal-title"
              aria-describedby="lead-capture-modal-description"
              className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-xl border bg-white p-6 shadow-2xl outline-none animate-in fade-in zoom-in-95 duration-200 md:p-8 [background:var(--theme-section-capture-modal-bg)] [border-color:var(--theme-section-capture-modal-border)] [border-radius:var(--theme-section-capture-modal-radius)] shadow-[var(--theme-section-capture-modal-shadow)]"
              style={captureModalScopeStyle}
            >
              <div className="absolute inset-x-0 top-0 h-1.5 bg-slate-100">
                <div
                  className="h-full w-4/5 rounded-r-full bg-[var(--theme-support-validation)]"
                  aria-hidden="true"
                />
              </div>

              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="absolute right-4 top-4 z-10 text-2xl font-bold text-slate-400 transition hover:text-slate-800"
                aria-label="Cerrar"
              >
                ✕
              </button>

              <div className="mt-2">
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--theme-support-validation)]">
                    Paso 2 de 2: Casi terminado
                  </p>
                  <div id="lead-capture-modal-title" className="mt-4 text-center">
                    <RichHeadline
                      text={modalConfig.title}
                      className="block font-headline text-2xl font-black tracking-tight [color:var(--theme-section-capture-modal-headline-color)]"
                    />
                  </div>
                  <div
                    id="lead-capture-modal-description"
                    className="mt-3 text-center leading-6 [color:var(--theme-section-capture-modal-text-color)]"
                  >
                    <RichHeadline
                      text={modalConfig.description}
                      className="block text-sm"
                      fontClassName=""
                    />
                  </div>
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
                      captureModalPrimaryButtonClassName,
                      "mt-6 w-full",
                      modalConfig.ctaSubtext ? "flex-col items-center justify-center" : "",
                      isSubmitting
                        ? "cursor-not-allowed opacity-70"
                        : "cursor-pointer",
                    )}
                  >
                    <FunnelButtonContent
                      text={isSubmitting ? "Procesando..." : modalConfig.ctaText}
                      subtext={isSubmitting ? undefined : modalConfig.ctaSubtext}
                    />
                  </button>

                  <p className="mt-4 text-center text-xs [color:var(--theme-section-capture-modal-text-color)] opacity-60">
                    🔒 Tu información está 100% segura y libre de spam.
                  </p>

                  {submitError ? (
                    <p className="text-center text-sm text-rose-600">
                      {submitError}
                    </p>
                  ) : null}
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {renderTrigger ? (
        <button
          type="button"
          className={cx(
            triggerClassName,
            triggerSubtext ? "flex-col items-center justify-center" : "",
          )}
          onClick={handleTriggerClick}
        >
          <FunnelButtonContent text={triggerLabel} subtext={triggerSubtext} />
        </button>
      ) : null}

      {modalContent}
    </>
  );
}
