type HookAndPromiseBlockProps = {
  headline?: string;
  title?: string;
  eyebrow?: string;
  top_bar?: string;
  subheadline?: string;
  description?: string;
  bullets?: unknown[];
  primary_benefit_bullets?: unknown[];
  highlights?: unknown[];
  benefits?: unknown[];
  items?: unknown[];
  [key: string]: unknown;
};

function getStringArray(values: unknown): string[] {
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
          record.label,
          record.title,
          record.headline,
          record.text,
          record.description,
          record.name,
        ].find((entry) => typeof entry === "string");
      }

      return null;
    })
    .filter((value): value is string => Boolean(value?.trim()));
}

export function HookAndPromiseBlock(props: HookAndPromiseBlockProps) {
  const headline = props.headline || props.title || "Hook & Promise";
  const eyebrow =
    (typeof props.top_bar === "string" && props.top_bar) ||
    (typeof props.eyebrow === "string" && props.eyebrow) ||
    null;
  const supportingText =
    (typeof props.subheadline === "string" && props.subheadline) ||
    (typeof props.description === "string" && props.description) ||
    null;
  const bullets = [
    ...getStringArray(props.bullets),
    ...getStringArray(props.primary_benefit_bullets),
    ...getStringArray(props.highlights),
    ...getStringArray(props.benefits),
    ...getStringArray(props.items),
  ].filter((value, index, array) => array.indexOf(value) === index);

  return (
    <section className="py-12 px-4">
      <div className="mx-auto max-w-4xl">
        {eyebrow ? (
          <p className="mb-4 text-sm font-semibold tracking-[0.24em] text-slate-500 uppercase">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="mb-6 text-4xl font-extrabold text-slate-900 md:text-5xl">
          {headline}
        </h1>

        {supportingText ? (
          <p className="max-w-3xl text-lg leading-8 text-slate-700">
            {supportingText}
          </p>
        ) : null}

        {bullets.length > 0 ? (
          <ul className="mt-8 space-y-4">
            {bullets.map((bullet, index) => (
              <li
                key={`${bullet}-${index}`}
                className="flex items-start gap-3 text-lg text-slate-700"
              >
                <span aria-hidden="true" className="mt-1 shrink-0">
                  ✅
                </span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
