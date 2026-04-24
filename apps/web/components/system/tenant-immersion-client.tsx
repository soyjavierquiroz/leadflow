"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { ModalShell } from "@/components/team-operations/modal-shell";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { formatCompactNumber, formatDateTime, toSentenceCase } from "@/lib/app-shell/utils";
import type {
  SystemFunnelTemplateRecord,
  SystemTenantDomainRecord,
  SystemTenantDetailRecord,
  SystemTenantFunnelRecord,
} from "@/lib/system-tenants.types";
import { authenticatedOperationRequest } from "@/lib/team-operations";

type TenantImmersionClientProps = {
  teamId: string;
  initialTenant: SystemTenantDetailRecord;
  initialDomains: SystemTenantDomainRecord[];
  initialFunnels: SystemTenantFunnelRecord[];
};

type ImmersionTab = "overview" | "funnels" | "domains";

type CloneFormState = {
  templateFunnelId: string;
  newName: string;
};

type DomainFormState = {
  hostname: string;
  funnelId: string;
};

const primaryButtonClassName =
  "rounded-full bg-app-text px-4 py-2 text-sm font-semibold text-app-bg transition hover:opacity-92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "rounded-full border border-app-border bg-app-card px-4 py-2 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60";

const buildInitialCloneFormState = (): CloneFormState => ({
  templateFunnelId: "",
  newName: "",
});

const buildInitialDomainFormState = (): DomainFormState => ({
  hostname: "",
  funnelId: "",
});

const tabs: Array<{
  id: ImmersionTab;
  label: string;
  description: string;
}> = [
  {
    id: "overview",
    label: "Resumen",
    description: "Salud operativa y contrato base del tenant.",
  },
  {
    id: "funnels",
    label: "Funnels",
    description: "Activos propios y clonación desde librería.",
  },
  {
    id: "domains",
    label: "Dominios",
    description: "Hosts del tenant y funnel enlazado para salida publica.",
  },
];

const buildTenantStatusBadgeClassName = (isActive: boolean) =>
  isActive
    ? "border-app-success-border bg-app-success-bg text-app-success-text"
    : "border-app-border bg-app-surface-muted text-app-text-muted";

const buildVerificationBadgeClassName = (isVerified: boolean) =>
  isVerified
    ? "border-app-success-border bg-app-success-bg text-app-success-text"
    : "border-app-warning-border bg-app-warning-bg text-app-warning-text";

const isTemplateEngineFunnel = (config: unknown) =>
  Boolean(
    config &&
      typeof config === "object" &&
      !Array.isArray(config) &&
      "source" in config &&
      (config as { source?: unknown }).source === "global-template-engine" &&
      "blocks" in config,
  );

