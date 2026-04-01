"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  usePathname,
  useRouter,
  useSearchParams,
  type ReadonlyURLSearchParams,
} from "next/navigation";
import type { Country } from "react-phone-number-input";
import { SmartPhoneInput } from "@/components/public-funnel/smart-phone-input";
import {
  getOrCreateAnonymousId,
  persistSubmissionContext,
  type LeadCaptureSubmissionResponse,
  submitPublicLeadCapture,
} from "@/lib/public-funnel-session";
import {
  createRuntimeEventId,
  emitPublicRuntimeEvent,
  getOrCreateRuntimeSessionId,
} from "@/lib/public-runtime-tracking";

type LeadCaptureModalConfig = {
  title: string;
  description: string;
  defaultCountry: string;
  nameLabel: string;
  namePlaceholder: string;
  phoneLabel: string;
  phonePlaceholder: string;
  phoneErrorMessage: string;
  ctaText: string;
  ctaSubtext?: string;
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
};

function readUrlAttribution(searchParams: URLSearchParams | ReadonlyURLSearchParams) {
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

const resolveAssignedAdvisor = (response: LeadCaptureSubmissionResponse) => {
  if (response.advisor) {
    return response.advisor;
  }

  if (response.assigned_advisor) {
    return {
      name: response.assigned_advisor.name,
      phone: response.assigned_advisor.phone,
      photoUrl: response.assigned_advisor.photo_url,
      bio: response.assigned_advisor.bio,
      whatsappUrl: response.handoff.whatsappUrl,
    };
  }

  if (response.assignment?.sponsor) {
    return {
      name: response.assignment.sponsor.displayName,
      phone: response.assignment.sponsor.phone,
      photoUrl: response.assignment.sponsor.avatarUrl,
      bio: "Especialista en Protocolos de Recuperación",
      whatsappUrl: response.handoff.whatsappUrl,
    };
  }

  return null;
};

const appendAdvisorQueryParams = (
  nextUrl: URL,
  advisor: NonNullable<ReturnType<typeof resolveAssignedAdvisor>>,
) => {
  nextUrl.searchParams.set("advisor", advisor.name);
  nextUrl.searchParams.set("advisor_name", advisor.name);

  if (advisor.phone) {
    nextUrl.searchParams.set("advisor_phone", advisor.phone);
  }

  if (advisor.photoUrl) {
    nextUrl.searchParams.set("advisor_photo", advisor.photoUrl);
  }

  if (advisor.bio) {
    nextUrl.searchParams.set("advisor_bio", advisor.bio);
  }

  if (advisor.whatsappUrl) {
    nextUrl.searchParams.set("advisor_whatsapp", advisor.whatsappUrl);
  }
};

const appendAssignmentQueryParams = (
  nextUrl: URL,
  response: LeadCaptureSubmissionResponse,
) => {
  if (response.assignment?.id) {
    nextUrl.searchParams.set("assignment_id", response.assignment.id);
  }

  if (response.assignment?.sponsor.id) {
    nextUrl.searchParams.set("sponsor_id", response.assignment.sponsor.id);
  }
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
}: LeadCaptureModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const attribution = useMemo(
    () => readUrlAttribution(searchParams),
    [searchParams],
  );
  const isFormReady = fullName.trim().length > 1 && isPhoneValid;

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isFormReady || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

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

      const response = await submitPublicLeadCapture({
        publicationId,
        currentStepId,
        anonymousId,
        submissionEventId,
        sourceUrl:
          typeof window !== "undefined" ? window.location.href : pathname ?? null,
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

      if (response.nextStep?.path) {
        const assignedAdvisor = resolveAssignedAdvisor(response);
        const nextUrl = new URL(
          response.nextStep.path,
          typeof window !== "undefined" ? window.location.origin : "https://leadflow.local",
        );

        if (assignedAdvisor?.name) {
          appendAdvisorQueryParams(nextUrl, assignedAdvisor);
        }

        appendAssignmentQueryParams(nextUrl, response);

        router.push(`${nextUrl.pathname}${nextUrl.search}`);
        return;
      }

      if (response.handoff.whatsappUrl) {
        window.location.href = response.handoff.whatsappUrl;
      }
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
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={triggerClassName} onClick={handleTriggerClick}>
          {triggerLabel}
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-white/80 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.35)] outline-none md:p-7">
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

          <form className="mt-6 flex w-full min-w-0 flex-col gap-4" onSubmit={handleSubmit}>
            <label className="grid w-full min-w-0 gap-2 text-sm font-semibold text-slate-800">
              <span>{modalConfig.nameLabel}</span>
              <input
                ref={nameInputRef}
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder={modalConfig.namePlaceholder}
                autoComplete="name"
                required
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </label>

            <SmartPhoneInput
              label={modalConfig.phoneLabel}
              value={phone}
              onChange={setPhone}
              placeholder={modalConfig.phonePlaceholder}
              invalidMessage={modalConfig.phoneErrorMessage}
              defaultCountry={modalConfig.defaultCountry as Country}
              required
              onValidityChange={setIsPhoneValid}
            />

            <button
              type="submit"
              disabled={!isFormReady || isSubmitting}
              className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-emerald-600 px-6 py-4 text-center text-base font-black uppercase tracking-tight text-white shadow-[0_12px_28px_rgba(5,150,105,0.28)] transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Enviando..." : modalConfig.ctaText}
            </button>

            {modalConfig.ctaSubtext ? (
              <p className="-mt-1 text-center text-xs text-slate-500">
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
