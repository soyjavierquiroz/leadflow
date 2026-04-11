import {
  FunnelEyebrow,
  RichHeadline,
} from "@/components/public-funnel/adapters/public-funnel-primitives";

type HookAndPromiseBlockProps = {
  headline?: string;
  title?: string;
  hook_text?: string;
  hookText?: string;
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
  const hookLeadIn =
    (typeof props.hook_text === "string" && props.hook_text) ||
    (typeof props.hookText === "string" && props.hookText) ||
    null;
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
    <section className="px-4 py-12 text-[color:var(--theme-section-hero-hook-text-color)]">
      <div className="mx-auto max-w-4xl">
        {eyebrow ? (
          <FunnelEyebrow className="mb-4 justify-center" contentClassName="rounded-full">
            {eyebrow}
          </FunnelEyebrow>
        ) : null}

        <h1 className="mx-auto mb-6 max-w-5xl text-center text-4xl font-extrabold [color:var(--theme-section-hero-hook-headline-color)] md:text-5xl">
          <RichHeadline text={headline} className="font-black" />
        </h1>

        {hookLeadIn ? (
          <div className="mx-auto mb-8 max-w-4xl text-center text-lg leading-[1.4] [color:var(--theme-section-hero-hook-text-color)] md:text-xl">
            <RichHeadline
              text={hookLeadIn}
              fontClassName="font-subheadline"
              className="font-medium"
            />
          </div>
        ) : null}

        {supportingText ? (
          <p className="mx-auto max-w-3xl text-justify font-subheadline text-lg leading-8 [color:var(--theme-section-hero-hook-supporting-text-color)]">
            <RichHeadline
              text={supportingText}
              fontClassName="font-subheadline"
              className="font-medium"
            />
          </p>
        ) : null}

        {bullets.length > 0 ? (
          <ul className="mt-8 space-y-4">
            {bullets.map((bullet, index) => (
              <li
                key={`${bullet}-${index}`}
                className="flex items-start gap-3 text-lg [color:var(--theme-section-hero-hook-text-color)]"
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
