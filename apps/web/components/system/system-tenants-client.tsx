"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
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
import {
  createSystemTenantSchema,
  editSystemTenantSchema,
  tenantProvisioningStatuses,
  type EditSystemTenantFormValues,
} from "@/lib/system-tenant-form.schema";
import { formatCompactNumber, formatDateTime } from "@/lib/app-shell/utils";
import { authenticatedOperationRequest } from "@/lib/team-operations";

type SystemTenantsClientProps = {
  initialRows: SystemTenantRecord[];
};

type TenantProvisionFormState = {
  tenantName: string;
  adminEmail: string;
};

type TenantStatusFilter =
  | "all"
  | "active"
  | "suspended"
  | "pending"
  | "archived";
type CreatedAtFilter = "all" | "7d" | "30d" | "90d";
type TenantFormErrors = Partial<
  Record<keyof EditSystemTenantFormValues, string>
>;

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

const buildEditFormState = (
  row: SystemTenantRecord,
): EditSystemTenantFormValues => {
  const provisioningStatus = normalizeProvisioningStatus(row);

  return {
    tenantName: row.name,
    adminEmail: row.managerEmail ?? "",
    subdomain: row.workspaceSlug,
    provisioningStatus:
      provisioningStatus === "archived" ? "pending" : provisioningStatus,
  };
};

const normalizeProvisioningStatus = (
  row: Pick<SystemTenantRecord, "status" | "isActive">,
): EditSystemTenantFormValues["provisioningStatus"] | "archived" => {
  const status = row.status.toLowerCase();

  if (status === "archived") {
    return "archived";
  }

  if (status === "pending" || status === "draft") {
    return "pending";
  }

  if (status === "suspended" || row.isActive === false) {
    return "suspended";
  }

  return "active";
};

const provisioningStatusLabel: Record<
  EditSystemTenantFormValues["provisioningStatus"] | "archived",
  string
> = {
  active: "Activa",
  suspended: "Suspendida",
  pending: "Pendiente",
  archived: "Archivado",
};

const createdAtFilterLabel: Record<CreatedAtFilter, string> = {
  all: "Todas",
  "7d": "7 días",
  "30d": "30 días",
  "90d": "90 días",
};

const mapZodErrors = (
  issues: Array<{ path: PropertyKey[]; message: string }>,
): TenantFormErrors =>
  issues.reduce<TenantFormErrors>((errors, issue) => {
    const [field] = issue.path;

    if (typeof field === "string") {
      return {
        ...errors,
        [field]: issue.message,
      };
    }

    return errors;
  }, {});

const getStatusFlags = (
  status: EditSystemTenantFormValues["provisioningStatus"],
) => ({
  status,
  isActive: status === "active",
});

const getProvisioningStatusBadgeClassName = (
  status: EditSystemTenantFormValues["provisioningStatus"] | "archived",
) => {
  if (status === "active") {
    return "border-emerald-400/35 bg-emerald-400/10 text-emerald-200";
  }

  if (status === "pending") {
    return "border-amber-300/35 bg-amber-300/10 text-amber-200";
  }

  if (status === "suspended") {
    return "border-rose-300/35 bg-rose-300/10 text-rose-200";
  }

  return "border-slate-500/40 bg-slate-700/35 text-slate-300";
};

