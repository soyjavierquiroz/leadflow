"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { EmptyState } from "@/components/app-shell/empty-state";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { ModalShell } from "@/components/team-operations/modal-shell";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { teamOperationRequest } from "@/lib/team-operations";
import type {
  InviteTeamMemberInput,
  TeamMemberRecord,
  TeamMembersSeatSummary,
} from "@/lib/team-members";
import { inviteTeamMemberSchema } from "@/lib/team-members";

type TeamMembersClientProps = {
  initialMembers: TeamMemberRecord[];
  initialTeam: TeamMembersSeatSummary;
};

type TeamMemberMutationResponse = {
  team: TeamMembersSeatSummary;
  member: TeamMemberRecord;
};

type TeamMemberInvitationResponse = TeamMemberMutationResponse & {
  temporaryPassword: string;
};

type TeamMemberDeletionResponse = {
  team: TeamMembersSeatSummary;
  deletedMemberId: string;
};

const primaryButtonClassName =
  "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const formatRoleLabel = (role: TeamMemberRecord["role"]) => {
  switch (role) {
    case "TEAM_ADMIN":
      return "Team Admin";
    case "MEMBER":
      return "Member";
    case "SUPER_ADMIN":
      return "Super Admin";
  }
};

const formatDateLabel = (value: string | null) => {
  if (!value) {
    return "Nunca";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Nunca";
  }

  return new Intl.DateTimeFormat("es-BO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};

const buildInitials = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const upsertMember = (
  current: TeamMemberRecord[],
  member: TeamMemberRecord,
) => {
  const existingIndex = current.findIndex((item) => item.id === member.id);

  if (existingIndex === -1) {
    return [...current, member];
  }

  return current.map((item) => (item.id === member.id ? member : item));
};

export function TeamMembersClient({
  initialMembers,
  initialTeam,
}: TeamMembersClientProps) {
  const [members, setMembers] = useState(initialMembers);
  const [team, setTeam] = useState(initialTeam);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [pendingMemberIds, setPendingMemberIds] = useState<string[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteWhatsappNumber, setInviteWhatsappNumber] = useState("");
  const [inviteErrors, setInviteErrors] = useState<
    Partial<Record<keyof InviteTeamMemberInput, string>>
  >({});
  const [memberPendingDeletion, setMemberPendingDeletion] =
    useState<TeamMemberRecord | null>(null);
  const [isPending, startTransition] = useTransition();

  const seatUsagePercentage =
    team.maxSeats > 0
      ? Math.min((team.activeSeats / team.maxSeats) * 100, 100)
      : 0;
  const inactiveMembers = members.filter((item) => !item.isActive).length;

  const resetFeedback = () => {
    setFeedback(null);
  };

  const resetInviteForm = () => {
    setInviteFullName("");
    setInviteEmail("");
    setInviteWhatsappNumber("");
    setInviteErrors({});
  };

  const handleSeatToggle = (member: TeamMemberRecord) => {
    resetFeedback();

    const previousMembers = members;
    const previousTeam = team;
    const nextIsActive = !member.isActive;

    setMembers((current) =>
      current.map((item) =>
        item.id === member.id ? { ...item, isActive: nextIsActive } : item,
      ),
    );
    setTeam((current) => ({
      ...current,
      activeSeats: current.activeSeats + (nextIsActive ? 1 : -1),
      availableSeats: current.availableSeats + (nextIsActive ? -1 : 1),
    }));
    setPendingMemberIds((current) => [...current, member.id]);

    startTransition(async () => {
      try {
        const response = await teamOperationRequest<TeamMemberMutationResponse>(
          `/team/members/${member.id}/status`,
          {
            method: "PATCH",
            body: JSON.stringify({
              isActive: nextIsActive,
            }),
          },
        );

        setMembers((current) => upsertMember(current, response.member));
        setTeam(response.team);
        setFeedback({
          tone: "success",
          message: nextIsActive
            ? "Licencia activada correctamente."
            : "Licencia liberada correctamente.",
        });
      } catch (error) {
        setMembers(previousMembers);
        setTeam(previousTeam);
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos actualizar el estado del miembro.",
        });
      } finally {
        setPendingMemberIds((current) =>
          current.filter((item) => item !== member.id),
        );
      }
    });
  };

  const handleInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();
    setInviteErrors({});

    const parsedInvite = inviteTeamMemberSchema.safeParse({
      fullName: inviteFullName,
      email: inviteEmail,
      whatsappNumber: inviteWhatsappNumber,
    });

    if (!parsedInvite.success) {
      const flattenedErrors = parsedInvite.error.flatten().fieldErrors;
      setFeedback({
        tone: "error",
        message: "Revisa los datos del asesor antes de continuar.",
      });
      setInviteErrors({
        fullName: flattenedErrors.fullName?.[0],
        email: flattenedErrors.email?.[0],
        whatsappNumber: flattenedErrors.whatsappNumber?.[0],
      });
      return;
    }

    const payload = {
      ...parsedInvite.data,
      email: parsedInvite.data.email.toLowerCase(),
    };

    startTransition(async () => {
      try {
        const response =
          await teamOperationRequest<TeamMemberInvitationResponse>(
            "/team/members",
            {
              method: "POST",
              body: JSON.stringify(payload),
            },
          );

        setMembers((current) => upsertMember(current, response.member));
        setTeam(response.team);
        resetInviteForm();
        setIsInviteModalOpen(false);
        setFeedback({
          tone: "success",
          message: `Usuario creado en estado inactivo. Password temporal: ${response.temporaryPassword}`,
        });
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos crear el usuario del team.",
        });
      }
    });
  };

  const handleDeleteMember = () => {
    if (!memberPendingDeletion) {
      return;
    }

    resetFeedback();

    startTransition(async () => {
      try {
        const response = await teamOperationRequest<TeamMemberDeletionResponse>(
          `/team/members/${memberPendingDeletion.id}`,
          {
            method: "DELETE",
          },
        );

        setMembers((current) =>
          current.filter((item) => item.id !== response.deletedMemberId),
        );
        setTeam(response.team);
        setMemberPendingDeletion(null);
        setFeedback({
          tone: "success",
          message: "Asesor eliminado definitivamente del team.",
        });
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos eliminar al asesor del team.",
        });
      }
    });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Mi Equipo"
        title={`Licencias y miembros de ${team.teamName}`}
        description="Controla cuantas licencias estan encendidas, invita usuarios nuevos y protege al equipo de activar mas asientos de los contratados."
        actions={
          <button
            type="button"
            onClick={() => {
              resetFeedback();
              setInviteErrors({});
              setIsInviteModalOpen(true);
            }}
            className={primaryButtonClassName}
          >
            Invitar usuario
          </button>
        }
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(20,184,166,0.12),_transparent_38%),linear-gradient(180deg,_rgba(255,255,255,1)_0%,_rgba(248,250,252,0.96)_100%)] p-6 shadow-[0_20px_50px_rgba(15,23,42,0.07)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
            Licencias activas
          </p>
          <div className="mt-4 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-4xl font-semibold tracking-tight text-slate-950">
                {team.activeSeats} de {team.maxSeats}
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Cada asesor activo consume una licencia. El backend bloquea
                cualquier activacion que intente superar el limite contratado.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">
                {team.availableSeats} licencias disponibles
              </p>
              <p className="mt-1">
                {team.availableSeats === 0
                  ? "Para activar otro usuario primero debes liberar un asiento."
                  : "Todavia puedes encender nuevos usuarios sin friccion."}
              </p>
            </div>
          </div>
          <div className="mt-6 h-4 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,_#0f172a_0%,_#14b8a6_60%,_#f59e0b_100%)] transition-[width] duration-300"
              style={{
                width: `${seatUsagePercentage}%`,
              }}
            />
          </div>
        </article>

        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
          <KpiCard
            label="Miembros"
            value={String(members.length)}
            hint="Usuarios registrados en el team actual."
          />
          <KpiCard
            label="Asientos libres"
            value={String(team.availableSeats)}
            hint="Capacidad inmediata antes de tocar el tope contratado."
          />
          <KpiCard
            label="Inactivos"
            value={String(inactiveMembers)}
            hint="Usuarios creados que hoy no consumen licencia."
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-semibold text-slate-950">
            Escuadron del team
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Activa o desactiva licencias sin perder visibilidad sobre rol,
            disponibilidad comercial y ultimo acceso.
          </p>
        </div>

        {members.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-6 py-4">Usuario</th>
                  <th className="px-4 py-4">Rol</th>
                  <th className="px-4 py-4">Operacion</th>
                  <th className="px-4 py-4">Ultimo acceso</th>
                  <th className="px-6 py-4 text-right">Licencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((member) => {
                  const isMemberPending = pendingMemberIds.includes(member.id);
                  const isSeatControlAvailable = Boolean(member.sponsorId);
                  const isDeletableAdvisor =
                    member.role === "MEMBER" && Boolean(member.sponsorId);

                  return (
                    <tr key={member.id} className="align-top">
                      <td className="px-6 py-5">
                        <div className="flex items-start gap-4">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt={`Avatar de ${member.fullName}`}
                              className="h-12 w-12 rounded-2xl object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
                              {buildInitials(
                                member.displayName ?? member.fullName,
                              )}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-slate-950">
                              {member.displayName ?? member.fullName}
                            </p>
                            <p className="mt-1 text-slate-600">
                              {member.email}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              WhatsApp: {member.phone ?? "Sin cargar"} ·{" "}
                              {member.memberPortalEnabled
                                ? "Portal listo"
                                : "Portal pendiente"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <div className="space-y-2">
                          <StatusBadge value={member.role.toLowerCase()} />
                          <p className="text-xs text-slate-500">
                            {formatRoleLabel(member.role)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-5">
                        <div className="space-y-2">
                          <StatusBadge
                            value={member.availabilityStatus ?? "offline"}
                          />
                          <p className="text-xs text-slate-500">
                            Sponsor:{" "}
                            {member.sponsorStatus ?? "Perfil pendiente"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-5 text-slate-600">
                        {formatDateLabel(member.lastLoginAt)}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center justify-end gap-4">
                          {isDeletableAdvisor ? (
                            <button
                              type="button"
                              onClick={() => {
                                resetFeedback();
                                setMemberPendingDeletion(member);
                              }}
                              disabled={isPending || isMemberPending}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Eliminar a ${member.displayName ?? member.fullName}`}
                              title="Eliminar asesor"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                          <div className="text-right">
                            <p className="font-semibold text-slate-950">
                              {member.isActive ? "Activa" : "Inactiva"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {!isSeatControlAvailable
                                ? "Necesita perfil sponsor"
                                : member.isActive
                                  ? "Consume una licencia"
                                  : "No consume asiento"}
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={member.isActive}
                            onClick={() => handleSeatToggle(member)}
                            disabled={
                              isPending ||
                              isMemberPending ||
                              !isSeatControlAvailable
                            }
                            className={`relative inline-flex h-8 w-16 shrink-0 items-center rounded-full transition ${
                              member.isActive
                                ? "bg-emerald-500"
                                : "bg-slate-300"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            <span
                              className={`inline-block h-6 w-6 rounded-full bg-white shadow transition ${
                                member.isActive
                                  ? "translate-x-9"
                                  : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <EmptyState
              title="Sin miembros todavia"
              description="Invita el primer usuario adicional y luego decide cuando encender su licencia."
            />
          </div>
        )}
      </section>

      {isInviteModalOpen ? (
        <ModalShell
          title="Invitar usuario"
          description="Crea un usuario nuevo para el team. Nacera inactivo para no consumir una licencia por accidente."
          onClose={() => {
            if (isPending) {
              return;
            }

            resetInviteForm();
            setIsInviteModalOpen(false);
          }}
        >
          <form className="space-y-5" onSubmit={handleInvite}>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-900">
                Nombre
              </span>
              <input
                value={inviteFullName}
                onChange={(event) => {
                  setInviteFullName(event.target.value);
                  setInviteErrors((current) => ({
                    ...current,
                    fullName: undefined,
                  }));
                }}
                placeholder="Nombre del asesor"
                aria-invalid={inviteErrors.fullName ? "true" : "false"}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              {inviteErrors.fullName ? (
                <p className="text-xs text-red-600">{inviteErrors.fullName}</p>
              ) : null}
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-900">
                Email
              </span>
              <input
                type="email"
                value={inviteEmail}
                onChange={(event) => {
                  setInviteEmail(event.target.value);
                  setInviteErrors((current) => ({
                    ...current,
                    email: undefined,
                  }));
                }}
                placeholder="asesor@cliente.com"
                aria-invalid={inviteErrors.email ? "true" : "false"}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              {inviteErrors.email ? (
                <p className="text-xs text-red-600">{inviteErrors.email}</p>
              ) : null}
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-900">
                Numero de WhatsApp
              </span>
              <input
                type="tel"
                value={inviteWhatsappNumber}
                onChange={(event) => {
                  setInviteWhatsappNumber(event.target.value);
                  setInviteErrors((current) => ({
                    ...current,
                    whatsappNumber: undefined,
                  }));
                }}
                placeholder="+57 300 123 4567"
                aria-invalid={inviteErrors.whatsappNumber ? "true" : "false"}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              {inviteErrors.whatsappNumber ? (
                <p className="text-xs text-red-600">
                  {inviteErrors.whatsappNumber}
                </p>
              ) : null}
              <p className="text-xs text-slate-500">
                Este numero se usara como WhatsApp operativo del asesor.
              </p>
            </label>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  resetInviteForm();
                  setIsInviteModalOpen(false);
                }}
                disabled={isPending}
                className={secondaryButtonClassName}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className={primaryButtonClassName}
              >
                {isPending ? "Creando..." : "Crear usuario"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {memberPendingDeletion ? (
        <ModalShell
          eyebrow="Team Admin / Eliminacion"
          title="Eliminar asesor definitivamente"
          description={`Vas a borrar de forma permanente el usuario y el sponsor de ${memberPendingDeletion.displayName ?? memberPendingDeletion.fullName}. Esta accion no se puede deshacer.`}
          onClose={() => {
            if (isPending) {
              return;
            }

            setMemberPendingDeletion(null);
          }}
        >
          <div className="space-y-5">
            <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-4 text-sm leading-6 text-red-900">
              Esto ejecutara un hard delete en Prisma sobre el usuario asesor y
              su sponsor asociado.
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setMemberPendingDeletion(null)}
                disabled={isPending}
                className={secondaryButtonClassName}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteMember}
                disabled={isPending}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Eliminando..." : "Eliminar definitivamente"}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
