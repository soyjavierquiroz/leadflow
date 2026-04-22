"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { SponsorCard } from "@/components/app-shell/sponsor-card";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { buildInitials } from "@/lib/app-shell/utils";
import {
  UI_IDENTITY_AVATAR_ACCEPT,
  UI_IDENTITY_UPLOAD_HINT,
  optimizeUiIdentityImage,
} from "@/lib/media-optimizer";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { MemberProtectionHubButton } from "@/components/member-operations/member-protection-hub-button";
import type { MemberDashboardKpis } from "@/lib/member-dashboard";
import type { MemberProfileSponsor } from "@/lib/member-profile";
import { memberOperationRequest } from "@/lib/member-operations";
import { uploadFileWithPresignedUrl } from "@/lib/storage";

type MemberProfileClientProps = {
  sponsor: MemberProfileSponsor;
  kpis: MemberDashboardKpis;
};

export function MemberProfileClient({
  sponsor,
  kpis,
}: MemberProfileClientProps) {
  const [currentSponsor, setCurrentSponsor] = useState(sponsor);
  const [formState, setFormState] = useState({
    displayName: sponsor.displayName,
    email: sponsor.email ?? "",
    phone: sponsor.phone ?? "",
    availabilityStatus: sponsor.availabilityStatus,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const updatedSponsor = await memberOperationRequest<MemberProfileSponsor>(
        "/sponsors/me",
        {
          method: "PATCH",
          body: JSON.stringify({
            displayName: formState.displayName,
            email: formState.email || null,
            phone: formState.phone || null,
            availabilityStatus: formState.availabilityStatus,
          }),
        },
      );

      setCurrentSponsor(updatedSponsor);
      setFormState({
        displayName: updatedSponsor.displayName,
        email: updatedSponsor.email ?? "",
        phone: updatedSponsor.phone ?? "",
        availabilityStatus: updatedSponsor.availabilityStatus,
      });
      setFeedback({
        tone: "success",
        message: "Perfil operativo actualizado correctamente.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos guardar tu perfil.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setFeedback({
        tone: "error",
        message: "Selecciona una imagen valida para tu avatar.",
      });
      event.target.value = "";
      return;
    }

    const previousAvatarUrl = currentSponsor.avatarUrl;
    let previewUrl: string | null = null;

    setIsUploadingAvatar(true);
    setFeedback(null);

    try {
      const optimizedFile = await optimizeUiIdentityImage(file);
      previewUrl = URL.createObjectURL(optimizedFile);

      setCurrentSponsor((current) => ({
        ...current,
        avatarUrl: previewUrl,
      }));

      const publicUrl = await uploadFileWithPresignedUrl(
        optimizedFile,
        "avatars",
      );
      const updatedSponsor = await memberOperationRequest<MemberProfileSponsor>(
        "/sponsors/me",
        {
          method: "PATCH",
          body: JSON.stringify({ avatarUrl: publicUrl }),
        },
      );

      setCurrentSponsor(updatedSponsor);
      setFeedback({
        tone: "success",
        message: "Tu foto de perfil ya quedo actualizada.",
      });
    } catch (error) {
      setCurrentSponsor((current) => ({
        ...current,
        avatarUrl: previousAvatarUrl,
      }));
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos actualizar tu avatar.",
      });
    } finally {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      event.target.value = "";
      setIsUploadingAvatar(false);
    }
  };

  const avatarLabel =
    currentSponsor.displayName.trim() || "Sponsor sin nombre visible";

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Sponsor / Member / Perfil"
        title="Tu perfil operativo"
        description="Actualiza tus datos visibles y tu foto para que el handoff salga con una identidad clara, profesional y lista para trabajar."
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Disponibilidad"
          value={currentSponsor.availabilityStatus}
          hint="Estado actual que define si sigues recibiendo nuevos leads."
        />
        <KpiCard
          label="Handoffs nuevos"
          value={String(kpis.handoffsNew)}
          hint="Leads que todavia esperan tu aceptacion."
        />
        <KpiCard
          label="Acciones hoy"
          value={String(kpis.actionsToday)}
          hint="Seguimientos urgentes o pendientes para hoy."
        />
        <KpiCard
          label="Cartera activa"
          value={String(kpis.activePortfolio)}
          hint="Leads abiertos que hoy estan en tu gestion."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-6">
          <SponsorCard
            sponsor={currentSponsor}
            leadCount={kpis.activePortfolio}
            assignmentCount={kpis.handoffsNew}
            actions={
              <div className="flex flex-wrap gap-2">
                <StatusBadge value={currentSponsor.status} />
                <StatusBadge value={currentSponsor.availabilityStatus} />
              </div>
            }
          />

          <section className="rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.12),_transparent_38%),linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {currentSponsor.avatarUrl ? (
                  <img
                    src={currentSponsor.avatarUrl}
                    alt={`Avatar de ${avatarLabel}`}
                    className="h-20 w-20 rounded-[1.75rem] border border-white object-cover shadow-[0_18px_30px_rgba(15,23,42,0.12)]"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-slate-950 text-xl font-semibold text-white shadow-[0_18px_30px_rgba(15,23,42,0.12)]">
                    {buildInitials(avatarLabel)}
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Foto de perfil
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">
                    Tu avatar visible en handoff
                  </h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                    Sube una imagen clara y profesional. La carga va directo a
                    nuestro storage y el perfil se actualiza al terminar.
                  </p>
                </div>
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
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                  className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUploadingAvatar
                    ? "Optimizando y subiendo..."
                    : "Cambiar foto"}
                </button>
                <span className="text-xs text-slate-500">
                  {UI_IDENTITY_UPLOAD_HINT}
                </span>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section
            id="blacklist-access"
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">
                  Blacklist
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Accede a tu lista de protección sin salir del workspace del
                  member.
                </p>
              </div>

              <Link
                href="/member/profile#blacklist-access"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Ir al Blacklist
              </Link>
            </div>

            <div className="mt-5">
              <MemberProtectionHubButton
                advisorPhone={currentSponsor.phone ?? null}
                isSsoAvailable
              />
            </div>
          </section>

          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"
          >
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                Datos visibles del sponsor
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Esta informacion queda disponible para las experiencias de
                handoff y seguimiento, asi que aqui cuidamos la identidad
                operativa base.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">
                  Nombre visible
                </span>
                <input
                  value={formState.displayName}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">
                  Disponibilidad
                </span>
                <select
                  value={formState.availabilityStatus}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      availabilityStatus: event.target.value as
                        | "available"
                        | "paused"
                        | "offline",
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                >
                  <option value="available">available</option>
                  <option value="paused">paused</option>
                  <option value="offline">offline</option>
                </select>
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">
                  Email visible
                </span>
                <input
                  value={formState.email}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">
                  Telefono visible
                </span>
                <input
                  value={formState.phone}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Guardando..." : "Guardar perfil operativo"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
