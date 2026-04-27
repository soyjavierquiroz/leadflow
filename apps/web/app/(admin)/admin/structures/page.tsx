import { SectionHeader } from "@/components/app-shell/section-header";
import { SplitMediaFocusLayout } from "@/components/structures/SplitMediaFocusLayout";
import { AVAILABLE_STRUCTURES } from "@/lib/structure-registry";

function StickySplitPreview() {
  return (
    <SplitMediaFocusLayout
      className="min-h-[18rem]"
      mediaPanelClassName="lg:h-[18rem]"
      contentPanelClassName="min-h-[18rem] px-4 pb-4 pt-3 lg:px-6 lg:pb-6 lg:pt-3"
      contentInnerClassName="max-w-none space-y-4"
      mediaSlot={
        <div className="flex h-full flex-col justify-between p-5 text-app-shell-text lg:p-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-app-accent">
              Sticky Media
            </p>
            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[color:color-mix(in_srgb,var(--app-surface)_14%,transparent)] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.25)]">
              <div className="aspect-[4/5] rounded-[1.2rem] bg-[linear-gradient(180deg,_rgba(255,255,255,0.18)_0%,_rgba(255,255,255,0.03)_100%)]" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-2 w-20 rounded-full bg-[color:color-mix(in_srgb,var(--app-surface)_22%,transparent)]" />
            <div className="h-2 w-32 rounded-full bg-app-accent/50" />
          </div>
        </div>
      }
      contentSlot={
        <>
          <div className="space-y-2 rounded-[1.4rem] border border-[var(--app-border)] bg-[var(--app-card)] p-4">
            <div className="h-2 w-20 rounded-full bg-app-accent/30" />
            <div className="h-4 w-40 rounded-full bg-[var(--app-text)]/90" />
            <div className="h-2 w-full rounded-full bg-[var(--app-surface-muted)]" />
            <div className="h-2 w-5/6 rounded-full bg-[var(--app-surface-muted)]" />
          </div>
          <div className="space-y-3 rounded-[1.4rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
            <div className="h-3 w-28 rounded-full bg-[var(--app-text)]" />
            <div className="grid gap-2">
              <div className="h-10 rounded-2xl bg-[var(--app-surface-muted)]" />
              <div className="h-10 rounded-2xl bg-[var(--app-surface-muted)]" />
              <div className="h-10 rounded-2xl bg-[var(--app-surface-muted)]" />
            </div>
          </div>
        </>
      }
    />
  );
}

function StructureCard({
  id,
  name,
  description,
  thumbnailPath,
  componentImportPath,
}: (typeof AVAILABLE_STRUCTURES)[number]) {
  return (
    <article className="rounded-[2rem] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
      <div className="rounded-[1.6rem] border border-dashed border-[var(--app-border)] bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.10),_transparent_50%),linear-gradient(180deg,_var(--app-card)_0%,_color-mix(in_srgb,var(--app-accent-soft)_35%,var(--app-surface))_100%)] p-3">
        <div className="flex items-center justify-between gap-3 px-2">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--app-text-soft)]">
            Vista previa
          </p>
          <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text-soft)]">
            {thumbnailPath}
          </span>
        </div>
        <div className="mt-3 overflow-hidden rounded-[1.4rem] border border-[var(--app-border)] bg-[var(--app-surface)]">
          {id === "split-media-focus" ? (
            <StickySplitPreview />
          ) : (
            <div className="min-h-[18rem]" />
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold tracking-tight text-[var(--app-text)]">
            {name}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">{description}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--app-text-soft)]">
            {componentImportPath}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--app-text-soft)]">
            Structure ID
          </p>
          <code className="mt-2 block text-sm font-semibold text-[var(--app-text)]">
            {id}
          </code>
        </div>
      </div>
    </article>
  );
}

export default function AdminStructuresPage() {
  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Super Admin / Core Layouts"
        title="Catálogo de Estructuras (Core Layouts)"
        description="Registro visual para identificar layouts base reutilizables sin tocar el runtime público actual. Cada tarjeta expone su metadata y el ID operativo para builder, catálogo o documentación interna."
      />

      <section className="grid gap-6 xl:grid-cols-2">
        {AVAILABLE_STRUCTURES.map((structure) => (
          <StructureCard key={structure.id} {...structure} />
        ))}
      </section>
    </div>
  );
}
