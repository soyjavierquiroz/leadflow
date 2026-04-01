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

const primaryButtonClassName =
  "rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

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

const buildDefaultWindow = () => {
  const startDate = new Date();
  const endDate = new Date(startDate);

  endDate.setDate(endDate.getDate() + 30);

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  };
};

export function TeamWheelsClient({ initialRows }: TeamWheelsClientProps) {
  const [rows, setRows] = useState(() => sortRows(initialRows));
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createSeatPrice, setCreateSeatPrice] = useState("");
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

  const resetCreateState = () => {
    setCreateName("");
    setCreateSeatPrice("");
  };

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const normalizedName = createName.trim();
    const seatPriceUnits = Number(createSeatPrice);

    if (!normalizedName) {
      setFeedback({
        tone: "error",
        message: "Asigna un nombre claro para la rueda.",
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

    const { startDate, endDate } = buildDefaultWindow();

    startTransition(async () => {
      try {
        const record = await teamOperationRequest<
          Omit<TeamAdWheelRecord, "participantCount">
        >("/team/wheels", {
          method: "POST",
          body: JSON.stringify({
            name: normalizedName,
            seatPrice: Math.round(seatPriceUnits * 1_000_000),
            status: "ACTIVE",
            startDate,
            endDate,
          }),
        });

        setRows((current) =>
          sortRows([{ ...record, participantCount: 0 }, ...current]),
        );
        resetCreateState();
        setIsCreateOpen(false);
        setFeedback({
          tone: "success",
          message: "La rueda publicitaria quedó creada y activa para buy-ins.",
        });
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos crear la rueda publicitaria.",
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
              setIsCreateOpen(true);
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
              className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-6 shadow-[0_22px_60px_rgba(15,23,42,0.06)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Ad Co-op
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                    {wheel.name}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Ventana operativa desde {formatDateTime(wheel.startDate)} hasta{" "}
                    {formatDateTime(wheel.endDate)}.
                  </p>
                </div>

                <StatusBadge value={wheel.status} />
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Precio del Asiento
                  </p>
                  <p className="mt-3 text-lg font-semibold text-slate-950">
                    {formatAdWheelSeatPrice(wheel.seatPrice)}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Participantes
                  </p>
                  <p className="mt-3 text-lg font-semibold text-slate-950">
                    {formatCompactNumber(wheel.participantCount)}
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Creada
                  </p>
                  <p className="mt-3 text-lg font-semibold text-slate-950">
                    {formatDateTime(wheel.createdAt)}
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

      {isCreateOpen ? (
        <ModalShell
          title="Crear rueda publicitaria"
          description="Solo definimos nombre y seat price. La rueda nace activa y con una ventana operativa de 30 días desde hoy."
          onClose={() => {
            if (isPending) {
              return;
            }

            setIsCreateOpen(false);
          }}
        >
          <form className="space-y-5" onSubmit={handleCreate}>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-900">
                Nombre
              </span>
              <input
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="Abril Premium"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-900">
                Seat Price
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={createSeatPrice}
                onChange={(event) => setCreateSeatPrice(event.target.value)}
                placeholder="25"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
              <p className="text-sm leading-6 text-slate-500">
                Ingresa el valor en KREDIT enteros. Ejemplo: `25` envía
                `25.000000` al motor financiero.
              </p>
            </label>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
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
                {isPending ? "Creando..." : "Guardar Rueda"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}
