type UniqueMechanismBlockProps = {
  headline?: string;
  title?: string;
  description?: string;
  mechanism_name?: string;
  highlights?: unknown[];
  items?: unknown[];
  [key: string]: unknown;
};

function getHighlightText(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const text = [
      record.text,
      record.description,
      record.title,
      record.label,
      record.headline,
      record.name,
      record.benefit,
      record.feature,
    ].find((entry) => typeof entry === "string");

    return typeof text === "string" && text.trim() ? text : null;
  }

  return null;
}

function toHighlightList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => getHighlightText(value))
    .filter((value): value is string => Boolean(value));
}

export function UniqueMechanismBlock(props: UniqueMechanismBlockProps) {
  const headline = props.headline || props.title || "Mecanismo único";
  const description =
    props.description ||
    props.mechanism_name ||
    "Una explicación clara del diferencial que hace que esta propuesta funcione.";
  const highlights = [
    ...toHighlightList(props.highlights),
    ...toHighlightList(props.items),
  ].filter((value, index, array) => array.indexOf(value) === index);

  return (
    <section className="my-8 px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-3xl font-bold text-slate-900">
          {headline}
        </h2>

        <p className="mx-auto mt-4 max-w-3xl text-center text-base leading-7 text-slate-600">
          {description}
        </p>

        {highlights.length > 0 ? (
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {highlights.map((highlight, index) => (
              <div key={`${highlight}-${index}`} className="flex items-start gap-3 p-5">
                <span
                  aria-hidden="true"
                  className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700"
                >
                  ✦
                </span>
                <p className="text-base leading-7 text-slate-700">{highlight}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
