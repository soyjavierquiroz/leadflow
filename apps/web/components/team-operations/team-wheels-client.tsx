"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Check, Copy, Pencil, Users } from "lucide-react";
import { EmptyState } from "@/components/app-shell/empty-state";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { ModalShell } from "@/components/team-operations/modal-shell";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import {
  formatAdWheelSeatPrice,
  type AdWheelRecord,
  type TeamAdWheelParticipantResult,
  type TeamAdWheelRecord,
} from "@/lib/ad-wheels";
import type { PublicationView } from "@/lib/app-shell/types";
import { formatCompactNumber, formatDateTime } from "@/lib/app-shell/utils";
import type { TeamMemberRecord } from "@/lib/team-members.schema";
import { teamOperationRequest } from "@/lib/team-operations";

type TeamWheelsClientProps = {
  initialRows: TeamAdWheelRecord[];
  publications: PublicationView[];
  sponsors: TeamMemberRecord[];
};

type WheelEditorState =
  | {
      mode: "create";
    }
  | {
      mode: "edit";
      wheelId: string;
    }
  | null;

type SeatManagerState = {
  wheelId: string;
} | null;

const primaryButtonClassName =
  "rounded-full bg-app-text px-4 py-2.5 text-sm font-semibold text-app-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "rounded-full border border-app-border bg-app-card px-4 py-2.5 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-60";

const inputClassName =
  "w-full rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition placeholder:text-app-text-soft focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft disabled:cursor-not-allowed disabled:bg-app-surface-muted disabled:text-app-text-soft";
const selectTriggerClassName =
  "flex w-full items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-card px-4 py-3 text-left text-sm text-app-text outline-none transition hover:border-app-border-strong hover:bg-app-surface-muted focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60";

type PremiumSelectOption = {
  value: string;
  label: string;
  description?: string;
};

type PremiumSelectProps = {
  id: string;
  value: string;
  placeholder: string;
  options: PremiumSelectOption[];
  open: boolean;
  disabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onValueChange: (value: string) => void;
};

