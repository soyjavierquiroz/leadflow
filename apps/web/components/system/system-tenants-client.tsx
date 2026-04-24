"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { ModalShell } from "@/components/team-operations/modal-shell";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import type {
  CreateSystemTenantResponse,
  SystemTenantRecord,
} from "@/lib/system-tenants.types";
import { formatCompactNumber, formatDateTime } from "@/lib/app-shell/utils";
import { authenticatedOperationRequest } from "@/lib/team-operations";

type SystemTenantsClientProps = {
  initialRows: SystemTenantRecord[];
};

type TenantProvisionFormState = {
  tenantName: string;
  adminEmail: string;
};

type ToastState = {
  title: string;
  description: string | null;
};

type ImpersonateUserResponse = {
  success: true;
  message: string;
  redirectPath: string;
};

const primaryButtonClassName =
  "rounded-full bg-app-text px-4 py-2 text-sm font-semibold text-app-bg transition hover:opacity-92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "rounded-full border border-app-border bg-app-card px-4 py-2 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60";

const buildInitialFormState = (): TenantProvisionFormState => ({
  tenantName: "",
  adminEmail: "",
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
  const [impersonatingTenantId, setImpersonatingTenantId] = useState<
    string | null
  >(null);

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

    const tenantName = formState.tenantName.trim();
    const adminEmail = formState.adminEmail.trim().toLowerCase();

    if (!tenantName || !adminEmail) {
      setFeedback({
        tone: "error",
        message: "Completa nombre de agencia y correo del administrador.",
      });
      return;
    }

    startTransition(async () => {
      try {
        await authenticatedOperationRequest<CreateSystemTenantResponse>(
          "/system/tenants",
          {
            method: "POST",
            body: JSON.stringify({
              tenantName,
              adminEmail,
            }),
          },
        );

        closeCreateModal();
        showToast("Agencia creada. Accesos enviados.");
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos crear la nueva agencia.",
        });
      }
    });
  };

  const handleImpersonate = async (row: SystemTenantRecord) => {
    resetMessages();

    if (!row.managerUserId) {
      setFeedback({
        tone: "error",
        message:
          "Esta agencia no tiene un TEAM_ADMIN asignado para iniciar la impersonación.",
      });
      return;
    }

    setImpersonatingTenantId(row.id);

    try {
      const payload = await authenticatedOperationRequest<ImpersonateUserResponse>(
        `/system/auth/impersonate/${encodeURIComponent(row.managerUserId)}`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );

      window.location.href = payload.redirectPath || "/team";
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos iniciar la sesión como cliente.",
      });
    } finally {
      setImpersonatingTenantId(null);
    }
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
            Crear Agencia
          </button>
        }
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      {toast ? (
        <div className="fixed right-4 top-4 z-50 w-full max-w-sm rounded-[1.5rem] border border-app-success-border bg-app-card p-4 shadow-[0_24px_70px_rgba(15,23,42,0.16)]">
          <p className="text-sm font-semibold text-app-text">{toast.title}</p>
          {toast.description ? (
            <p className="mt-2 text-sm leading-6 text-app-text-muted">
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
                <Link
                  href={`/admin/tenants/${row.id}`}
                  className="font-semibold text-slate-950 transition hover:text-teal-700 hover:underline"
                >
                  {row.name}
                </Link>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {row.code}
                </p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                  Abrir mesa de operaciones
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
                <p className="font-medium text-app-text">{row.workspaceName}</p>
                <p className="text-xs text-app-text-soft">{row.workspaceSlug}</p>
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
                <p className="text-xs text-app-text-soft">
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
          {
            key: "actions",
            header: "Acciones",
            className: "whitespace-nowrap",
            render: (row) => (
              <div className="flex flex-col items-start gap-2">
                <Link
                  href={`/admin/tenants/${row.id}`}
                  className="text-sm font-semibold text-app-text-muted transition hover:text-app-accent hover:underline"
                >
                  Ver operación
                </Link>
                <button
                  type="button"
                  onClick={() => void handleImpersonate(row)}
                  disabled={!row.managerUserId || impersonatingTenantId === row.id}
                  className={secondaryButtonClassName}
                >
                  {impersonatingTenantId === row.id
                    ? "Ingresando..."
                    : "Ingresar como Cliente"}
                </button>
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyTitle="No hay tenants aprovisionados"
        emptyDescription="Cuando se creen nuevas agencias desde este panel aparecerán aquí con su capacidad y ocupación inicial."
      />

      {isCreateOpen ? (
        <ModalShell
          eyebrow="Super Admin"
          title="Crear agencia"
          description="Da de alta el tenant, genera el usuario administrador inicial y dispara el envio de accesos sin salir del panel."
          onClose={closeCreateModal}
        >
          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-app-text-muted">
                Nombre de la agencia
              </span>
              <input
                type="text"
                value={formState.tenantName}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    tenantName: event.target.value,
                  }))
                }
                placeholder="Agencia Inmobiliaria Sur"
                className="mt-2 w-full rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-app-text-muted">
                Correo del administrador
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
                className="mt-2 w-full rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft"
                required
              />
            </label>

            <div className="rounded-3xl border border-app-border bg-app-surface-muted px-4 py-4 text-sm leading-6 text-app-text-muted">
              El backend genera la password, crea el Team Admin inicial y, si no
              hay proveedor de correo configurado, deja las credenciales visibles
              en los logs del servidor para no perder el acceso.
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
                {isPending ? "Creando..." : "Crear agencia"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}
