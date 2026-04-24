"use client";

import {
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Building2, Globe, UploadCloud } from "lucide-react";
import { SectionHeader } from "@/components/app-shell/section-header";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { buildInitials, formatDateTime } from "@/lib/app-shell/utils";
import {
  UI_IDENTITY_BRANDING_ACCEPT,
  UI_IDENTITY_UPLOAD_HINT,
  optimizeUiIdentityImage,
} from "@/lib/media-optimizer";
import type { TeamSettingsSnapshot } from "@/lib/team-settings";
import { authenticatedOperationRequest } from "@/lib/team-operations";
import { uploadFileWithPresignedUrl } from "@/lib/storage";

type TeamSettingsClientProps = {
  initialSettings: TeamSettingsSnapshot;
};

const inputClassName =
  "w-full rounded-[1.35rem] border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-4 focus:ring-app-accent-soft";
const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-full bg-app-text px-5 py-2.5 text-sm font-semibold text-app-bg transition hover:opacity-92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-app-border bg-app-card px-5 py-2.5 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60";

export function TeamSettingsClient({
  initialSettings,
}: TeamSettingsClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [settings, setSettings] = useState(initialSettings);
  const [agencyName, setAgencyName] = useState(initialSettings.agencyName);
  const [baseDomain, setBaseDomain] = useState(initialSettings.baseDomain ?? "");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSaving, startSaving] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    startSaving(async () => {
      try {
        const nextSettings = await authenticatedOperationRequest<TeamSettingsSnapshot>(
          "/team/settings",
          {
            method: "PATCH",
            body: JSON.stringify({
              agencyName,
              baseDomain: baseDomain.trim() || null,
            }),
          },
        );

        setSettings(nextSettings);
        setAgencyName(nextSettings.agencyName);
        setBaseDomain(nextSettings.baseDomain ?? "");
        setFeedback({
          tone: "success",
          message: "La configuración del equipo quedó guardada.",
        });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos guardar la configuración del equipo.",
        });
      }
    });
  };

  const handleLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setFeedback({
        tone: "error",
        message: "Selecciona una imagen válida para el logo.",
      });
      event.target.value = "";
      return;
    }

    setIsUploadingLogo(true);
    setFeedback(null);

    const previousLogoUrl = settings.logoUrl;
    let previewUrl: string | null = null;

    try {
      const optimizedFile = await optimizeUiIdentityImage(file);
      previewUrl = URL.createObjectURL(optimizedFile);

      setSettings((current) => ({
        ...current,
        logoUrl: previewUrl,
      }));

      const publicUrl = await uploadFileWithPresignedUrl(optimizedFile, "branding", {
        teamId: settings.teamId,
      });
      const nextSettings = await authenticatedOperationRequest<TeamSettingsSnapshot>(
        "/team/settings",
        {
          method: "PATCH",
          body: JSON.stringify({
            logoUrl: publicUrl,
          }),
        },
      );

      setSettings(nextSettings);
      setFeedback({
        tone: "success",
        message: "El logo ya está publicado y asociado al equipo.",
      });
      router.refresh();
    } catch (error) {
      setSettings((current) => ({
        ...current,
        logoUrl: previousLogoUrl,
      }));
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos actualizar el logo del equipo.",
      });
    } finally {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      event.target.value = "";
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setFeedback(null);

    startSaving(async () => {
      try {
        const nextSettings = await authenticatedOperationRequest<TeamSettingsSnapshot>(
          "/team/settings",
          {
            method: "PATCH",
            body: JSON.stringify({
              logoUrl: null,
            }),
          },
        );

        setSettings(nextSettings);
        setFeedback({
          tone: "success",
          message: "El logo del equipo fue removido.",
        });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos quitar el logo del equipo.",
        });
      }
    });
  };

  const previewAgencyName = agencyName.trim() || settings.agencyName;
  const previewBaseDomain = baseDomain.trim() || settings.baseDomain;
  const logoLabel = previewAgencyName || "Leadflow";

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Configuración"
        title="Ajustes del equipo"
        description="Deja clara la identidad del tenant: nombre visible, logo y dominio base del workspace para que la operación no se sienta improvisada."
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <article className="overflow-hidden rounded-[2rem] border border-app-border bg-[radial-gradient(circle_at_top_left,var(--app-accent-soft),_transparent_40%),linear-gradient(180deg,var(--app-surface)_0%,var(--app-card)_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-accent">
                Branding del tenant
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-app-text">
                Identidad operativa
              </h2>
              <p className="mt-3 text-sm leading-6 text-app-text-muted">
                Lo que configures aquí alimenta la referencia visual del equipo y
                el dominio base del workspace.
              </p>
            </div>
            <span className="rounded-full border border-app-border bg-app-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-app-text-soft">
              {settings.teamCode}
            </span>
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-app-border bg-app-card p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={`Logo de ${logoLabel}`}
                  className="h-24 w-24 rounded-[1.5rem] border border-app-border bg-app-card object-cover shadow-[0_18px_30px_rgba(15,23,42,0.08)]"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-[1.5rem] bg-app-text text-2xl font-semibold text-app-bg shadow-[0_18px_30px_rgba(15,23,42,0.12)]">
                  {buildInitials(logoLabel)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-app-text-soft">
                  Vista previa
                </p>
                <p className="mt-2 text-lg font-semibold text-app-text">
                  {previewAgencyName}
                </p>
                <p className="mt-1 text-sm text-app-text-muted">
                  {previewBaseDomain || "Sin dominio base configurado"}
                </p>
                <p className="mt-3 text-xs text-app-text-soft">
                  Último cambio: {formatDateTime(settings.updatedAt)}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept={UI_IDENTITY_BRANDING_ACCEPT}
                className="hidden"
                onChange={handleLogoChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingLogo}
                className={primaryButtonClassName}
              >
                <UploadCloud className="mr-2 h-4 w-4" />
                {isUploadingLogo ? "Optimizando y subiendo..." : "Subir logo"}
              </button>
              <button
                type="button"
                onClick={handleRemoveLogo}
                disabled={!settings.logoUrl || isSaving}
                className={secondaryButtonClassName}
              >
                Quitar logo
              </button>
              <span className="text-xs text-app-text-soft">
                {UI_IDENTITY_UPLOAD_HINT}
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-app-border bg-app-surface p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-app-text">
                <Building2 className="h-4 w-4 text-app-accent" />
                Nombre comercial
              </div>
              <p className="mt-2 text-sm leading-6 text-app-text-muted">
                El nombre visible del tenant en el shell y en superficies de
                gestión.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-app-border bg-app-surface p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-app-text">
                <Globe className="h-4 w-4 text-app-accent" />
                Dominio base
              </div>
              <p className="mt-2 text-sm leading-6 text-app-text-muted">
                Úsalo cuando el workspace ya tenga hostname principal o un
                dominio canónico.
              </p>
            </div>
          </div>
        </article>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-[2rem] border border-app-border bg-app-card p-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)]"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-text-soft">
              Editor del tenant
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-app-text">
              Configuración principal
            </h2>
            <p className="mt-3 text-sm leading-6 text-app-text-muted">
              Los cambios se guardan sobre el equipo actual y refrescan la
              navegación para reflejar la nueva identidad.
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-app-text-muted">
              Nombre de la agencia
            </span>
            <input
              value={agencyName}
              onChange={(event) => setAgencyName(event.target.value)}
              className={inputClassName}
              placeholder="Ej. Kurukin Growth"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-app-text-muted">
              Dominio base
            </span>
            <input
              value={baseDomain}
              onChange={(event) => setBaseDomain(event.target.value)}
              className={inputClassName}
              placeholder="leadflow.tuagencia.com"
            />
            <p className="text-xs leading-5 text-app-text-soft">
              Puedes pegar solo el hostname o una URL simple; guardaremos el
              host base.
            </p>
          </label>

          <div className="rounded-[1.5rem] border border-dashed border-app-border bg-app-surface-muted px-4 py-4 text-sm leading-6 text-app-text-muted">
            El logo se optimiza primero a WebP para mantener identidad visual
            consistente y luego se publica en storage sin esperar al submit del
            formulario.
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSaving || isUploadingLogo}
              className={primaryButtonClassName}
            >
              {isSaving ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              disabled={isSaving || isUploadingLogo}
              onClick={() => {
                setAgencyName(settings.agencyName);
                setBaseDomain(settings.baseDomain ?? "");
                setFeedback(null);
              }}
              className={secondaryButtonClassName}
            >
              Revertir
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
