"use client";

import { useState, useTransition } from "react";
import { EmptyState } from "@/components/app-shell/empty-state";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { ModalShell } from "@/components/team-operations/modal-shell";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import {
  formatAdWheelSeatPrice,
  type TeamAdWheelRecord,
} from "@/lib/ad-wheels";
import { formatCompactNumber, formatDateTime } from "@/lib/app-shell/utils";
import { teamOperationRequest } from "@/lib/team-operations";

type TeamWheelsClientProps = {
  initialRows: TeamAdWheelRecord[];
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

const primaryButtonClassName =
  "rounded-full bg-app-text px-4 py-2.5 text-sm font-semibold text-app-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "rounded-full border border-app-border bg-app-card px-4 py-2.5 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-60";

const inputClassName =
  "w-full rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition placeholder:text-app-text-soft focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft disabled:cursor-not-allowed disabled:bg-app-surface-muted disabled:text-app-text-soft";

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

export function TeamWheelsClient({ initialRows }: TeamWheelsClientProps) {
  const [rows, setRows] = useState(() => sortRows(initialRows));
  const [editorState, setEditorState] = useState<WheelEditorState>(null);
  const [formName, setFormName] = useState("");
  const [formSeatPrice, setFormSeatPrice] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formDurationDays, setFormDurationDays] = useState("30");
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

  const resetEditorForm = () => {
    setFormName("");
    setFormSeatPrice("");
    setFormStartDate("");
    setFormDurationDays("30");
  };

  const openCreateModal = () => {
    resetEditorForm();
    setFormStartDate(toDateInputValue(new Date().toISOString()));
    setEditorState({
      mode: "create",
    });
  };

  const openEditModal = (wheel: TeamAdWheelRecord) => {
    setFormName(wheel.name);
    setFormSeatPrice((wheel.seatPrice / 100).toFixed(2));
    setFormStartDate(toDateInputValue(wheel.startDate));
    setFormDurationDays(String(getCampaignDurationDays(wheel.startDate, wheel.endDate)));
    setEditorState({
      mode: "edit",
      wheelId: wheel.id,
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const normalizedName = formName.trim();
    const seatPriceUnits = Number(formSeatPrice);
    const durationDays = Number(formDurationDays);
    const startDate = formStartDate.trim();

    if (!normalizedName) {
      setFeedback({
        tone: "error",
        message: "Asigna un nombre claro para la rueda.",
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
          seatPrice: Math.round(seatPriceUnits * 100),
          startDate: toIsoDateStart(startDate),
          durationDays,
        };
        const record = await teamOperationRequest<
          Omit<TeamAdWheelRecord, "participantCount">
        >(
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
                    }
                  : row,
              ),
            );
          }

          return sortRows([{ ...record, participantCount: 0 }, ...current]);
        });
        resetEditorForm();
        setEditorState(null);
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
            className={primaryButtonClassName}
          >
            Crear Rueda
          </button>
        }
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                </div>

                <div className="flex flex-col items-end gap-3">
                  <StatusBadge value={wheel.status} />
                  <button
                    type="button"
                    onClick={() => openEditModal(wheel)}
                    className={secondaryButtonClassName}
                  >
                    Editar
                  </button>
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
          }}
        >
          <form className="space-y-5" onSubmit={handleSubmit}>
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
                min="1"
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
                onClick={() => setEditorState(null)}
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
    </div>
  );
}
