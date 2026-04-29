"use client";

import { X } from "lucide-react";

import {
  PublicationTrackingFields,
  type PublicationTrackingFieldName,
} from "@/components/forms/publication-tracking-fields";

type PublicationInspectorDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  seoTitle: string;
  metaDescription: string;
  onSeoTitleChange: (value: string) => void;
  onMetaDescriptionChange: (value: string) => void;
  metaPixelId: string;
  tiktokPixelId: string;
  metaCapiToken: string;
  tiktokAccessToken: string;
  onTrackingChange: (field: PublicationTrackingFieldName, value: string) => void;
};

const fieldLabelClassName = "text-sm font-medium text-app-text-muted";

const inputClassName =
  "rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition placeholder:text-app-text-soft focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft";

export function PublicationInspectorDrawer({
  isOpen,
  onClose,
  seoTitle,
  metaDescription,
  onSeoTitleChange,
  onMetaDescriptionChange,
  metaPixelId,
  tiktokPixelId,
  metaCapiToken,
  tiktokAccessToken,
  onTrackingChange,
}: PublicationInspectorDrawerProps) {
  return (
    <div
      className={`fixed inset-0 z-50 transition ${
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        className={`absolute inset-0 bg-app-bg/45 backdrop-blur-sm transition-opacity ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
        aria-label="Cerrar ajustes de publicación"
      />

      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-[31rem] flex-col border-l border-app-border bg-app-bg shadow-[-24px_0_80px_rgba(15,23,42,0.18)] transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Ajustes de publicación"
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-app-border px-5">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-app-text-soft">
              Inspector
            </p>
            <h2 className="text-lg font-semibold text-app-text">
              Identidad y conversión
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-app-border bg-app-card text-app-text-muted transition hover:border-app-border-strong hover:text-app-text"
            aria-label="Cerrar inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6">
          <section className="rounded-[1.5rem] border border-app-border bg-app-card p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
              SEO & Social
            </p>
            <p className="mt-2 text-sm leading-6 text-app-text-muted">
              Estos campos alimentan el manifiesto soberano de publicación y
              tienen prioridad sobre cualquier metadata legacy del funnel.
            </p>

            <div className="mt-5 grid gap-5">
              <label className="grid gap-2">
                <span className={fieldLabelClassName}>SEO Title</span>
                <input
                  value={seoTitle}
                  onChange={(event) => onSeoTitleChange(event.target.value)}
                  placeholder="Dragon Vintage T9 | Leadflow"
                  className={inputClassName}
                />
                <span className="text-xs leading-5 text-app-text-soft">
                  Si queda vacío, el runtime usa el nombre del funnel como
                  fallback.
                </span>
              </label>

              <label className="grid gap-2">
                <span className={fieldLabelClassName}>Meta Description</span>
                <textarea
                  value={metaDescription}
                  onChange={(event) =>
                    onMetaDescriptionChange(event.target.value)
                  }
                  placeholder="Resumen comercial y beneficio principal de la landing para buscadores y shares."
                  rows={5}
                  className={inputClassName}
                />
                <span className="text-xs leading-5 text-app-text-soft">
                  Recomendado: 140-160 caracteres orientados al beneficio
                  principal.
                </span>
              </label>
            </div>
          </section>

          <PublicationTrackingFields
            value={{
              metaPixelId,
              tiktokPixelId,
              metaCapiToken,
              tiktokAccessToken,
            }}
            onChange={onTrackingChange}
            description="Tracking y tokens siguen viviendo en la publicación, pero salen del canvas para no competir con la edición visual."
            variant="vsl"
          />
        </div>
      </aside>
    </div>
  );
}
