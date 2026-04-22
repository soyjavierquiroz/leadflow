"use client";

import {
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { MemberProtectionHubButton } from "@/components/member-operations/member-protection-hub-button";
import { SectionHeader } from "@/components/app-shell/section-header";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { buildInitials } from "@/lib/app-shell/utils";
import {
  UI_IDENTITY_AVATAR_ACCEPT,
  UI_IDENTITY_UPLOAD_HINT,
  optimizeUiIdentityImage,
} from "@/lib/media-optimizer";
import type { MyProfileSnapshot } from "@/lib/profile-settings";
import { uploadFileWithPresignedUrl } from "@/lib/storage";
import { authenticatedOperationRequest } from "@/lib/team-operations";

type ProfileSettingsClientProps = {
  initialProfile: MyProfileSnapshot;
  scope: "team" | "member";
};

const inputClassName =
  "w-full rounded-[1.35rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 disabled:bg-slate-50 disabled:text-slate-500";
const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const roleLabel: Record<MyProfileSnapshot["role"], string> = {
  SUPER_ADMIN: "Super Admin",
  TEAM_ADMIN: "Team Admin",
  MEMBER: "Member",
};

export function ProfileSettingsClient({
  initialProfile,
  scope,
}: ProfileSettingsClientProps) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [fullName, setFullName] = useState(initialProfile.fullName);
  const [phone, setPhone] = useState(initialProfile.phone ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSavingProfile, startSavingProfile] = useTransition();
  const [isSavingPassword, startSavingPassword] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const eyebrow =
    scope === "team" ? "Team Admin / Perfil" : "Member / Perfil";
  const title =
    scope === "team" ? "Tu configuración personal" : "Tu perfil personal";
  const description =
    scope === "team"
      ? "Actualiza tu identidad de acceso sin salir del workspace del equipo."
      : "Mantén tu nombre, contacto y credenciales al día para trabajar sin fricción.";

  const initials = useMemo(() => buildInitials(profile.fullName), [profile.fullName]);
  const hasOperationalSponsor = Boolean(profile.sponsorDisplayName);

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!hasOperationalSponsor) {
      setFeedback({
        tone: "error",
        message:
          "Tu usuario no tiene sponsor operativo vinculado, así que no hay avatar para publicar en handoff.",
      });
      event.target.value = "";
      return;
    }

    let previewUrl: string | null = null;
    const previousAvatarUrl = profile.avatarUrl;

    setIsUploadingAvatar(true);
    setFeedback(null);

    try {
      const optimizedFile = await optimizeUiIdentityImage(file);
      previewUrl = URL.createObjectURL(optimizedFile);

      setProfile((current) => ({
        ...current,
        avatarUrl: previewUrl,
      }));

      const publicUrl = await uploadFileWithPresignedUrl(optimizedFile, "avatars");

      await authenticatedOperationRequest("/sponsors/me", {
        method: "PATCH",
        body: JSON.stringify({
          avatarUrl: publicUrl,
        }),
      });

      setProfile((current) => ({
        ...current,
        avatarUrl: publicUrl,
      }));
      setFeedback({
        tone: "success",
        message: "Tu foto operativa ya quedó optimizada y publicada.",
      });
    } catch (error) {
      setProfile((current) => ({
        ...current,
        avatarUrl: previousAvatarUrl,
      }));
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos actualizar la foto operativa.",
      });
    } finally {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      event.target.value = "";
      setIsUploadingAvatar(false);
    }
  };

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    startSavingProfile(async () => {
      try {
        const nextProfile = await authenticatedOperationRequest<MyProfileSnapshot>(
          "/auth/me/profile",
          {
            method: "PATCH",
            body: JSON.stringify({
              fullName,
              phone: phone.trim() || null,
            }),
          },
        );

        setProfile(nextProfile);
        setFullName(nextProfile.fullName);
        setPhone(nextProfile.phone ?? "");
        setFeedback({
          tone: "success",
          message: "Tu perfil fue actualizado correctamente.",
        });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos guardar tu perfil.",
        });
      }
    });
  };

  const handlePasswordSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setFeedback({
        tone: "error",
        message: "Completa contraseña actual, nueva contraseña y confirmación.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({
        tone: "error",
        message: "La confirmación no coincide con la nueva contraseña.",
      });
      return;
    }

    startSavingPassword(async () => {
      try {
        await authenticatedOperationRequest<{ success: true }>(
          "/auth/me/password",
          {
            method: "PATCH",
            body: JSON.stringify({
              currentPassword,
              newPassword,
            }),
          },
        );

        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setFeedback({
          tone: "success",
          message: "Tu contraseña fue actualizada.",
        });
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos cambiar tu contraseña.",
        });
      }
    });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[0.84fr_1.16fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.15),_transparent_42%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
                Cuenta autenticada
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                Identidad personal
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Este bloque resume cómo te ve la plataforma cuando entras al
                shell y operas.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {roleLabel[profile.role]}
            </span>
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white/90 p-5">
            <div className="flex items-center gap-4">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={`Avatar de ${profile.fullName}`}
                  className="h-20 w-20 rounded-[1.4rem] border border-slate-200 object-cover shadow-[0_18px_30px_rgba(15,23,42,0.1)]"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-[1.4rem] bg-slate-950 text-xl font-semibold text-white shadow-[0_18px_30px_rgba(15,23,42,0.12)]">
                  {initials}
                </div>
              )}

              <div className="min-w-0">
                <p className="text-lg font-semibold text-slate-950">
                  {profile.fullName}
                </p>
                <p className="mt-1 truncate text-sm text-slate-600">
                  {profile.email}
                </p>
                <p className="mt-3 text-xs text-slate-500">
                  {profile.sponsorDisplayName
                    ? `Perfil operativo: ${profile.sponsorDisplayName}`
                    : "Sin sponsor operativo vinculado"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white/85 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Avatar del asesor
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Esta foto alimenta el advisor del handoff y el bloque
                  conversion_page_config, así que la optimizamos antes de
                  subirla.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={UI_IDENTITY_AVATAR_ACCEPT}
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <button
                  type="button"
                  disabled={
                    isUploadingAvatar ||
                    isSavingProfile ||
                    isSavingPassword ||
                    !hasOperationalSponsor
                  }
                  onClick={() => fileInputRef.current?.click()}
                  className={primaryButtonClassName}
                >
                  {isUploadingAvatar
                    ? "Optimizando y subiendo..."
                    : "Cambiar foto operativa"}
                </button>
                <span className="text-xs text-slate-500">
                  {UI_IDENTITY_UPLOAD_HINT}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <UserRound className="h-4 w-4 text-sky-700" />
                Perfil base
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Nombre personal, email de acceso y teléfono de contacto.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldCheck className="h-4 w-4 text-sky-700" />
                Seguridad
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Para cambiar la contraseña pedimos la actual antes de aceptar la
                nueva.
              </p>
            </div>
          </div>
        </article>

        <div className="grid gap-6">
          <form
            onSubmit={handleProfileSubmit}
            className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)]"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Datos personales
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                Perfil
              </h2>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Nombre</span>
              <input
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className={inputClassName}
                placeholder="Tu nombre completo"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input value={profile.email} disabled className={inputClassName} />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Teléfono / móvil
              </span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className={inputClassName}
                placeholder="+591 70000000"
              />
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSavingProfile || isSavingPassword}
                className={primaryButtonClassName}
              >
                {isSavingProfile ? "Guardando..." : "Guardar perfil"}
              </button>
              <button
                type="button"
                disabled={isSavingProfile || isSavingPassword}
                onClick={() => {
                  setFullName(profile.fullName);
                  setPhone(profile.phone ?? "");
                  setFeedback(null);
                }}
                className={secondaryButtonClassName}
              >
                Revertir
              </button>
            </div>
          </form>

          <form
            onSubmit={handlePasswordSubmit}
            className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.06)]"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Seguridad
              </p>
              <h2 className="mt-3 flex items-center gap-3 text-2xl font-semibold tracking-tight text-slate-950">
                <KeyRound className="h-5 w-5 text-slate-700" />
                Cambiar contraseña
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                La nueva contraseña se valida solo si primero confirmas la
                actual.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Contraseña actual
              </span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className={inputClassName}
                autoComplete="current-password"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Nueva contraseña
              </span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={inputClassName}
                autoComplete="new-password"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Confirmar nueva contraseña
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={inputClassName}
                autoComplete="new-password"
              />
            </label>

            <button
              type="submit"
              disabled={isSavingProfile || isSavingPassword}
              className={primaryButtonClassName}
            >
              {isSavingPassword ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </form>

          {scope === "member" ? (
            <div id="blacklist-access">
              <MemberProtectionHubButton
                advisorPhone={phone.trim() || profile.phone}
                isSsoAvailable
              />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
