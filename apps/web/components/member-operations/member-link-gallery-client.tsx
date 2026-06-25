"use client";

import { Copy, Link2, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SectionHeader } from "@/components/app-shell/section-header";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { memberOperationRequest } from "@/lib/member-operations";
import type { MemberLinkGallery } from "@/lib/member-link-gallery";

type MemberLinkGalleryClientProps = {
  initialGallery: MemberLinkGallery;
};

const buttonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full bg-app-accent px-4 py-2.5 text-sm font-semibold text-app-accent-contrast transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full border border-app-border bg-app-card px-4 py-2.5 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-60";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

export function MemberLinkGalleryClient({
  initialGallery,
}: MemberLinkGalleryClientProps) {
  const router = useRouter();
  const [gallery, setGallery] = useState(initialGallery);
  const [draftSlug, setDraftSlug] = useState(() =>
    slugify(initialGallery.advisor.displayName),
  );
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const normalizedDraftSlug = useMemo(() => slugify(draftSlug), [draftSlug]);
  const vanity = gallery.vanityShortLink;
  const hasPublicSlug = !gallery.advisor.requiresPublicSlug;

  const handleCopy = async (linkId: string, url: string) => {
    setFeedback(null);

    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkId(linkId);
      setFeedback({
        tone: "success",
        message: "Enlace copiado.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "No pudimos copiar el enlace desde este navegador.",
      });
    }
  };

  const handleGenerateVanityShortLink = () => {
    setFeedback(null);

    startTransition(async () => {
      try {
        const vanityShortLink =
          await memberOperationRequest<MemberLinkGallery["vanityShortLink"]>(
            "/sponsors/me/vanity-shortlink/generate",
            {
              method: "POST",
            },
          );

        setGallery((current) => ({
          ...current,
          vanityShortLink,
        }));
        setFeedback({
          tone: "success",
          message: "Enlace corto generado.",
        });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos generar el enlace corto.",
        });
      }
    });
  };

  const handleDeleteVanityShortLink = () => {
    setFeedback(null);

    startTransition(async () => {
      try {
        await memberOperationRequest<unknown>("/sponsors/me/vanity-shortlink", {
          method: "DELETE",
        });

        setGallery((current) => ({
          ...current,
          vanityShortLink: {
            ...current.vanityShortLink,
            shortLink: null,
          },
        }));
        setFeedback({
          tone: "success",
          message: "Enlace corto eliminado.",
        });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos eliminar el enlace corto.",
        });
      }
    });
  };

  const handleCreateSlug = () => {
    setFeedback(null);

    if (!normalizedDraftSlug) {
      setFeedback({
        tone: "error",
        message: "Define un slug publico antes de generar enlaces.",
      });
      return;
    }

    startTransition(async () => {
      try {
        await memberOperationRequest<unknown>("/sponsors/me", {
          method: "PATCH",
          body: JSON.stringify({
            publicSlug: normalizedDraftSlug,
          }),
        });

        setFeedback({
          tone: "success",
          message: "Slug publico creado. Cargando tus enlaces...",
        });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos guardar tu slug publico.",
        });
      }
    });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Sponsor / Member / Enlaces"
        title="Tus enlaces personales"
        description="Aquí viven tus enlaces de referido y enlaces atribuidos. Para campañas usa un embudo habilitado desde el arsenal."
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      {gallery.advisor.requiresPublicSlug ? (
        <section className="rounded-3xl border border-app-warning-border bg-app-warning-bg p-6 shadow-[var(--ai-card-shadow)]">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-warning-text">
              Slug requerido
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-app-text">
              Crea tu identificador publico antes de compartir enlaces.
            </h2>
            <p className="mt-3 text-sm leading-6 text-app-text-muted">
              Este valor se usara en tus URLs personales y evita que circulen
              enlaces incompletos.
            </p>
          </div>

          <div className="mt-5 flex max-w-2xl flex-col gap-3 sm:flex-row">
            <input
              value={draftSlug}
              onChange={(event) => setDraftSlug(event.target.value)}
              placeholder="ana-garcia"
              className="min-h-11 flex-1 rounded-2xl border border-app-border bg-app-card px-4 py-2.5 text-sm text-app-text outline-none transition placeholder:text-app-text-soft focus:border-app-accent"
            />
            <button
              type="button"
              onClick={handleCreateSlug}
              disabled={isPending || !normalizedDraftSlug}
              className={buttonClassName}
            >
              <Link2 className="h-4 w-4" />
              {isPending ? "Creando..." : "Crear slug"}
            </button>
          </div>
        </section>
      ) : null}

      {hasPublicSlug ? (
        <section className="rounded-3xl border border-app-border bg-app-card p-6 shadow-[var(--ai-card-shadow)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                Enlace personal de referido
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-app-text">
                Tu enlace personal
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-app-text-muted">
                Úsalo solo si necesitas compartir tu perfil o enlace personal.
                Para campañas usa un embudo habilitado.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {vanity.shortLink ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopy("vanity-shortlink", vanity.shortLink!.shortUrl)
                    }
                    disabled={isPending}
                    className={secondaryButtonClassName}
                  >
                    <Copy className="h-4 w-4" />
                    {copiedLinkId === "vanity-shortlink"
                      ? "Copiado"
                      : "Copiar enlace"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteVanityShortLink}
                    disabled={isPending}
                    className={secondaryButtonClassName}
                  >
                    <Trash2 className="h-4 w-4" />
                    {isPending ? "Eliminando..." : "Eliminar enlace corto"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateVanityShortLink}
                  disabled={isPending}
                  className={buttonClassName}
                >
                  <Link2 className="h-4 w-4" />
                  {isPending ? "Generando..." : "Generar enlace corto"}
                </button>
              )}
            </div>
          </div>

          <dl className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-app-border bg-app-surface-muted px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">
                URL personal de referido
              </dt>
              <dd className="mt-2 break-all text-sm leading-6 text-app-text-muted">
                {vanity.targetUrl}
              </dd>
            </div>
            <div className="min-w-0 rounded-2xl border border-app-border bg-app-surface-muted px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">
                Enlace corto personal
              </dt>
              <dd className="mt-2 break-all text-sm leading-6 text-app-text-muted">
                {vanity.shortLink
                  ? vanity.shortLink.shortUrl
                  : "No generado todavía"}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {hasPublicSlug ? (
        gallery.links.length > 0 ? (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {gallery.links.map((link) => (
              <article
                key={link.id}
                className="rounded-3xl border border-app-border bg-app-card p-5 shadow-[var(--ai-card-shadow)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                      Enlace atribuido
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-app-text">
                      {link.funnelName}
                    </h2>
                  </div>
                  {link.isPrimary ? (
                    <span className="rounded-full border border-app-accent bg-app-accent-soft px-3 py-1 text-xs font-semibold text-app-accent">
                      Principal
                    </span>
                  ) : null}
                </div>

                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-app-text-soft">Ruta</dt>
                    <dd className="font-medium text-app-text">
                      {link.pathPrefix}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-app-text-soft">Codigo</dt>
                    <dd className="font-medium text-app-text">
                      {link.funnelCode}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 rounded-2xl border border-app-border bg-app-surface-muted px-4 py-3 text-sm leading-6 text-app-text-muted">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-app-text-soft">
                    URL con atribución personal
                  </p>
                  {link.url}
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => handleCopy(link.id, link.url)}
                    className={secondaryButtonClassName}
                  >
                    <Copy className="h-4 w-4" />
                    {copiedLinkId === link.id ? "Copiado" : "Copiar enlace"}
                  </button>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="rounded-3xl border border-app-border bg-app-card p-6 text-sm leading-6 text-app-text-muted shadow-[var(--ai-card-shadow)]">
            No hay publicaciones activas disponibles para generar enlaces.
          </section>
        )
      ) : null}
    </div>
  );
}
