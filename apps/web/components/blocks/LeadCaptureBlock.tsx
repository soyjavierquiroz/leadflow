type LeadCaptureField = {
  label?: string;
  placeholder?: string;
  error_msg?: string;
  name?: string;
  field_type?: string;
  type?: string;
};

type LeadCaptureModalConfig = {
  title?: string;
  description?: string;
  fields?: unknown;
  cta_button?: {
    text?: string;
    label?: string;
    subtext?: string;
  };
  cta_text?: string;
  success_redirect?: string;
};

type LeadCaptureBlockProps = {
  modal_config?: LeadCaptureModalConfig;
  [key: string]: unknown;
};

function toFields(value: unknown): LeadCaptureField[] {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is LeadCaptureField =>
        typeof item === "object" && item !== null && !Array.isArray(item),
    );
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).filter(
      (item): item is LeadCaptureField =>
        typeof item === "object" && item !== null && !Array.isArray(item),
    );
  }

  return [];
}

export function LeadCaptureBlock(props: LeadCaptureBlockProps) {
  const modalConfig = props.modal_config;
  const title = modalConfig?.title || "Completa tus datos";
  const description =
    modalConfig?.description ||
    "Déjanos tu información para mostrarte el siguiente paso.";
  const fields = toFields(modalConfig?.fields);
  const ctaLabel =
    modalConfig?.cta_button?.text ||
    modalConfig?.cta_button?.label ||
    modalConfig?.cta_text ||
    "Continuar";

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-slate-200 border-t-4 border-t-blue-600 bg-white p-8 shadow-2xl md:p-10">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            {title}
          </h2>

          <p className="mt-4 text-base leading-7 text-slate-600">
            {description}
          </p>

          {fields.length > 0 ? (
            <div className="mt-8">
              {fields.map((field, index) => {
                const fieldLabel =
                  field.label ||
                  field.placeholder ||
                  field.name ||
                  field.field_type ||
                  field.type ||
                  `Campo ${index + 1}`;

                return (
                  <div
                    key={`${fieldLabel}-${index}`}
                    className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-400"
                  >
                    {fieldLabel}
                  </div>
                );
              })}
            </div>
          ) : null}

          <button
            type="button"
            className="mt-4 w-full rounded-xl bg-blue-600 py-4 font-bold text-white"
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
