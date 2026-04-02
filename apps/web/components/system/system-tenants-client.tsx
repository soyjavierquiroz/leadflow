"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { ModalShell } from "@/components/team-operations/modal-shell";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import type {
  ProvisionTenantResponse,
  SystemTenantRecord,
} from "@/lib/system-tenants";
import { formatCompactNumber, formatDateTime } from "@/lib/app-shell/utils";
import { authenticatedOperationRequest } from "@/lib/team-operations";

type SystemTenantsClientProps = {
  initialRows: SystemTenantRecord[];
};

type TenantProvisionFormState = {
  workspaceName: string;
  adminName: string;
  adminEmail: string;
  maxSeats: string;
};

type ToastState = {
  title: string;
  description: string | null;
};

const primaryButtonClassName =
  "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const buildInitialFormState = (): TenantProvisionFormState => ({
  workspaceName: "",
  adminName: "",
  adminEmail: "",
  maxSeats: "10",
});

const toTenantRow = (
  response: ProvisionTenantResponse,
): SystemTenantRecord => ({
  id: response.team.id,
  workspaceId: response.workspace.id,
  workspaceName: response.workspace.name,
  workspaceSlug: response.workspace.slug,
  name: response.team.name,
  code: response.team.code,
  status: response.team.status,
  isActive: response.team.isActive,
  subscriptionExpiresAt: response.team.subscriptionExpiresAt,
  maxSeats: response.team.maxSeats,
  occupiedSeats: response.seatUsage.activeSeats,
  activeSponsorsCount: response.seatUsage.activeSeats,
  createdAt: response.team.createdAt,
  updatedAt: response.team.updatedAt,
});