export function TenantImmersionClient({
  teamId,
  initialTenant,
  initialDomains,
  initialFunnels,
}: TenantImmersionClientProps) {
  const router = useRouter();
  const [tenant, setTenant] = useState(initialTenant);
  const [activeTab, setActiveTab] = useState<ImmersionTab>("overview");
  const [domains, setDomains] = useState(initialDomains);
  const [funnels, setFunnels] = useState(initialFunnels);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isAddDomainOpen, setIsAddDomainOpen] = useState(false);
  const [isLoadingDomains, setIsLoadingDomains] = useState(false);
  const [isLoadingFunnels, setIsLoadingFunnels] = useState(false);
  const [templateOptions, setTemplateOptions] = useState<
    SystemFunnelTemplateRecord[] | null
  >(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [cloneFormState, setCloneFormState] = useState(
    buildInitialCloneFormState(),
  );
  const [domainFormState, setDomainFormState] = useState(
    buildInitialDomainFormState(),
  );
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setTenant(initialTenant);
  }, [initialTenant]);

  useEffect(() => {
    setFunnels(initialFunnels);
  }, [initialFunnels]);

  useEffect(() => {
    setDomains(initialDomains);
  }, [initialDomains]);

  useEffect(() => {
    if (!isAssignOpen || templateOptions !== null || isLoadingTemplates) {
      return;
    }

    let isCancelled = false;

    const loadTemplates = async () => {
      setIsLoadingTemplates(true);

      try {
        const payload = await authenticatedOperationRequest<
          SystemFunnelTemplateRecord[]
        >("/system/funnels/templates", {
          method: "GET",
        });

        if (!isCancelled) {
          setTemplateOptions(payload);
        }
      } catch (error) {
        if (!isCancelled) {
          setFeedback({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : "No pudimos cargar la librería de funnels.",
          });
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingTemplates(false);
        }
      }
    };

    void loadTemplates();

    return () => {
      isCancelled = true;
    };
  }, [isAssignOpen, isLoadingTemplates, templateOptions]);

  const closeAssignModal = () => {
    setIsAssignOpen(false);
    setCloneFormState(buildInitialCloneFormState());
  };

  const closeDomainModal = () => {
    setIsAddDomainOpen(false);
    setDomainFormState(buildInitialDomainFormState());
  };

  const reloadFunnels = async () => {
    setIsLoadingFunnels(true);

    try {
      const payload = await authenticatedOperationRequest<
        SystemTenantFunnelRecord[]
      >(`/system/tenants/${encodeURIComponent(teamId)}/funnels`, {
        method: "GET",
      });

      setFunnels(payload);
      setTenant((current) => ({
        ...current,
        funnelCount: payload.length,
      }));
      return payload;
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos refrescar los funnels del tenant.",
      });
      return null;
    } finally {
      setIsLoadingFunnels(false);
    }
  };

  const reloadDomains = async () => {
    setIsLoadingDomains(true);

    try {
      const payload = await authenticatedOperationRequest<
        SystemTenantDomainRecord[]
      >(`/system/tenants/${encodeURIComponent(teamId)}/domains`, {
        method: "GET",
      });

      setDomains(payload);
      setTenant((current) => ({
        ...current,
        domainCount: payload.length,
      }));
      return payload;
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos refrescar los dominios del tenant.",
      });
      return null;
    } finally {
      setIsLoadingDomains(false);
    }
  };

  const handleCloneSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const templateFunnelId = cloneFormState.templateFunnelId.trim();
    const newName = cloneFormState.newName.trim();

    if (!templateFunnelId) {
      setFeedback({
        tone: "error",
        message: "Selecciona una plantilla antes de asignarla al tenant.",
      });
      return;
    }

    startTransition(async () => {
      try {
        await authenticatedOperationRequest<SystemTenantFunnelRecord>(
          `/system/funnels/${encodeURIComponent(templateFunnelId)}/clone`,
          {
            method: "POST",
            body: JSON.stringify({
              targetTeamId: teamId,
              newName: newName || undefined,
            }),
          },
        );

        const nextFunnels = await reloadFunnels();
        closeAssignModal();

        if (nextFunnels) {
          setActiveTab("funnels");
          setFeedback({
            tone: "success",
            message:
              "Funnel asignado correctamente. La tabla ya refleja la nueva clonación.",
          });
        }
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos asignar la plantilla al tenant.",
        });
      }
    });
  };

  const handleCreateDomainSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const hostname = domainFormState.hostname.trim();
    const funnelId = domainFormState.funnelId.trim();

    if (!hostname) {
      setFeedback({
        tone: "error",
        message: "Escribe un hostname valido antes de registrar el dominio.",
      });
      return;
    }

    startTransition(async () => {
      try {
        await authenticatedOperationRequest<SystemTenantDomainRecord>(
          `/system/tenants/${encodeURIComponent(teamId)}/domains`,
          {
            method: "POST",
            body: JSON.stringify({
              hostname,
              funnelId: funnelId || undefined,
            }),
          },
        );

        const nextDomains = await reloadDomains();
        closeDomainModal();

        if (nextDomains) {
          setActiveTab("domains");
          setFeedback({
            tone: "success",
            message:
              "Dominio registrado correctamente. La tabla ya refleja el host y su funnel enlazado.",
          });
        }
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos crear el dominio para este tenant.",
        });
      }
    });
  };

  const linkedDomainCount = domains.filter((domain) => domain.linkedFunnelId).length;
  const verifiedDomainCount = domains.filter(
    (domain) => domain.verificationStatus === "verified",
  ).length;

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={`Super Admin / Tenant / ${tenant.code}`}
        title={tenant.name}
        description={`Workspace ${tenant.workspace.name} (${tenant.workspace.slug}). Desde aquí operas los recursos propios del tenant ${tenant.isActive ? "activo" : "inactivo"} sin salir del control plane.`}
        actions={
          <>
            <span
              className={`inline-flex items-center rounded-full border px-3 py-2 text-sm font-semibold ${buildTenantStatusBadgeClassName(
                tenant.isActive,
              )}`}
            >
              {tenant.isActive ? "Activo" : "Inactivo"}
            </span>
            <Link href="/admin/tenants" className={secondaryButtonClassName}>
              Volver a tenants
            </Link>
          </>
        }
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <div className="rounded-[1.85rem] border border-app-border bg-app-card p-3 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
        <div className="grid gap-2 md:grid-cols-3">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-[1.35rem] border px-4 py-4 text-left transition ${
                  isActive
                    ? "border-app-text bg-app-text text-app-bg shadow-[0_18px_50px_rgba(15,23,42,0.18)]"
                    : "border-app-border bg-app-surface-muted text-app-text-muted hover:border-app-border-strong hover:bg-app-card"
                }`}
              >
                <p className="text-sm font-semibold">{tab.label}</p>
                <p
                  className={`mt-2 text-sm leading-6 ${
                    isActive ? "text-app-bg" : "text-app-text-soft"
                  }`}
                >
                  {tab.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "overview" ? (
        <div className="space-y-8">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Asientos contratados"
              value={formatCompactNumber(tenant.maxSeats)}
              hint="Capacidad comprometida para sponsors y operación del tenant."
            />
            <KpiCard
              label="Asientos ocupados"
              value={formatCompactNumber(tenant.occupiedSeats)}
              hint="Sponsors activos que ya consumen capacidad real."
            />
            <KpiCard
              label="Funnels propios"
              value={formatCompactNumber(tenant.funnelCount)}
              hint="Embudos asignados directamente al equipo desde plataforma."
            />
            <KpiCard
              label="Dominios"
              value={formatCompactNumber(tenant.domainCount)}
              hint="Hosts reservados para futuras publicaciones y rollout."
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[2rem] border border-app-border bg-app-card p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-accent">
                Resumen operativo
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-app-text">
                Datos base del tenant
              </h2>
              <dl className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-app-border bg-app-surface-muted p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                    Workspace
                  </dt>
                  <dd className="mt-3 text-lg font-semibold text-app-text">
                    {tenant.workspace.name}
                  </dd>
                  <p className="mt-1 text-sm text-app-text-muted">
                    {tenant.workspace.slug}
                  </p>
                </div>
                <div className="rounded-3xl border border-app-border bg-app-surface-muted p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                    Estado del team
                  </dt>
                  <dd className="mt-3">
                    <StatusBadge value={tenant.status} />
                  </dd>
                  <p className="mt-3 text-sm text-app-text-muted">
                    Operación {tenant.isActive ? "activa" : "inactiva"}.
                  </p>
                </div>
                <div className="rounded-3xl border border-app-border bg-app-surface-muted p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                    Suscripción
                  </dt>
                  <dd className="mt-3 text-lg font-semibold text-app-text">
                    {formatDateTime(tenant.subscriptionExpiresAt)}
                  </dd>
                  <p className="mt-1 text-sm text-app-text-muted">
                    Si no hay fecha, el tenant sigue sin vencimiento cargado.
                  </p>
                </div>
                <div className="rounded-3xl border border-app-border bg-app-surface-muted p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                    Capacidad disponible
                  </dt>
                  <dd className="mt-3 text-lg font-semibold text-app-text">
                    {formatCompactNumber(tenant.availableSeats)}
                  </dd>
                  <p className="mt-1 text-sm text-app-text-muted">
                    Asientos restantes antes de nuevas activaciones.
                  </p>
                </div>
              </dl>
            </div>

            <div className="rounded-[2rem] border border-app-border bg-app-card p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-accent">
                Identidad y rollout
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-app-text">
                Señales visibles
              </h2>
              <div className="mt-6 space-y-4">
                <div className="rounded-3xl border border-app-border bg-app-surface-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                    Zona horaria
                  </p>
                  <p className="mt-2 text-sm font-semibold text-app-text">
                    {tenant.workspace.timezone}
                  </p>
                </div>
                <div className="rounded-3xl border border-app-border bg-app-surface-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                    Moneda / locale
                  </p>
                  <p className="mt-2 text-sm font-semibold text-app-text">
                    {tenant.workspace.defaultCurrency} / {tenant.workspace.primaryLocale}
                  </p>
                </div>
                <div className="rounded-3xl border border-app-border bg-app-surface-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                    Dominio principal del workspace
                  </p>
                  <p className="mt-2 text-sm font-semibold text-app-text">
                    {tenant.workspace.primaryDomain ?? "Sin dominio principal"}
                  </p>
                </div>
                <div className="rounded-3xl border border-app-border bg-app-surface-muted p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                    Descripción interna
                  </p>
                  <p className="mt-2 text-sm leading-6 text-app-text-muted">
                    {tenant.description ??
                      "Todavía no hay una descripción operativa para este tenant."}
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "funnels" ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-[2rem] border border-app-border bg-app-card p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)] md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-accent">
                Funnels del tenant
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-app-text">
                Biblioteca asignada a {tenant.name}
              </h2>
              <p className="mt-3 text-sm leading-7 text-app-text-muted">
                Aquí solo aparecen funnels propios del tenant. Desde la librería
                puedes clonar una plantilla base y dejarla lista en este mismo
                equipo.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setFeedback(null);
                  setIsAssignOpen(true);
                }}
                className={primaryButtonClassName}
              >
                Asignar desde Librería
              </button>
              <button
                type="button"
                onClick={() => {
                  void reloadFunnels();
                }}
                disabled={isLoadingFunnels}
                className={secondaryButtonClassName}
              >
                {isLoadingFunnels ? "Recargando..." : "Recargar lista"}
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard
              label="Funnels visibles"
              value={formatCompactNumber(funnels.length)}
              hint="Solo clones y funnels operativos que pertenecen al tenant."
            />
            <KpiCard
              label="Funnels activos"
              value={formatCompactNumber(
                funnels.filter((funnel) => funnel.status === "active").length,
              )}
              hint="Embudo listo para operación inmediata o publicación futura."
            />
            <KpiCard
              label="Canales de entrada"
              value={formatCompactNumber(
                new Set(
                  funnels.flatMap((funnel) => funnel.entrySources),
                ).size,
              )}
              hint="Variedad de fuentes configuradas en la base actual del tenant."
            />
          </div>

          <DataTable
            columns={[
              {
                key: "funnel",
                header: "Funnel",
                render: (row) => (
                  <div>
                    <p className="font-semibold text-app-text">{row.name}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">
                      {row.code}
                    </p>
                  </div>
                ),
              },
              {
                key: "description",
                header: "Descripcion",
                render: (row) => (
                  <p className="max-w-md text-sm leading-6 text-app-text-muted">
                    {row.description?.trim() || "Sin descripcion operativa."}
                  </p>
                ),
              },
              {
                key: "status",
                header: "Estado",
                render: (row) => <StatusBadge value={row.status} />,
              },
              {
                key: "entrySources",
                header: "Entradas",
                render: (row) =>
                  row.entrySources.length > 0
                    ? row.entrySources.map((source) => toSentenceCase(source)).join(", ")
                    : "Sin fuentes configuradas",
              },
              {
                key: "stages",
                header: "Etapas",
                render: (row) => formatCompactNumber(row.stages.length),
              },
              {
                key: "updatedAt",
                header: "Actualizado",
                render: (row) => formatDateTime(row.updatedAt),
              },
              {
                key: "actions",
                header: "Acciones",
                render: (row) => (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        isTemplateEngineFunnel(row.config)
                          ? `/admin/tenants/${encodeURIComponent(teamId)}/funnels/${encodeURIComponent(row.id)}/edit`
                          : `/admin/tenants/${encodeURIComponent(teamId)}/funnels/${encodeURIComponent(row.id)}/builder`,
                      )
                    }
                    className={secondaryButtonClassName}
                  >
                    {isTemplateEngineFunnel(row.config)
                      ? "Editar Funnel JSON"
                      : "Abrir Funnel Builder"}
                  </button>
                ),
              },
            ]}
            rows={funnels}
            emptyTitle="Este tenant aún no tiene funnels propios"
            emptyDescription="Asigna una plantilla desde la librería para crear el primer funnel operativo de este equipo."
          />
        </div>
      ) : null}

      {activeTab === "domains" ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-[2rem] border border-app-border bg-app-card p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)] md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-accent">
                Dominios del tenant
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-app-text">
                Inventario publico de {tenant.name}
              </h2>
              <p className="mt-3 text-sm leading-7 text-app-text-muted">
                Registra el hostname del cliente, enlaza uno de los funnels que
                ya pertenece al tenant y deja lista la salida publica desde el
                control plane.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setFeedback(null);
                  setIsAddDomainOpen(true);
                  void reloadFunnels();
                }}
                className={primaryButtonClassName}
              >
                Añadir Dominio
              </button>
              <button
                type="button"
                onClick={() => {
                  void reloadDomains();
                }}
                disabled={isLoadingDomains}
                className={secondaryButtonClassName}
              >
                {isLoadingDomains ? "Recargando..." : "Recargar lista"}
              </button>
            </div>
          </div>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Dominios registrados"
              value={formatCompactNumber(domains.length)}
              hint="Conteo actual de hosts ligados a este tenant."
            />
            <KpiCard
              label="Verificados"
              value={formatCompactNumber(verifiedDomainCount)}
              hint="Hosts cuyo onboarding ya marca verificacion completa."
            />
            <KpiCard
              label="Con funnel"
              value={formatCompactNumber(linkedDomainCount)}
              hint="Dominios que ya quedaron enchufados a un funnel del tenant."
            />
            <KpiCard
              label="Dominio principal"
              value={tenant.workspace.primaryDomain ?? "Pendiente"}
              hint="Referencia del workspace mientras operas hosts dedicados."
            />
          </section>

          <DataTable
            columns={[
              {
                key: "host",
                header: "Hostname",
                render: (row) => (
                  <div>
                    <p className="font-semibold text-app-text">{row.host}</p>
                    <p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">
                      {row.normalizedHost}
                    </p>
                  </div>
                ),
              },
              {
                key: "status",
                header: "Estado",
                render: (row) => {
                  const isVerified = row.verificationStatus === "verified";

                  return (
                    <span
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${buildVerificationBadgeClassName(
                        isVerified,
                      )}`}
                    >
                      {isVerified ? "Verificado" : "Pendiente"}
                    </span>
                  );
                },
              },
              {
                key: "linkedFunnel",
                header: "Funnel enlazado",
                render: (row) => {
                  const linkedFunnel = funnels.find(
                    (funnel) => funnel.id === row.linkedFunnelId,
                  );

                  if (!linkedFunnel) {
                    return "Sin funnel enlazado";
                  }

                    return (
                      <div>
                      <p className="font-semibold text-app-text">
                        {linkedFunnel.name}
                      </p>
                      <p className="text-xs uppercase tracking-[0.18em] text-app-text-soft">
                        {linkedFunnel.code}
                      </p>
                    </div>
                  );
                },
              },
              {
                key: "updatedAt",
                header: "Actualizado",
                render: (row) => formatDateTime(row.updatedAt),
              },
            ]}
            rows={domains}
            emptyTitle="Este tenant aún no tiene dominios registrados"
            emptyDescription="Añade el primer hostname del cliente y enlázalo a uno de sus funnels para completar la salida publica."
          />
        </div>
      ) : null}

      {isAssignOpen ? (
        <ModalShell
          eyebrow="System Funnels Library"
          title={`Asignar funnel a ${tenant.name}`}
          description="Selecciona una plantilla de la librería global y clónala dentro de este tenant. El nuevo funnel quedará ligado al team actual."
          onClose={closeAssignModal}
        >
          <form className="space-y-5" onSubmit={handleCloneSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-app-text-muted">
                Plantilla base
              </span>
              <select
                value={cloneFormState.templateFunnelId}
                onChange={(event) =>
                  setCloneFormState((current) => ({
                    ...current,
                    templateFunnelId: event.target.value,
                  }))
                }
                disabled={isLoadingTemplates || isPending}
                className="mt-2 w-full rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft disabled:cursor-not-allowed disabled:bg-app-surface-muted"
              >
                <option value="">
                  {isLoadingTemplates
                    ? "Cargando librería..."
                    : "Selecciona una plantilla"}
                </option>
                {(templateOptions ?? []).map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.code})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-app-text-muted">
                Nombre del clon (opcional)
              </span>
              <input
                type="text"
                value={cloneFormState.newName}
                onChange={(event) =>
                  setCloneFormState((current) => ({
                    ...current,
                    newName: event.target.value,
                  }))
                }
                placeholder="Copia de Funnel Base Premium"
                disabled={isPending}
                className="mt-2 w-full rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft disabled:cursor-not-allowed disabled:bg-app-surface-muted"
              />
            </label>

            <div className="rounded-3xl border border-app-border bg-app-surface-muted px-4 py-4 text-sm leading-6 text-app-text-muted">
              El backend recibirá `targetTeamId={teamId}` para clonar la
              plantilla sobre este tenant y luego refrescar la tabla sin salir
              de la vista de inmersión.
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeAssignModal}
                disabled={isPending}
                className={secondaryButtonClassName}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  isPending ||
                  isLoadingTemplates ||
                  (templateOptions?.length ?? 0) === 0
                }
                className={primaryButtonClassName}
              >
                {isPending ? "Asignando..." : "Clonar al tenant"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {isAddDomainOpen ? (
        <ModalShell
          eyebrow="Tenant Domains"
          title={`Añadir dominio para ${tenant.name}`}
          description="Registra el hostname publico del cliente y, si ya corresponde, enlázalo a un funnel propio del tenant."
          onClose={closeDomainModal}
        >
          <form className="space-y-5" onSubmit={handleCreateDomainSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-app-text-muted">
                Hostname
              </span>
              <input
                type="text"
                value={domainFormState.hostname}
                onChange={(event) =>
                  setDomainFormState((current) => ({
                    ...current,
                    hostname: event.target.value,
                  }))
                }
                placeholder="campana.agencia.com"
                disabled={isPending}
                className="mt-2 w-full rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft disabled:cursor-not-allowed disabled:bg-app-surface-muted"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-app-text-muted">
                Enlazar a Funnel
              </span>
              <select
                value={domainFormState.funnelId}
                onChange={(event) =>
                  setDomainFormState((current) => ({
                    ...current,
                    funnelId: event.target.value,
                  }))
                }
                disabled={isPending || isLoadingFunnels}
                className="mt-2 w-full rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft disabled:cursor-not-allowed disabled:bg-app-surface-muted"
              >
                <option value="">
                  {isLoadingFunnels
                    ? "Cargando funnels..."
                    : "Sin enlace inicial"}
                </option>
                {funnels.map((funnel) => (
                  <option key={funnel.id} value={funnel.id}>
                    {funnel.name} ({funnel.code})
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-3xl border border-app-border bg-app-surface-muted px-4 py-4 text-sm leading-6 text-app-text-muted">
              El backend registrará el dominio directamente sobre este
              `teamId`, y si eliges un funnel verificará que también pertenezca
              al tenant antes de persistir el enlace.
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeDomainModal}
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
                {isPending ? "Creando..." : "Registrar dominio"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

    </div>
  );
}
