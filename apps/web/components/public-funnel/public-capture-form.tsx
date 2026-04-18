"use client";

import { useMemo, useState } from "react";
import {
  usePathname,
  useRouter,
  useSearchParams,
  type ReadonlyURLSearchParams,
} from "next/navigation";
import {
  buildCtaClassName,
  PublicChecklistItem,
  PublicEyebrow,
  PublicPill,
  PublicSectionSurface,
  cx,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
import { usePublicRuntimeLeadSubmit } from "@/components/public-runtime/public-runtime-lead-submit-provider";
import { jakawiPremiumClassNames } from "@/styles/templates/jakawi-premium";
import {
  getOrCreateAnonymousId,
  readSubmissionContext,
  persistSubmissionContext,
  submitPublicLeadCapture,
} from "@/lib/public-funnel-session";
import {
  createRuntimeEventId,
  emitPublicRuntimeEvent,
  getOrCreateRuntimeSessionId,
} from "@/lib/public-runtime-tracking";
import type {
  RuntimeLeadCaptureField,
  RuntimeLeadCaptureFormBlock,
} from "@/components/public-funnel/runtime-block-utils";
import { resolveKnownLeadFieldName } from "@/components/public-funnel/runtime-block-utils";
import type { PublicRuntimeEntryContext } from "@/lib/public-funnel-runtime.types";

type PublicCaptureFormProps = {
  publicationId: string;
  currentStepId: string;
  block: RuntimeLeadCaptureFormBlock;
  runtimeEntryContext: PublicRuntimeEntryContext;
  sectionId?: string;
  isBoxed?: boolean;
};

type UrlAttribution = {
  utmSource: string | null;
  utmCampaign: string | null;
  utmMedium: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  fbclid: string | null;
  gclid: string | null;
  ttclid: string | null;
};

const getFieldClassName = (field: RuntimeLeadCaptureField) => {
  switch (field.width) {
    case "half":
      return "md:col-span-1";
    case "third":
      return "md:col-span-1 xl:col-span-1";
    default:
      return "md:col-span-2";
  }
};

const readUrlAttribution = (
  searchParams: ReadonlyURLSearchParams,
): UrlAttribution => ({
  utmSource: searchParams.get("utm_source"),
  utmCampaign: searchParams.get("utm_campaign"),
  utmMedium: searchParams.get("utm_medium"),
  utmContent: searchParams.get("utm_content"),
  utmTerm: searchParams.get("utm_term"),
  fbclid: searchParams.get("fbclid"),
  gclid: searchParams.get("gclid"),
  ttclid: searchParams.get("ttclid"),
});

const getDefaultFieldValue = (
  field: RuntimeLeadCaptureField,
  attribution: UrlAttribution,
) => {
  if (field.defaultValue) {
    return field.defaultValue;
  }

  const normalizedName = field.name.trim().toLowerCase();

  switch (normalizedName) {
    case "utm_source":
      return attribution.utmSource ?? "";
    case "utm_campaign":
      return attribution.utmCampaign ?? "";
    case "utm_medium":
      return attribution.utmMedium ?? "";
    case "utm_content":
      return attribution.utmContent ?? "";
    case "utm_term":
      return attribution.utmTerm ?? "";
    case "fbclid":
      return attribution.fbclid ?? "";
    case "gclid":
      return attribution.gclid ?? "";
    case "ttclid":
      return attribution.ttclid ?? "";
    default:
      return "";
  }
};

const buildInitialValues = (
  fields: RuntimeLeadCaptureField[],
  attribution: UrlAttribution,
) => {
  return fields.reduce<Record<string, string>>((accumulator, field) => {
    accumulator[field.name] = getDefaultFieldValue(field, attribution);
    return accumulator;
  }, {});
};

const getCoreLeadValue = (values: Record<string, string>, name: string) => {
  const normalized = resolveKnownLeadFieldName(name);
  const directValue = values[name];

  if (typeof directValue === "string") {
    return directValue.trim();
  }

  const matchingEntry = Object.entries(values).find(
    ([key]) => resolveKnownLeadFieldName(key) === normalized,
  );

  return matchingEntry?.[1]?.trim() ?? "";
};

const buildFieldValuesPayload = (values: Record<string, string>) => {
  return Object.entries(values).reduce<Record<string, string | null>>(
    (accumulator, [key, value]) => {
      accumulator[key] = value.trim() ? value.trim() : null;
      return accumulator;
    },
    {},
  );
};

const validateConfiguredFields = (
  fields: RuntimeLeadCaptureField[],
  values: Record<string, string>,
) => {
  const missingField = fields.find((field) => {
    if (field.hidden || !field.required) {
      return false;
    }

    return !values[field.name]?.trim();
  });

  if (missingField) {
    return `Completa el campo ${missingField.label} para continuar.`;
  }

  const fullName = getCoreLeadValue(values, "fullName");
  const phone = getCoreLeadValue(values, "phone");
  const email = getCoreLeadValue(values, "email");

  if (!fullName) {
    return "Necesitamos al menos el nombre para capturar el lead.";
  }

  if (!phone && !email) {
    return "Incluye WhatsApp o email para poder enrutar el lead.";
  }

  return null;
};

export function PublicCaptureForm({
  publicationId,
  currentStepId,
  block,
  runtimeEntryContext,
  sectionId = "public-capture-form",
  isBoxed = false,
}: PublicCaptureFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlAttribution = useMemo(
    () => readUrlAttribution(searchParams),
    [searchParams],
  );
  const visibleFields = useMemo(
    () => block.fields.filter((field) => !field.hidden),
    [block.fields],
  );
  const runtimeLeadSubmit = usePublicRuntimeLeadSubmit();
  const [values, setValues] = useState<Record<string, string>>(() =>
    buildInitialValues(block.fields, urlAttribution),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasTrackedFormStart, setHasTrackedFormStart] = useState(false);
  const variant = block.variant ?? "conversion_card";

  const updateValue = (key: string, value: string) => {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const trackFormStarted = (fieldName: string) => {
    if (hasTrackedFormStart) {
      return;
    }

    setHasTrackedFormStart(true);
    const anonymousId = getOrCreateAnonymousId(publicationId);
    const submissionContext = readSubmissionContext(publicationId);

    void emitPublicRuntimeEvent({
      eventName: "form_started",
      publicationId,
      stepId: currentStepId,
      anonymousId,
      visitorId: submissionContext?.visitorId ?? null,
      leadId: submissionContext?.leadId ?? null,
      currentPath: pathname,
      metadata: {
        sessionId: getOrCreateRuntimeSessionId(),
        firstField: fieldName,
        blockType: "lead_capture_form",
      },
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const validationError = validateConfiguredFields(block.fields, values);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const fullName = getCoreLeadValue(values, "fullName");
    const phone = getCoreLeadValue(values, "phone");
    const email = getCoreLeadValue(values, "email");
    const companyName = getCoreLeadValue(values, "companyName");
    const fieldValues = buildFieldValuesPayload(values);

    setIsSubmitting(true);

    try {
      const anonymousId = getOrCreateAnonymousId(publicationId);
      const submissionEventId = createRuntimeEventId("form_submitted");

      void emitPublicRuntimeEvent({
        eventId: submissionEventId,
        eventName: "form_submitted",
        publicationId,
        stepId: currentStepId,
        anonymousId,
        currentPath: pathname,
        metadata: {
          sessionId: getOrCreateRuntimeSessionId(),
          blockType: "lead_capture_form",
          hasPhone: Boolean(phone),
          hasEmail: Boolean(email),
          configuredFields: block.fields.map((field) => field.name),
          fieldValues,
          attribution: urlAttribution,
        },
      });

      const submitLeadCapture =
        runtimeLeadSubmit?.submitLeadCapture ?? submitPublicLeadCapture;
      const response = await submitLeadCapture({
        publicationId,
        currentStepId,
        anonymousId,
        entryContext: runtimeEntryContext,
        submissionEventId,
        sourceUrl:
          typeof window !== "undefined" ? window.location.href : pathname ?? null,
        utmSource: block.settings.captureUrlContext ? urlAttribution.utmSource : null,
        utmCampaign: block.settings.captureUrlContext
          ? urlAttribution.utmCampaign
          : null,
        utmMedium: block.settings.captureUrlContext ? urlAttribution.utmMedium : null,
        utmContent: block.settings.captureUrlContext
          ? urlAttribution.utmContent
          : null,
        utmTerm: block.settings.captureUrlContext ? urlAttribution.utmTerm : null,
        fbclid: block.settings.captureUrlContext ? urlAttribution.fbclid : null,
        gclid: block.settings.captureUrlContext ? urlAttribution.gclid : null,
        ttclid: block.settings.captureUrlContext ? urlAttribution.ttclid : null,
        fullName,
        phone: phone || null,
        email: email || null,
        companyName: companyName || null,
        fieldValues,
        tags: block.settings.tags,
        sourceChannel: block.settings.sourceChannel,
      });

      persistSubmissionContext(publicationId, response);
      setSuccessMessage(
        block.settings.successMessage ??
          (response.assignment?.sponsor.displayName
            ? `Lead capturado y asignado a ${response.assignment.sponsor.displayName}.`
            : "Lead capturado correctamente."),
      );

      if (block.successMode === "next_step" && response.nextStep?.path) {
        router.push(response.nextStep.path);
        return;
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No pudimos capturar el lead en este momento.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PublicSectionSurface
      id={sectionId}
      isBoxed={isBoxed}
      surfaceSlot="capture-form"
      tone="success"
      className={cx(
        "scroll-mt-8",
        variant === "compact_capture" ? "md:p-6" : "",
      )}
    >
      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <div>
          <PublicEyebrow tone="success">{block.eyebrow}</PublicEyebrow>
          <div className="mt-4 flex flex-wrap gap-2">
            <PublicPill tone="success">
              {variant === "compact_capture"
                ? "Captura compacta"
                : "Captura conectada al runtime"}
            </PublicPill>
            <PublicPill>
              {variant === "compact_capture"
                ? "Preset opportunity"
                : "Submit declarativo"}
            </PublicPill>
          </div>

          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            {block.headline}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">
            {block.subheadline}
          </p>

          {variant === "compact_capture" ? (
            <div className="mt-7 text-sm leading-6 text-slate-700">
              Captura rápida, contexto de URL conservado y continuidad automática
              al siguiente step cuando el runtime lo define.
            </div>
          ) : (
            <div className="mt-7 grid gap-3">
              {[
                "El submit sigue usando el motor estándar del runtime.",
                "El bloque absorbe contexto de URL y valores declarativos sin lógica hardcodeada por funnel.",
                "El reveal y el handoff posterior conservan la continuidad definida en el JSON.",
              ].map((item) => (
                <PublicChecklistItem key={item} accent="success">
                  {item}
                </PublicChecklistItem>
              ))}
            </div>
          )}
        </div>

        <form
          className="grid gap-5 p-2"
          onSubmit={handleSubmit}
        >
          <div className="p-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Datos de contacto
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {block.helperText}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleFields.map((field) => {
              const sharedClassName = jakawiPremiumClassNames.input;

              return (
                <label
                  key={field.name}
                  className={cx(
                    "grid gap-2 text-sm font-medium text-slate-700",
                    getFieldClassName(field),
                  )}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span>{field.label}</span>
                    {field.required ? (
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        requerido
                      </span>
                    ) : null}
                  </span>

                  {field.type === "textarea" ? (
                    <textarea
                      className={sharedClassName}
                      value={values[field.name] ?? ""}
                      onChange={(event) =>
                        updateValue(field.name, event.target.value)
                      }
                      onFocus={() => trackFormStarted(field.name)}
                      placeholder={field.placeholder}
                      autoComplete={field.autocomplete}
                      rows={4}
                    />
                  ) : field.type === "select" ? (
                    <select
                      className={sharedClassName}
                      value={values[field.name] ?? ""}
                      onChange={(event) =>
                        updateValue(field.name, event.target.value)
                      }
                      onFocus={() => trackFormStarted(field.name)}
                      autoComplete={field.autocomplete}
                    >
                      <option value="">
                        {field.placeholder || "Selecciona una opción"}
                      </option>
                      {field.options.map((option) => (
                        <option key={`${field.name}-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={sharedClassName}
                      type={field.type}
                      value={values[field.name] ?? ""}
                      onChange={(event) =>
                        updateValue(field.name, event.target.value)
                      }
                      onFocus={() => trackFormStarted(field.name)}
                      placeholder={field.placeholder}
                      autoComplete={field.autocomplete}
                      inputMode={
                        field.type === "tel"
                          ? "tel"
                          : field.type === "email"
                            ? "email"
                            : "text"
                      }
                    />
                  )}
                </label>
              );
            })}
          </div>

          {errorMessage ? (
            <p className="rounded-[1.15rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="rounded-[1.15rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {successMessage}
            </p>
          ) : null}

          <div className="text-sm leading-6 text-slate-700">
            {block.privacyNote}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="submit"
              disabled={isSubmitting}
              className={cx(
                buildCtaClassName("primary"),
                "min-w-[12rem] disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {isSubmitting ? "Enviando..." : block.buttonText}
            </button>
            <p className="max-w-sm text-sm leading-6 text-slate-600">
              {block.successMode === "inline_message"
                ? "El bloque confirma inline cuando termina correctamente."
                : "Si existe next step, el runtime continúa automáticamente."}
            </p>
          </div>
        </form>
      </div>
    </PublicSectionSurface>
  );
}