export function SystemTenantsClient({
  initialRows,
}: SystemTenantsClientProps) {
  const router = useRouter();
  const toastTimeoutRef = useRef<number | null>(null);
  const [rows, setRows] = useState(initialRows);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [formState, setFormState] = useState(buildInitialFormState);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const totalSeats = rows.reduce((sum, row) => sum + row.maxSeats, 0);
  const occupiedSeats = rows.reduce((sum, row) => sum + row.occupiedSeats, 0);
  const availableSeats = totalSeats - occupiedSeats;

  const showToast = (title: string, description?: string | null) => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    setToast({
      title,
      description: description ?? null,
    });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
    }, 6000);
  };

  const resetMessages = () => {
    setFeedback(null);
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    setFormState(buildInitialFormState());
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    const workspaceName = formState.workspaceName.trim();
    const adminName = formState.adminName.trim();
    const adminEmail = formState.adminEmail.trim().toLowerCase();
    const maxSeats = Number(formState.maxSeats);

    if (!workspaceName || !adminName || !adminEmail) {
      setFeedback({
        tone: "error",
        message: "Completa nombre de agencia, administrador y correo.",
      });
      return;
    }

    if (!Number.isInteger(maxSeats) || maxSeats < 1) {
      setFeedback({
        tone: "error",
        message: "El límite de asientos debe ser un entero mayor o igual a 1.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const response =
          await authenticatedOperationRequest<ProvisionTenantResponse>(
            "/system/provision-tenant",
            {
              method: "POST",
              body: JSON.stringify({
                workspaceName,
                adminName,
                adminEmail,
                maxSeats,
              }),
            },
          );

        setRows((current) => [toTenantRow(response), ...current]);
        closeCreateModal();
        showToast(
          "Agencia aprovisionada. El Team Admin ha sido creado.",
          response.temporaryPassword
            ? `Password temporal: ${response.temporaryPassword}`
            : null,
        );
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos aprovisionar la nueva agencia.",
        });
      }
    });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Super Admin / Tenants"
        title="Tenants y agencias aprovisionadas"
        description="Aquí el super admin puede revisar capacidad instalada por agencia, detectar ocupación inmediata y dar de alta nuevos clientes sin salir del panel."
        actions={
          <button
            type="button"
            onClick={() => {
              resetMessages();
              setIsCreateOpen(true);
            }}
            className={primaryButtonClassName}
          >
            Aprovisionar Nueva Agencia
          </button>
        }
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      {toast ? (
        <div className="fixed right-4 top-4 z-50 w-full max-w-sm rounded-[1.5rem] border border-emerald-200 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
          <p className="text-sm font-semibold text-slate-950">{toast.title}</p>
          {toast.description ? (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {toast.description}
            </p>
          ) : null}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Agencias"
          value={formatCompactNumber(rows.length)}
          hint="Tenants aprovisionados y visibles para operación de plataforma."
        />
        <KpiCard
          label="Asientos provisionados"
          value={formatCompactNumber(totalSeats)}
          hint="Capacidad total contratada por todas las agencias activas."
        />
        <KpiCard
          label="Asientos ocupados"
          value={formatCompactNumber(occupiedSeats)}
          hint="Sponsors activos que ya consumen capacidad operativa."
        />
        <KpiCard
          label="Capacidad disponible"
          value={formatCompactNumber(availableSeats)}
          hint="Espacio restante antes de nuevas activaciones comerciales."
        />
      </section>

      <DataTable
        columns={[
          {
            key: "agency",
            header: "Agencia",
            render: (row) => (
              <div>
                <p className="font-semibold text-slate-950">{row.name}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {row.code}
                </p>
              </div>
            ),
          },
          {
            key: "workspace",
            header: "Workspace",
            render: (row) => (
              <div className="space-y-1">
                <p className="font-medium text-slate-900">{row.workspaceName}</p>
                <p className="text-xs text-slate-500">{row.workspaceSlug}</p>
              </div>
            ),
          },
          {
            key: "maxSeats",
            header: "Límite de asientos",
            render: (row) => formatCompactNumber(row.maxSeats),
          },
          {
            key: "occupiedSeats",
            header: "Asientos ocupados",
            render: (row) => (
              <div className="space-y-1">
                <p>{formatCompactNumber(row.occupiedSeats)}</p>
                <p className="text-xs text-slate-500">
                  {row.activeSponsorsCount} sponsor
                  {row.activeSponsorsCount === 1 ? "" : "s"} activo
                  {row.activeSponsorsCount === 1 ? "" : "s"}
                </p>
              </div>
            ),
          },
          {
            key: "createdAt",
            header: "Fecha de creación",
            render: (row) => formatDateTime(row.createdAt),
          },
        ]}
        rows={rows}
        emptyTitle="No hay tenants aprovisionados"
        emptyDescription="Cuando se creen nuevas agencias desde este panel aparecerán aquí con su capacidad y ocupación inicial."
      />

      {isCreateOpen ? (
        <ModalShell
          eyebrow="System Provisioning"
          title="Aprovisionar nueva agencia"
          description="Crea el workspace, el team y el Team Admin inicial en una sola operación. Si no se especifica password, el backend generará una credencial temporal."
          onClose={closeCreateModal}
        >
          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Nombre del workspace
              </span>
              <input
                type="text"
                value={formState.workspaceName}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    workspaceName: event.target.value,
                  }))
                }
                placeholder="Agencia Inmobiliaria Sur"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Nombre del Team Admin
              </span>
              <input
                type="text"
                value={formState.adminName}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    adminName: event.target.value,
                  }))
                }
                placeholder="Carlos Manager"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Email del Team Admin
              </span>
              <input
                type="email"
                value={formState.adminEmail}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    adminEmail: event.target.value,
                  }))
                }
                placeholder="carlos@agencia.com"
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Límite de asientos
              </span>
              <input
                type="number"
                min={1}
                step={1}
                value={formState.maxSeats}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    maxSeats: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                required
              />
            </label>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
              El aprovisionamiento crea un sponsor activo inicial para el Team
              Admin, por lo que la ocupación arranca con 1 asiento usado.
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeCreateModal}
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
                {isPending ? "Aprovisionando..." : "Crear agencia"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}