export function SystemTenantsClient({
  initialRows,
}: SystemTenantsClientProps) {
  const router = useRouter();
  const toastTimeoutRef = useRef<number | null>(null);
  const [rows, setRows] = useState(initialRows);
  const [statusFilter, setStatusFilter] = useState<TenantStatusFilter>("all");
  const [createdAtFilter, setCreatedAtFilter] = useState<CreatedAtFilter>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [formState, setFormState] = useState(buildInitialFormState);
  const [editFormState, setEditFormState] =
    useState<EditSystemTenantFormValues | null>(null);
  const [editFormErrors, setEditFormErrors] = useState<TenantFormErrors>({});
  const [pendingArchiveTenantId, setPendingArchiveTenantId] = useState<
    string | null
  >(null);
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

  const visibleRows = useMemo(() => {
    const now = Date.now();
    const createdAfter =
      createdAtFilter === "all"
        ? null
        : now - Number(createdAtFilter.replace("d", "")) * 24 * 60 * 60 * 1000;

    return rows.filter((row) => {
      const normalizedStatus = normalizeProvisioningStatus(row);
      const matchesStatus =
        statusFilter === "all"
          ? normalizedStatus !== "archived"
          : normalizedStatus === statusFilter;
      const matchesCreatedAt =
        createdAfter === null ||
        new Date(row.createdAt).getTime() >= createdAfter;

      return matchesStatus && matchesCreatedAt;
    });
  }, [createdAtFilter, rows, statusFilter]);

  const archivedCount = rows.filter(
    (row) => normalizeProvisioningStatus(row) === "archived",
  ).length;
  const totalSeats = visibleRows.reduce((sum, row) => sum + row.maxSeats, 0);
  const occupiedSeats = visibleRows.reduce(
    (sum, row) => sum + row.occupiedSeats,
    0,
  );
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

  const openEditModal = (row: SystemTenantRecord) => {
    resetMessages();
    setEditingTenantId(row.id);
    setEditFormState(buildEditFormState(row));
    setEditFormErrors({});
    setIsEditOpen(true);
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setEditingTenantId(null);
    setEditFormState(null);
    setEditFormErrors({});
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    const parsed = createSystemTenantSchema.safeParse(formState);

    if (!parsed.success) {
      setFeedback({
        tone: "error",
        message:
          parsed.error.issues[0]?.message ??
          "Completa nombre de agencia y correo del administrador.",
      });
      return;
    }

    const { tenantName, adminEmail } = parsed.data;

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

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetMessages();

    if (!editingTenantId || !editFormState) {
      return;
    }

    const parsed = editSystemTenantSchema.safeParse(editFormState);

    if (!parsed.success) {
      setEditFormErrors(mapZodErrors(parsed.error.issues));
      return;
    }

    const previousRows = rows;
    const nextFlags = getStatusFlags(parsed.data.provisioningStatus);

    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === editingTenantId
          ? {
              ...row,
              name: parsed.data.tenantName,
              workspaceName: parsed.data.tenantName,
              workspaceSlug: parsed.data.subdomain,
              managerEmail: parsed.data.adminEmail,
              status: nextFlags.status,
              isActive: nextFlags.isActive,
            }
          : row,
      ),
    );
    closeEditModal();

    startTransition(async () => {
      try {
        const updated = await authenticatedOperationRequest<SystemTenantRecord>(
          `/system/tenants/${encodeURIComponent(editingTenantId)}`,
          {
            method: "PATCH",
            body: JSON.stringify(parsed.data),
          },
        );

        setRows((currentRows) =>
          currentRows.map((row) =>
            row.id === updated.id ? { ...row, ...updated } : row,
          ),
        );
        showToast(
          "Agencia actualizada",
          "Los cambios quedaron sincronizados con permisos de Super Admin.",
        );
        router.refresh();
      } catch (error) {
        setRows(previousRows);
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos actualizar la agencia.",
        });
      }
    });
  };

  const handleArchive = (row: SystemTenantRecord) => {
    resetMessages();

    if (
      !window.confirm(
        `Archivar ${row.name}? La agencia saldrá de la vista principal sin eliminar sus datos.`,
      )
    ) {
      return;
    }

    const previousRows = rows;
    setPendingArchiveTenantId(row.id);
    setRows((currentRows) =>
      currentRows.filter((current) => current.id !== row.id),
    );

    startTransition(async () => {
      try {
        await authenticatedOperationRequest<SystemTenantRecord>(
          `/system/tenants/${encodeURIComponent(row.id)}/archive`,
          {
            method: "PATCH",
            body: JSON.stringify({}),
          },
        );
        showToast(
          "Agencia archivada",
          "Quedó oculta de las vistas principales y la data se conserva.",
        );
        router.refresh();
      } catch (error) {
        setRows(previousRows);
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos archivar la agencia.",
        });
      } finally {
        setPendingArchiveTenantId(null);
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
    <div className="flex flex-col gap-8">
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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-app-success-text">
            Operación completada
          </p>
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
          label="Agencias visibles"
          value={formatCompactNumber(visibleRows.length)}
          hint="Tenants dentro de los filtros activos de operación."
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

      <section className="flex w-full flex-col gap-4 rounded-[1.75rem] border border-app-border bg-app-card p-4 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-app-text-soft">
              Filtros de operación
            </p>
            <p className="mt-1 text-sm text-app-text-muted">
              {visibleRows.length} agencias visibles
              {archivedCount > 0 ? `, ${archivedCount} archivadas` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", ...tenantProvisioningStatuses, "archived"] as const).map(
              (status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    statusFilter === status
                      ? "border-app-accent bg-app-accent-soft text-app-accent"
                      : "border-app-border bg-app-surface-muted text-app-text-muted hover:border-app-border-strong hover:text-app-text"
                  }`}
                >
                  {status === "all" ? "Todos" : provisioningStatusLabel[status]}
                </button>
              ),
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(createdAtFilterLabel) as CreatedAtFilter[]).map(
            (filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setCreatedAtFilter(filter)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  createdAtFilter === filter
                    ? "border-app-accent bg-app-accent-soft text-app-accent"
                    : "border-app-border bg-app-surface-muted text-app-text-muted hover:border-app-border-strong hover:text-app-text"
                }`}
              >
                {createdAtFilterLabel[filter]}
              </button>
            ),
          )}
        </div>
      </section>

      <DataTable
        columns={[
          {
            key: "agency",
            header: "Agencias",
            render: (row) => {
              const status = normalizeProvisioningStatus(row);
              const isArchived = status === "archived";

              return (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/tenants/${row.id}`}
                      className={`font-semibold transition hover:text-app-accent hover:underline ${
                        isArchived ? "text-slate-300" : "text-app-text"
                      }`}
                    >
                      {row.name}
                    </Link>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${getProvisioningStatusBadgeClassName(
                        status,
                      )}`}
                    >
                      {provisioningStatusLabel[status]}
                    </span>
                  </div>
                  <p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">
                    {row.workspaceSlug}
                  </p>
                  <p
                    className={`text-xs font-semibold uppercase tracking-[0.18em] ${
                      isArchived ? "text-slate-500" : "text-app-accent"
                    }`}
                  >
                    {isArchived
                      ? "Archivado para limpieza"
                      : "Abrir mesa de operaciones"}
                  </p>
                </div>
              );
            },
          },
          {
            key: "admin",
            header: "Admin",
            render: (row) => (
              <div className="flex flex-col gap-1">
                <p className="font-medium text-app-text">{row.workspaceName}</p>
                <p className="text-xs text-app-text-soft">
                  {row.managerEmail ?? "Admin pendiente"}
                </p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Estado",
            render: (row) => {
              const status = normalizeProvisioningStatus(row);

              return (
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getProvisioningStatusBadgeClassName(
                    status,
                  )}`}
                >
                  {provisioningStatusLabel[status]}
                </span>
              );
            },
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
              <div className="flex flex-col gap-1">
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
            render: (row) => {
              const isArchived = normalizeProvisioningStatus(row) === "archived";

              return (
                <div className="flex flex-col items-start gap-2">
                  <Link
                    href={`/admin/tenants/${row.id}`}
                    className="text-sm font-semibold text-app-text-muted transition hover:text-app-accent hover:underline"
                  >
                    Ver operación
                  </Link>
                  <button
                    type="button"
                    onClick={() => openEditModal(row)}
                    className={secondaryButtonClassName}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleImpersonate(row)}
                    disabled={
                      isArchived ||
                      !row.managerUserId ||
                      impersonatingTenantId === row.id
                    }
                    className={secondaryButtonClassName}
                  >
                    {impersonatingTenantId === row.id
                      ? "Ingresando..."
                      : "Ingresar como Cliente"}
                  </button>
                  {isArchived ? (
                    <span className="rounded-full border border-slate-500/40 bg-slate-700/35 px-4 py-2 text-sm font-semibold text-slate-300">
                      Archivado
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleArchive(row)}
                      disabled={pendingArchiveTenantId === row.id}
                      className="rounded-full border border-app-border bg-app-surface-muted px-4 py-2 text-sm font-semibold text-app-text-muted transition hover:border-app-danger-border hover:text-app-danger-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {pendingArchiveTenantId === row.id
                        ? "Archivando..."
                        : "Archivar"}
                    </button>
                  )}
                </div>
              );
            },
          },
        ]}
        rows={visibleRows}
        getRowClassName={(row) =>
          normalizeProvisioningStatus(row) === "archived" ? "opacity-60" : ""
        }
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
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-slate-200">
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
                placeholder="Nombre comercial"
                className="mt-2 w-full rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-200">
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
                placeholder="admin@dominio.com"
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

      {isEditOpen && editFormState ? (
        <ModalShell
          eyebrow="Super Admin"
          title="Editar agencia"
          description="Actualiza el administrador, subdominio y estado de aprovisionamiento con validación antes de tocar producción."
          onClose={closeEditModal}
        >
          <form className="flex flex-col gap-5" onSubmit={handleEditSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-slate-200">
                Nombre de la agencia
              </span>
              <input
                type="text"
                value={editFormState.tenantName}
                onChange={(event) =>
                  setEditFormState((current) =>
                    current
                      ? {
                          ...current,
                          tenantName: event.target.value,
                        }
                      : current,
                  )
                }
                className="mt-2 w-full rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft"
                aria-invalid={Boolean(editFormErrors.tenantName)}
                required
              />
              {editFormErrors.tenantName ? (
                <p className="mt-2 text-xs font-semibold text-app-danger-text">
                  {editFormErrors.tenantName}
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-200">
                Correo del administrador
              </span>
              <input
                type="email"
                value={editFormState.adminEmail}
                onChange={(event) =>
                  setEditFormState((current) =>
                    current
                      ? {
                          ...current,
                          adminEmail: event.target.value,
                        }
                      : current,
                  )
                }
                className="mt-2 w-full rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft"
                aria-invalid={Boolean(editFormErrors.adminEmail)}
                required
              />
              {editFormErrors.adminEmail ? (
                <p className="mt-2 text-xs font-semibold text-app-danger-text">
                  {editFormErrors.adminEmail}
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-200">
                Subdominio asignado
              </span>
              <input
                type="text"
                value={editFormState.subdomain}
                onChange={(event) =>
                  setEditFormState((current) =>
                    current
                      ? {
                          ...current,
                          subdomain: event.target.value,
                        }
                      : current,
                  )
                }
                className="mt-2 w-full rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft"
                aria-invalid={Boolean(editFormErrors.subdomain)}
                required
              />
              {editFormErrors.subdomain ? (
                <p className="mt-2 text-xs font-semibold text-app-danger-text">
                  {editFormErrors.subdomain}
                </p>
              ) : null}
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-200">
                Estado del aprovisionamiento
              </span>
              <select
                value={editFormState.provisioningStatus}
                onChange={(event) =>
                  setEditFormState((current) =>
                    current
                      ? {
                          ...current,
                          provisioningStatus: event.target
                            .value as EditSystemTenantFormValues["provisioningStatus"],
                        }
                      : current,
                  )
                }
                className="mt-2 w-full rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft"
                aria-invalid={Boolean(editFormErrors.provisioningStatus)}
              >
                {tenantProvisioningStatuses.map((status) => (
                  <option key={status} value={status}>
                    {provisioningStatusLabel[status]}
                  </option>
                ))}
              </select>
              {editFormErrors.provisioningStatus ? (
                <p className="mt-2 text-xs font-semibold text-app-danger-text">
                  {editFormErrors.provisioningStatus}
                </p>
              ) : null}
            </label>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeEditModal}
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
                {isPending ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}
