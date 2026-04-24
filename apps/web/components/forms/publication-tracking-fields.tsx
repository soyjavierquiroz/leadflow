type PublicationTrackingFieldValues = {
  metaPixelId: string;
  tiktokPixelId: string;
  metaCapiToken: string;
  tiktokAccessToken: string;
};

export type PublicationTrackingFieldName =
  keyof PublicationTrackingFieldValues;

type PublicationTrackingFieldsProps = {
  value: PublicationTrackingFieldValues;
  onChange: (field: PublicationTrackingFieldName, value: string) => void;
  description: string;
  disabled?: boolean;
  variant?: "team" | "system" | "vsl";
};

const fieldDefinitions: Array<{
  key: PublicationTrackingFieldName;
  label: string;
  placeholder: string;
}> = [
  {
    key: "metaPixelId",
    label: "Meta Pixel ID",
    placeholder: "123456789012345",
  },
  {
    key: "tiktokPixelId",
    label: "TikTok Pixel ID",
    placeholder: "C123ABC456DEF",
  },
  {
    key: "metaCapiToken",
    label: "Meta CAPI Token",
    placeholder: "EAAB...",
  },
  {
    key: "tiktokAccessToken",
    label: "TikTok Access Token",
    placeholder: "tt_act_...",
  },
];

const variantStyles = {
  team: {
    section:
      "rounded-[1.5rem] border border-[var(--app-border)] bg-[var(--app-card)] px-4 py-4",
    header: "",
    title: "text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-text-soft)]",
    description: "mt-2 text-sm text-[var(--app-muted)]",
    fields: "mt-4 grid gap-4 md:grid-cols-2",
    label: "block",
    labelText: "text-sm font-medium text-[var(--app-text)]",
    input:
      "mt-2 w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 font-mono text-sm text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-text-soft)] focus:border-[var(--app-border-strong)] focus:ring-2 focus:ring-[var(--app-accent-soft)]",
  },
  system: {
    section:
      "rounded-[1.5rem] border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-4",
    header: "",
    title: "text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-text-soft)]",
    description: "mt-2 text-sm text-[var(--app-muted)]",
    fields: "mt-4 grid gap-5 md:grid-cols-2",
    label: "space-y-2 text-sm text-[var(--app-muted)]",
    labelText: "font-semibold text-[var(--app-text)]",
    input:
      "w-full rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] px-4 py-3 font-mono text-sm text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-text-soft)] focus:border-[var(--app-border-strong)] focus:ring-2 focus:ring-[var(--app-accent-soft)]",
  },
  vsl: {
    section:
      "grid gap-5 rounded-[1.5rem] border border-[var(--app-border)] bg-[var(--app-card)] p-4 md:col-span-2",
    header: "md:col-span-2",
    title: "text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-text-soft)]",
    description: "mt-2 text-sm text-[var(--app-muted)]",
    fields: "grid gap-5 md:col-span-2 md:grid-cols-2",
    label: "grid gap-2",
    labelText: "text-sm font-medium text-[var(--app-text)]",
    input:
      "rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 font-mono text-sm text-[var(--app-text)] outline-none transition placeholder:text-[var(--app-text-soft)] focus:border-[var(--app-border-strong)] focus:ring-2 focus:ring-[var(--app-accent-soft)]",
  },
} as const;

export function PublicationTrackingFields({
  value,
  onChange,
  description,
  disabled = false,
  variant = "team",
}: PublicationTrackingFieldsProps) {
  const styles = variantStyles[variant];

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <p className={styles.title}>Tracking &amp; CAPI</p>
        <p className={styles.description}>{description}</p>
      </div>

      <div className={styles.fields}>
        {fieldDefinitions.map((field) => (
          <label key={field.key} className={styles.label}>
            <span className={styles.labelText}>{field.label}</span>
            <input
              value={value[field.key]}
              onChange={(event) => onChange(field.key, event.target.value)}
              placeholder={field.placeholder}
              disabled={disabled}
              spellCheck={false}
              className={styles.input}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
