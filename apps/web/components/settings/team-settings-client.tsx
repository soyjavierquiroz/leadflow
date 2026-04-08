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
import type { TeamSettingsSnapshot } from "@/lib/team-settings";
import { authenticatedOperationRequest } from "@/lib/team-operations";
import { uploadFileWithPresignedUrl } from "@/lib/storage";

type TeamSettingsClientProps = {
  initialSettings: TeamSettingsSnapshot;
};

const inputClassName =
  "w-full rounded-[1.35rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5";
const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

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

    const previousLogoUrl = settings.logoUrl;
    const previewUrl = URL.createObjectURL(file);

    setSettings((current) => ({
      ...current,
      logoUrl: previewUrl,
    }));
    setIsUploadingLogo(true);
    setFeedback(null);

    try {
      const publicUrl = await uploadFileWithPresignedUrl(file, "branding", {
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
      URL.revokeObjectURL(previewUrl);
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
        <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.16),_transparent_40%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
                Branding del tenant
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                Identidad operativa
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Lo que configures aquí alimenta la referencia visual del equipo y
                el dominio base del workspace.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {settings.teamCode}
            </span>
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white/90 p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={`Logo de ${logoLabel}`}
                  className="h-24 w-24 rounded-[1.5rem] border border-slate-200 bg-white object-cover shadow-[0_18px_30px_rgba(15,23,42,0.08)]"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-[1.5rem] bg-slate-950 text-2xl font-semibold text-white shadow-[0_18px_30px_rgba(15,23,42,0.12)]">
                  {buildInitials(logoLabel)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Vista previa
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {previewAgencyName}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {previewBaseDomain || "Sin dominio base configurado"}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  Último cambio: {formatDateTime(settings.updatedAt)}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
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
                {isUploadingLogo ? "Subiendo logo..." : "Subir logo"}
              </button>
              <button
                type="button"
                onClick={handleRemoveLogo}
                disabled={!settings.logoUrl || isSaving}
                className={secondaryButtonClassName}
              >
                Quitar logo
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Building2 className="h-4 w-4 text-teal-700" />
                Nombre comercial
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                El nombre visible del tenant en el shell y en superficies de
                gestión.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Globe className="h-4 w-4 text-teal-700" />
                Dominio base
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Úsalo cuando el workspace ya tenga hostname principal o un
                dominio canónico.
              </p>
            </div>
          </div>
        </article>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)]"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Editor del tenant
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              Configuración principal
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Los cambios se guardan sobre el equipo actual y refrescan la
              navegación para reflejar la nueva identidad.
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">
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
            <span className="text-sm font-medium text-slate-700">
              Dominio base
            </span>
            <input
              value={baseDomain}
              onChange={(event) => setBaseDomain(event.target.value)}
              className={inputClassName}
              placeholder="leadflow.tuagencia.com"
            />
            <p className="text-xs leading-5 text-slate-500">
              Puedes pegar solo el hostname o una URL simple; guardaremos el
              host base.
            </p>
          </label>

          <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
            El logo se publica directo en el bridge de storage y se guarda al
            terminar la subida, sin esperar al submit del formulario.
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