function PremiumSelect({
  id,
  value,
  placeholder,
  options,
  open,
  disabled,
  onOpenChange,
  onValueChange,
}: PremiumSelectProps) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
        className={selectTriggerClassName}
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">
            {selectedOption?.label ?? placeholder}
          </span>
          {selectedOption?.description ? (
            <span className="mt-1 block truncate text-xs font-normal text-app-text-soft">
              {selectedOption.description}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-app-text-soft transition ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          id={`${id}-listbox`}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-72 overflow-y-auto rounded-2xl border border-app-border bg-app-card p-1 shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
        >
          {options.length > 0 ? (
            options.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onValueChange(option.value);
                    onOpenChange(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-app-text transition hover:bg-app-surface-muted focus:bg-app-surface-muted focus:outline-none"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">
                      {option.label}
                    </span>
                    {option.description ? (
                      <span className="mt-1 block truncate text-xs text-app-text-soft">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  {isSelected ? (
                    <Check className="h-4 w-4 shrink-0 text-app-accent" />
                  ) : null}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-3 text-sm text-app-text-soft">
              Sin opciones disponibles
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

const sortRows = (rows: TeamAdWheelRecord[]) => {
  const statusOrder = {
    ACTIVE: 0,
    DRAFT: 1,
    COMPLETED: 2,
  } satisfies Record<TeamAdWheelRecord["status"], number>;

  return [...rows].sort((left, right) => {
    const statusDelta = statusOrder[left.status] - statusOrder[right.status];

    if (statusDelta !== 0) {
      return statusDelta;
    }

    return (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  });
};

const getCampaignDurationDays = (startDate: string, endDate: string) => {
  const durationMs =
    new Date(endDate).getTime() - new Date(startDate).getTime();

  return Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24)));
};

const toDateInputValue = (value: string) => value.slice(0, 10);
const toIsoDateStart = (value: string) => `${value}T00:00:00.000Z`;
const canEditWheelSchedule = (wheel: TeamAdWheelRecord) =>
  wheel.status === "DRAFT" || Date.now() < new Date(wheel.startDate).getTime();
const normalizePublicationPath = (pathPrefix: string) =>
  pathPrefix === "/" ? "/" : pathPrefix;
const buildCampaignUrl = (wheel: TeamAdWheelRecord) => {
  if (!wheel.publication) {
    return null;
  }

  const baseUrl = `https://${wheel.publication.domainHost}${normalizePublicationPath(
    wheel.publication.pathPrefix,
  )}`;
  const separator = baseUrl.includes("?") ? "&" : "?";

  return `${baseUrl}${separator}awid=${encodeURIComponent(wheel.id)}`;
};
const toWheelPublication = (publication: PublicationView | undefined) =>
  publication
    ? {
        id: publication.id,
        pathPrefix: publication.pathPrefix,
        domainHost: publication.domainHost,
        funnelName: publication.funnelName,
        funnelCode: publication.funnelCode,
      }
    : null;
const getSponsorOptionLabel = (member: TeamMemberRecord) =>
  member.displayName ?? member.fullName;
const getSponsorOptionRole = (member: TeamMemberRecord) => {
  if (member.role === "TEAM_ADMIN") {
    return "Team Admin";
  }

  if (member.role === "SUPER_ADMIN") {
    return "Super Admin";
  }

  return "Member";
};

export function TeamWheelsClient({
  initialRows,
  publications,
  sponsors,
}: TeamWheelsClientProps) {
  const [rows, setRows] = useState(() => sortRows(initialRows));
  const [editorState, setEditorState] = useState<WheelEditorState>(null);
  const [seatManagerState, setSeatManagerState] =
    useState<SeatManagerState>(null);
  const [formPublicationId, setFormPublicationId] = useState("");
  const [formName, setFormName] = useState("");
  const [formSeatPrice, setFormSeatPrice] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formDurationDays, setFormDurationDays] = useState("30");
  const [seatSponsorId, setSeatSponsorId] = useState("");
  const [seatCount, setSeatCount] = useState("1");
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeCount = rows.filter((item) => item.status === "ACTIVE").length;
  const enrolledSponsors = rows.reduce(
    (total, item) => total + item.participantCount,
    0,
  );
  const totalSeats = rows.reduce((total, item) => total + item.totalSeatCount, 0);
  const editingWheel =
    editorState?.mode === "edit"
      ? rows.find((wheel) => wheel.id === editorState.wheelId) ?? null
      : null;
  const scheduleIsEditable =
    editorState?.mode === "create"
      ? true
      : editingWheel
        ? canEditWheelSchedule(editingWheel)
        : false;
  const managingWheel = seatManagerState
    ? rows.find((wheel) => wheel.id === seatManagerState.wheelId) ?? null
    : null;
  const publicationOptions = publications.map((publication) => ({
    value: publication.id,
    label: publication.funnelName,
    description: `${publication.domainHost}${publication.pathPrefix}`,
  }));
  const sponsorOptions = sponsors.flatMap((member) =>
    member.sponsorId
      ? [
          {
            value: member.sponsorId,
            label: getSponsorOptionLabel(member),
            description: `${getSponsorOptionRole(member)} · ${member.email}`,
          },
        ]
      : [],
  );

  const resetEditorForm = () => {
    setFormPublicationId(publications[0]?.id ?? "");
    setFormName("");
    setFormSeatPrice("");
    setFormStartDate("");
    setFormDurationDays("30");
  };

  const openCreateModal = () => {
    resetEditorForm();
    setOpenSelectId(null);
    setFormStartDate(toDateInputValue(new Date().toISOString()));
    setEditorState({
      mode: "create",
    });
  };

  const openEditModal = (wheel: TeamAdWheelRecord) => {
    setOpenSelectId(null);
    setFormPublicationId(wheel.publicationId ?? publications[0]?.id ?? "");
    setFormName(wheel.name);
    setFormSeatPrice((wheel.seatPrice / 100).toFixed(2));
    setFormStartDate(toDateInputValue(wheel.startDate));
    setFormDurationDays(String(getCampaignDurationDays(wheel.startDate, wheel.endDate)));
    setEditorState({
      mode: "edit",
      wheelId: wheel.id,
    });
  };

  const openSeatManager = (wheel: TeamAdWheelRecord) => {
    const firstSponsorId = sponsorOptions[0]?.value ?? "";
    const currentParticipant = wheel.participants.find(
      (participant) => participant.sponsorId === firstSponsorId,
    );

    setOpenSelectId(null);
    setSeatManagerState({ wheelId: wheel.id });
    setSeatSponsorId(firstSponsorId);
    setSeatCount(String(currentParticipant?.seatCount ?? 1));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const normalizedName = formName.trim();
    const seatPriceUnits = Number(formSeatPrice);
    const durationDays = Number(formDurationDays);
    const startDate = formStartDate.trim();
    const publicationId = formPublicationId.trim();

    if (!normalizedName) {
      setFeedback({
        tone: "error",
        message: "Asigna un nombre claro para la rueda.",
      });
      return;
    }

    if (!publicationId) {
      setFeedback({
        tone: "error",
        message: "Selecciona el funnel/publicación que recibirá este tráfico.",
      });
      return;
    }

    if (!startDate) {
      setFeedback({
        tone: "error",
        message: "Selecciona una fecha de inicio para la campaña.",
      });
      return;
    }

    if (!Number.isFinite(seatPriceUnits) || seatPriceUnits <= 0) {
      setFeedback({
        tone: "error",
        message: "Ingresa un precio de asiento mayor que cero.",
      });
      return;
    }

    if (!Number.isInteger(durationDays) || durationDays < 1) {
      setFeedback({
        tone: "error",
        message: "Ingresa una duración válida para la campaña.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          name: normalizedName,
          publicationId,
          seatPrice: Math.round(seatPriceUnits * 100),
          startDate: toIsoDateStart(startDate),
          durationDays,
        };
        const record = await teamOperationRequest<AdWheelRecord>(
          editorState?.mode === "edit"
            ? `/team/wheels/${editorState.wheelId}`
            : "/team/wheels",
          {
            method: editorState?.mode === "edit" ? "PATCH" : "POST",
            body: JSON.stringify(
              editorState?.mode === "edit"
                ? payload
                : {
                    ...payload,
                    status: "ACTIVE",
                  },
            ),
          },
        );

        setRows((current) => {
          if (editorState?.mode === "edit") {
            return sortRows(
              current.map((row) =>
                row.id === record.id
                  ? {
                      ...row,
                      ...record,
                      publication:
                        toWheelPublication(
                          publications.find(
                            (item) => item.id === record.publicationId,
                          ),
                        ) ?? row.publication,
                    }
                  : row,
              ),
            );
          }

          const publication = publications.find(
            (item) => item.id === record.publicationId,
          );

          return sortRows([
            {
              ...record,
              participantCount: 0,
              totalSeatCount: 0,
              publication: toWheelPublication(publication),
              participants: [],
            },
            ...current,
          ]);
        });
        resetEditorForm();
        setEditorState(null);
        setOpenSelectId(null);
        setFeedback({
          tone: "success",
          message:
            editorState?.mode === "edit"
              ? "La rueda publicitaria quedó actualizada."
              : "La rueda publicitaria quedó creada y activa para buy-ins.",
        });
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos guardar la rueda publicitaria.",
        });
      }
    });
  };

  const handleSeatSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!managingWheel) {
      return;
    }

    const normalizedSponsorId = seatSponsorId.trim();
    const parsedSeatCount = Number(seatCount);

    if (!normalizedSponsorId) {
      setFeedback({
        tone: "error",
        message: "Selecciona el sponsor que recibirá asientos.",
      });
      return;
    }

    if (!Number.isInteger(parsedSeatCount) || parsedSeatCount < 0) {
      setFeedback({
        tone: "error",
        message: "Ingresa una cantidad de asientos igual o mayor que cero.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await teamOperationRequest<TeamAdWheelParticipantResult>(
          `/team/wheels/${managingWheel.id}/participants`,
          {
            method: "POST",
            body: JSON.stringify({
              sponsorId: normalizedSponsorId,
              seatCount: parsedSeatCount,
            }),
          },
        );

        setRows((current) =>
          sortRows(
            current.map((row) =>
              row.id === result.wheel.id ? result.wheel : row,
            ),
          ),
        );
        setSeatManagerState(null);
        setOpenSelectId(null);
        setFeedback({
          tone: "success",
          message: "Los asientos de la rueda quedaron actualizados.",
        });
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos actualizar los asientos.",
        });
      }
    });
  };

  const handleCopyCampaignUrl = async (wheel: TeamAdWheelRecord) => {
    const campaignUrl = buildCampaignUrl(wheel);

    if (!campaignUrl) {
      setFeedback({
        tone: "error",
        message: "Asigna una publicación a esta rueda antes de copiar el enlace.",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(campaignUrl);
      setFeedback({
        tone: "success",
        message: "Enlace de ads copiado al portapapeles.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message: "No pudimos copiar el enlace automáticamente.",
      });
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Bolsa Común"
        title="Ruedas publicitarias del team"
        description="Administra la campaña activa, su precio de asiento y la adopción real de sponsors dentro de la bolsa común."
        actions={
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
              openCreateModal();
            }}
            disabled={publications.length === 0}
            className={primaryButtonClassName}
          >
            Crear Rueda
          </button>
        }
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Ruedas Totales"
          value={formatCompactNumber(rows.length)}
          hint="Historial operativo disponible para el team."
        />
        <KpiCard
          label="Activas"
          value={formatCompactNumber(activeCount)}
          hint="Bolsa común abierta hoy para nuevos buy-ins."
        />
        <KpiCard
          label="Sponsors Dentro"
          value={formatCompactNumber(enrolledSponsors)}
          hint="Asientos ya comprados entre todas las ruedas."
        />
        <KpiCard
          label="Asientos Activos"
          value={formatCompactNumber(totalSeats)}
          hint="Capacidad total pendiente para tráfico de ads."
        />
        <KpiCard
          label="Ultima Actividad"
          value={rows[0] ? formatDateTime(rows[0].createdAt) : "Sin datos"}
          hint="La rueda más reciente creada por operaciones."
        />
      </section>

      {rows.length > 0 ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {rows.map((wheel) => (
            <article
              key={wheel.id}
              className="rounded-[2rem] border border-app-border bg-[linear-gradient(180deg,var(--app-surface)_0%,var(--app-card)_100%)] p-6 text-app-text shadow-[var(--ai-panel-shadow)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                    Ad Co-op
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-app-text">
                    {wheel.name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-app-text-muted">
                    Ventana operativa desde {formatDateTime(wheel.startDate)} hasta{" "}
                    {formatDateTime(wheel.endDate)}.
                  </p>
                  <p className="mt-3 text-sm font-semibold text-app-text">
                    {wheel.publication
                      ? `${wheel.publication.funnelName} · ${wheel.publication.domainHost}${wheel.publication.pathPrefix}`
                      : "Sin funnel asignado"}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <StatusBadge value={wheel.status} />
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openSeatManager(wheel)}
                      className={`${secondaryButtonClassName} inline-flex items-center gap-2`}
                    >
                      <Users className="h-4 w-4" aria-hidden="true" />
                      Gestionar Asientos
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(wheel)}
                      className={`${secondaryButtonClassName} inline-flex items-center gap-2`}
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Editar
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-[1.5rem] border border-app-border bg-app-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">
                    Precio del Asiento
                  </p>
                  <p className="mt-3 text-lg font-semibold text-app-text">
                    {formatAdWheelSeatPrice(wheel.seatPrice)}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-app-border bg-app-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">
                    Participantes
                  </p>
                  <p className="mt-3 text-lg font-semibold text-app-text">
                    {formatCompactNumber(wheel.participantCount)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-app-text-muted">
                    {formatCompactNumber(wheel.totalSeatCount)} asientos disponibles.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-app-border bg-app-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">
                    Duración
                  </p>
                  <p className="mt-3 text-lg font-semibold text-app-text">
                    {getCampaignDurationDays(wheel.startDate, wheel.endDate)} días
                  </p>
                  <p className="mt-2 text-sm leading-6 text-app-text-muted">
                    Finaliza {formatDateTime(wheel.endDate)}.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-[1.5rem] border border-app-border bg-app-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-app-text-soft">
                      Enlace de Ads
                    </p>
                    <p className="mt-3 break-all text-sm font-semibold text-app-text">
                      {buildCampaignUrl(wheel) ?? "Asigna un funnel para generar el enlace."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyCampaignUrl(wheel)}
                    disabled={!wheel.publication}
                    className={`${secondaryButtonClassName} inline-flex items-center gap-2`}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Copiar
                  </button>
                </div>
              </div>

              {wheel.participants.length > 0 ? (
                <div className="mt-4 grid gap-2">
                  {wheel.participants.map((participant) => (
                    <div
                      key={participant.sponsorId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-surface-muted px-4 py-3 text-sm"
                    >
                      <span className="font-semibold text-app-text">
                        {participant.sponsorName}
                      </span>
                      <span className="text-app-text-muted">
                        {formatCompactNumber(participant.seatCount)} asientos
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : (
        <EmptyState
          title="Sin ruedas publicitarias"
          description="Crea la primera rueda activa para abrir la bolsa común y empezar a vender asientos a los sponsors del team."
        />
      )}

      {editorState ? (
        <ModalShell
          title={
            editorState.mode === "edit"
              ? "Editar rueda publicitaria"
              : "Crear rueda publicitaria"
          }
          description={
            editorState.mode === "edit"
              ? "Ajusta nombre, precio y calendario. Si la rueda ya comenzó, solo podrás cambiar el nombre."
              : "Define el nombre, el seat price, la fecha de inicio y la duración para abrir la rueda."
          }
          onClose={() => {
            if (isPending) {
              return;
            }

            setEditorState(null);
            setOpenSelectId(null);
          }}
        >
          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-app-text">
                Funnel / Publicación
              </span>
              <PremiumSelect
                id="wheel-publication"
                value={formPublicationId}
                placeholder="Selecciona un funnel"
                options={publicationOptions}
                open={openSelectId === "wheel-publication"}
                disabled={publicationOptions.length === 0}
                onOpenChange={(isOpen) =>
                  setOpenSelectId(isOpen ? "wheel-publication" : null)
                }
                onValueChange={setFormPublicationId}
              />
              <p className="text-sm leading-6 text-app-text-soft">
                El awid de esta rueda solo funcionará para esta publicación.
              </p>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-app-text">
                Nombre
              </span>
              <input
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                placeholder="Abril Premium"
                className={inputClassName}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-app-text">
                Seat Price
              </span>
              <input
                type="number"
                min="1"
                step="0.01"
                value={formSeatPrice}
                onChange={(event) => setFormSeatPrice(event.target.value)}
                placeholder="50"
                disabled={!scheduleIsEditable}
                className={inputClassName}
              />
              <p className="text-sm leading-6 text-app-text-soft">
                Ingresa el valor en USD. Ejemplo: `50` envía `5000` centavos al
                backend; `50.25` envía `5025`.
              </p>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-app-text">
                Start Date
              </span>
              <input
                type="date"
                value={formStartDate}
                onChange={(event) => setFormStartDate(event.target.value)}
                disabled={!scheduleIsEditable}
                className={inputClassName}
              />
              <p className="text-sm leading-6 text-app-text-soft">
                Selecciona la fecha exacta en la que la rueda debe comenzar.
              </p>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-app-text">
                Duración de la campaña
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={formDurationDays}
                onChange={(event) => setFormDurationDays(event.target.value)}
                placeholder="30"
                disabled={!scheduleIsEditable}
                className={inputClassName}
              />
              <p className="text-sm leading-6 text-app-text-soft">
                Ingresa el total de días. El API recalculará la fecha de
                finalización automáticamente.
              </p>
            </label>

            {editorState.mode === "edit" && !scheduleIsEditable ? (
              <OperationBanner
                tone="error"
                message="Esta rueda ya comenzó. Solo puedes cambiar el nombre; el precio y las fechas quedaron bloqueados."
              />
            ) : null}

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditorState(null);
                  setOpenSelectId(null);
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
                {isPending
                  ? editorState.mode === "edit"
                    ? "Guardando..."
                    : "Creando..."
                  : editorState.mode === "edit"
                    ? "Guardar Cambios"
                    : "Guardar Rueda"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {managingWheel ? (
        <ModalShell
          title="Gestionar asientos"
          description={`Asigna asientos de tráfico pagado para ${managingWheel.name}.`}
          onClose={() => {
            if (isPending) {
              return;
            }

            setSeatManagerState(null);
            setOpenSelectId(null);
          }}
        >
          <form className="space-y-5" onSubmit={handleSeatSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-app-text">
                Sponsor
              </span>
              <PremiumSelect
                id="wheel-sponsor"
                value={seatSponsorId}
                placeholder="Selecciona un sponsor"
                options={sponsorOptions}
                open={openSelectId === "wheel-sponsor"}
                disabled={sponsorOptions.length === 0}
                onOpenChange={(isOpen) =>
                  setOpenSelectId(isOpen ? "wheel-sponsor" : null)
                }
                onValueChange={(nextSponsorId) => {
                  setSeatSponsorId(nextSponsorId);
                  const currentParticipant = managingWheel.participants.find(
                    (participant) => participant.sponsorId === nextSponsorId,
                  );
                  setSeatCount(String(currentParticipant?.seatCount ?? 1));
                }}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-app-text">
                Asientos
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={seatCount}
                onChange={(event) => setSeatCount(event.target.value)}
                className={inputClassName}
              />
              <p className="text-sm leading-6 text-app-text-soft">
                Esta cantidad reemplaza los asientos actuales del sponsor en la rueda.
              </p>
            </label>

            {managingWheel.participants.length > 0 ? (
              <div className="space-y-2 rounded-[1.5rem] border border-app-border bg-app-card p-4">
                {managingWheel.participants.map((participant) => (
                  <div
                    key={participant.sponsorId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="font-semibold text-app-text">
                      {participant.sponsorName}
                    </span>
                    <span className="text-app-text-muted">
                      {formatCompactNumber(participant.seatCount)} asientos
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setSeatManagerState(null);
                  setOpenSelectId(null);
                }}
                disabled={isPending}
                className={secondaryButtonClassName}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending || sponsorOptions.length === 0}
                className={primaryButtonClassName}
              >
                {isPending ? "Guardando..." : "Guardar Asientos"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}
