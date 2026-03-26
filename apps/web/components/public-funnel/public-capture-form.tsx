"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  buildCtaClassName,
  PublicChecklistItem,
  PublicEyebrow,
  PublicPill,
  PublicSectionSurface,
  cx,
} from "@/components/public-funnel/adapters/public-funnel-primitives";
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
    <PublicSectionSurface
      id="public-capture-form"
      tone="success"
      className="scroll-mt-8"
    >
      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <div>
          <PublicEyebrow tone="success">Paso de conversión</PublicEyebrow>
          <div className="mt-4 flex flex-wrap gap-2">
            <PublicPill tone="success">Menos de 1 minuto</PublicPill>
            <PublicPill>Seguimiento con contexto</PublicPill>
          </div>

          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
            {title || "Captura de lead"}
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">
            {description ||
              "Déjanos tus datos y pasamos al siguiente punto del funnel sin perder el hilo comercial ni la trazabilidad operativa."}
          </p>

          <div className="mt-7 grid gap-3">
            {[
              "Capturamos tu lead en la publicación activa y conservamos la sesión.",
              "Resolvemos assignment sin sacar al usuario del flujo.",
              "Mostramos el thank-you o reveal listo para continuar el handoff.",
            ].map((item) => (
              <PublicChecklistItem key={item} accent="success">
                {item}
              </PublicChecklistItem>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-emerald-200 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
                Lo mínimo necesario
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Nombre y un canal de contacto. Con eso ya podemos capturar y
                mover la oportunidad sin fricción.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Qué evitamos
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Formularios largos, ruido técnico y mensajes ambiguos antes de
                pedir el siguiente paso.
              </p>
            </div>
          </div>
        </div>

        <form
          className="grid gap-5 rounded-[1.9rem] border border-white/80 bg-white/92 p-6 shadow-[0_18px_55px_rgba(15,23,42,0.08)]"
          onSubmit={handleSubmit}
        >
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              Datos de contacto
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Completa al menos nombre y un dato de contacto para avanzar con el
              reveal o el siguiente step.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {resolvedFields.map((field) => (
              <label
                key={field.key}
                className={cx(
                  "grid gap-2 text-sm font-medium text-slate-700",
                  field.key === "fullName" ? "md:col-span-2" : "",
                )}
              >
                <span className="flex items-center justify-between gap-3">
                  <span>{field.label}</span>
                  {field.key === "fullName" ? (
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      requerido
                    </span>
                  ) : null}
                </span>
                <input
                  className="rounded-[1.15rem] border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
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
                  inputMode={
                    field.key === "phone"
                      ? "tel"
                      : field.key === "email"
                        ? "email"
                        : "text"
                  }
                />
              </label>
            ))}
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

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
            Priorizamos claridad: pedimos poco, conservamos el contexto del
            funnel y dejamos listo el siguiente paso comercial.
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
              {isSubmitting ? "Enviando..." : "Quiero continuar"}
            </button>
            <p className="max-w-sm text-sm leading-6 text-slate-600">
              Capturamos el lead, resolvemos assignment y avanzamos al siguiente
              step cuando corresponda.
            </p>
          </div>
        </form>
      </div>
    </PublicSectionSurface>
  );
}
