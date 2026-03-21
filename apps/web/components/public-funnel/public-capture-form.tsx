"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

type PublicCaptureFormProps = {
  publicationId: string;
  currentStepId: string;
  fields: string[];
  title: string;
  description?: string;
};

type FormFieldKey = "fullName" | "phone" | "email" | "companyName";

type ResolvedField = {
  key: FormFieldKey;
  label: string;
  type: "text" | "email" | "tel";
  placeholder: string;
};

const detectFieldKey = (label: string): FormFieldKey | null => {
  const normalized = label.trim().toLowerCase();

  if (
    normalized.includes("nombre") ||
    normalized.includes("name") ||
    normalized.includes("contacto")
  ) {
    return "fullName";
  }

  if (
    normalized.includes("whatsapp") ||
    normalized.includes("telefono") ||
    normalized.includes("teléfono") ||
    normalized.includes("phone") ||
    normalized.includes("celular")
  ) {
    return "phone";
  }

  if (normalized.includes("email") || normalized.includes("correo")) {
    return "email";
  }

  if (
    normalized.includes("empresa") ||
    normalized.includes("company") ||
    normalized.includes("negocio")
  ) {
    return "companyName";
  }

  return null;
};

const buildResolvedFields = (fields: string[]): ResolvedField[] => {
  const requestedFields = fields
    .map((field) => {
      const key = detectFieldKey(field);
      if (!key) {
        return null;
      }

      return {
        key,
        label: field,
        type: key === "email" ? "email" : key === "phone" ? "tel" : "text",
        placeholder: field,
      } satisfies ResolvedField;
    })
    .filter((field): field is ResolvedField => Boolean(field));

  const uniqueFields = requestedFields.filter(
    (field, index, collection) =>
      collection.findIndex((item) => item.key === field.key) === index,
  );

  if (uniqueFields.length > 0) {
    return uniqueFields;
  }

  return [
    {
      key: "fullName",
      label: "Nombre completo",
      type: "text",
      placeholder: "Nombre completo",
    },
    {
      key: "phone",
      label: "WhatsApp",
      type: "tel",
      placeholder: "WhatsApp",
    },
    {
      key: "email",
      label: "Email",
      type: "email",
      placeholder: "Email",
    },
  ];
};

export function PublicCaptureForm({
  publicationId,
  currentStepId,
  fields,
  title,
  description,
}: PublicCaptureFormProps) {
  const router = useRouter();
  const resolvedFields = useMemo(() => buildResolvedFields(fields), [fields]);
  const [values, setValues] = useState<Record<FormFieldKey, string>>({
    fullName: "",
    phone: "",
    email: "",
    companyName: "",
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasTrackedFormStart, setHasTrackedFormStart] = useState(false);

  const updateValue = (key: FormFieldKey, value: string) => {
    setValues((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const trackFormStarted = (fieldKey: FormFieldKey) => {
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
      currentPath:
        typeof window !== "undefined" ? window.location.pathname : null,
      metadata: {
        sessionId: getOrCreateRuntimeSessionId(),
        firstField: fieldKey,
      },
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const fullName = values.fullName.trim();
    const phone = values.phone.trim();
    const email = values.email.trim();
    const companyName = values.companyName.trim();

    if (!fullName) {
      setErrorMessage("Necesitamos al menos el nombre para capturar el lead.");
      return;
    }

    if (!phone && !email) {
      setErrorMessage("Incluye WhatsApp o email para poder enrutar el lead.");
      return;
    }

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
        currentPath:
          typeof window !== "undefined" ? window.location.pathname : null,
        metadata: {
          sessionId: getOrCreateRuntimeSessionId(),
          hasPhone: Boolean(phone),
          hasEmail: Boolean(email),
        },
      });

      const response = await submitPublicLeadCapture({
        publicationId,
        currentStepId,
        anonymousId,
        submissionEventId,
        fullName,
        phone: phone || null,
        email: email || null,
        companyName: companyName || null,
      });

      persistSubmissionContext(publicationId, response);
      setSuccessMessage(
        response.assignment?.sponsor.displayName
          ? `Lead capturado y asignado a ${response.assignment.sponsor.displayName}.`
          : "Lead capturado correctamente.",
      );

      if (response.nextStep?.path) {
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
    <section className="rounded-[1.75rem] border border-teal-200 bg-teal-50/90 p-8 shadow-[0_18px_50px_rgba(13,148,136,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            {title || "Captura de lead"}
          </h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
              {description}
            </p>
          ) : null}
        </div>
        <div className="rounded-full border border-teal-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
          Lead capture v1
        </div>
      </div>

      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          {resolvedFields.map((field) => (
            <label
              key={field.key}
              className="grid gap-2 text-sm font-medium text-slate-700"
            >
              {field.label}
              <input
                className="rounded-2xl border border-teal-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500"
                type={field.type}
                value={values[field.key]}
                onChange={(event) => updateValue(field.key, event.target.value)}
                onFocus={() => trackFormStarted(field.key)}
                placeholder={field.placeholder}
                autoComplete={
                  field.key === "fullName"
                    ? "name"
                    : field.key === "phone"
                      ? "tel"
                      : field.key === "email"
                        ? "email"
                        : "organization"
                }
              />
            </label>
          ))}
        </div>

        {errorMessage ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Enviando..." : "Enviar y continuar"}
          </button>
          <p className="text-sm text-slate-600">
            Capturamos el lead, resolvemos assignment y avanzamos al siguiente
            step si existe.
          </p>
        </div>
      </form>
    </section>
  );
}
