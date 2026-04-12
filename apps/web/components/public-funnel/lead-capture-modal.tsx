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
  cx,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import { SmartPhoneInput } from "@/components/public-funnel/smart-phone-input";
import { usePublicRuntimeLeadSubmit } from "@/components/public-runtime/public-runtime-lead-submit-provider";
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
  "--jakawi-text-main": "#0f172a",
  "--jakawi-text-muted": "#64748b",
  "--jakawi-input-border": "#cbd5e1",
  "--jakawi-input-focus": "var(--theme-action-cta)",
  "--jakawi-input-ring":
    "color-mix(in srgb, var(--theme-action-cta) 24%, transparent)",
} as CSSProperties & Record<string, string>;

const modalTextInputClassName =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-lg text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[var(--theme-action-cta)] focus:ring-1 focus:ring-[var(--theme-action-cta)]";

const getModalCtaLabel = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed) {
    return "QUIERO VER EL SISTEMA >>";
  }

  return trimmed.includes(">>") ? trimmed : `${trimmed} >>`;
};

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
              className="relative w-full max-w-md bg-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.2)] p-6 md:p-8 border border-slate-100 overflow-hidden outline-none animate-in fade-in zoom-in-95 duration-200"
              style={captureModalScopeStyle}
            >
              <div className="max-h-[calc(100vh-2rem)] overflow-y-auto">
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors z-50"
                  aria-label="Cerrar"
                >
                  ✕
                </button>

                <div className="mt-2">
                  <div className="text-center text-slate-900">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-red-600">
                      Paso 2 de 2: ¡Casi listo!
                    </p>
                    <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full w-[85%] rounded-full bg-[var(--theme-action-cta)]"
                        aria-hidden="true"
                      />
                    </div>
                    <div
                      id="lead-capture-modal-title"
                      className="mt-4 mb-2 text-center text-slate-900"
                    >
                      <RichHeadline
                        text={modalConfig.title}
                        className="block text-2xl font-extrabold tracking-tight"
                      />
                    </div>
                    <div
                      id="lead-capture-modal-description"
                      className="mb-6 text-center text-slate-600 text-sm leading-6"
                    >
                      <RichHeadline
                        text={modalConfig.description}
                        className="block"
                        fontClassName=""
                      />
                    </div>
                    <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm font-medium text-amber-600">
                      ⚠️ Tu lugar está reservado por los próximos 5 minutos.
                    </p>
                  </div>

                  <form
                    className="flex w-full min-w-0 flex-col gap-4"
                    onSubmit={handleSubmit}
                    noValidate
                  >
                    <label className="grid w-full min-w-0 gap-2 text-sm font-bold text-slate-900">
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
                          modalTextInputClassName,
                          nameError
                            ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-200"
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
                      labelClassName="text-sm font-bold text-slate-900"
                      phoneInputClassName="rounded-xl border-slate-200 bg-slate-50 text-slate-900 focus-within:border-[var(--theme-action-cta)] focus-within:ring-1 focus-within:ring-[var(--theme-action-cta)] [&_.PhoneInputInput]:bg-slate-50 [&_.PhoneInputInput]:px-4 [&_.PhoneInputInput]:py-3 [&_.PhoneInputInput]:text-lg [&_.PhoneInputInput]:text-slate-900 [&_.PhoneInputInput]:placeholder:text-slate-400 [&_.PhoneInputCountry]:bg-slate-50 [&_.PhoneInputCountry]:text-slate-900 [&_.PhoneInputCountry>span]:text-slate-900"
                    />

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={cx(
                        "mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[var(--theme-action-cta)] px-6 py-4 text-center text-xl font-extrabold uppercase text-white shadow-[0_10px_20px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-action-cta)]",
                        modalConfig.ctaSubtext ? "flex-col gap-1" : "",
                        isSubmitting
                          ? "cursor-not-allowed opacity-70"
                          : "cursor-pointer",
                      )}
                    >
                      <FunnelButtonContent
                        text={
                          isSubmitting
                            ? "Procesando..."
                            : getModalCtaLabel(modalConfig.ctaText)
                        }
                        subtext={isSubmitting ? undefined : modalConfig.ctaSubtext}
                      />
                    </button>

                    <p className="mt-3 flex items-center justify-center gap-1 text-xs text-slate-500">
                      <span aria-hidden="true">🔒</span>
                      <span>Tu información está 100% encriptada y segura.</span>
                    </p>

                    {submitError ? (
                      <p className="text-center text-sm text-rose-600">
                        {submitError}
                      </p>
                    ) : null}
                  </form>
                </div>
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
