type StepByStepBlockProps = {
  steps?: unknown[];
  items?: unknown[];
  sequence?: unknown[];
  cards?: unknown[];
  [key: string]: unknown;
};

function normalizeSteps(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => {
      if (typeof value === "string") {
        return value;
      }

      if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;

        return [
          record.content,
          record.text,
          record.description,
          record.title,
          record.label,
          record.headline,
          record.name,
        ].find((entry) => typeof entry === "string");
      }

      return null;
    })
    .filter((value): value is string => Boolean(value?.trim()));
}

export function StepByStepBlock(props: StepByStepBlockProps) {
  const primarySteps = normalizeSteps(props.steps);
  const steps =
    primarySteps.length > 0
      ? primarySteps
      : [
          ...normalizeSteps(props.items),
          ...normalizeSteps(props.sequence),
          ...normalizeSteps(props.cards),
        ];

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Cómo funciona
        </h2>

        {steps.length > 0 ? (
          <div className="mt-8 grid grid-cols-1 gap-6">
            {steps.map((step, index) => (
              <article
                key={`${step}-${index}`}
                className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm"
              >
                <p className="text-lg leading-8 text-slate-700">{step}</p>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
