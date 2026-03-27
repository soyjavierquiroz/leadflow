"use client";

import { useState, useTransition } from "react";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { ModalShell } from "@/components/team-operations/modal-shell";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import type { DomainRecord } from "@/lib/app-shell/types";
import { formatCompactNumber, formatDateTime } from "@/lib/app-shell/utils";
import { teamOperationRequest } from "@/lib/team-operations";

type TeamDomainsClientProps = {
  initialRows: DomainRecord[];
};

type DomainFormState = {
  host: string;
  domainType: "system_subdomain" | "custom_apex" | "custom_subdomain";
  isPrimary: boolean;
  canonicalHost: string;
  redirectToPrimary: boolean;
};

const buttonClassName =
  "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const primaryButtonClassName =
  "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";

const buildCreateState = (): DomainFormState => ({
  host: "",
  domainType: "custom_subdomain",
  isPrimary: false,
  canonicalHost: "",
  redirectToPrimary: false,
});

const normalizeRecord = (record: DomainRecord): DomainRecord => ({
  ...record,
  dnsInstructions: record.dnsInstructions ?? [],
});

const resolveDefaultVerificationMethod = (
  domainType: DomainFormState["domainType"],
) => {
  switch (domainType) {
    case "custom_apex":
      return "txt";
    case "system_subdomain":
      return "none";
    default:
      return "cname";
  }
};

const formatStatus = (value: string | null | undefined) => {
  if (!value) {
    return "sin dato";
  }

  return value.replace(/_/g, " ");
};

const describeDomainType = (domainType: DomainRecord["domainType"]) => {
  switch (domainType) {
    case "custom_subdomain":
      return "Flujo recomendado: CNAME simple al target unico del SaaS.";
    case "custom_apex":
      return "Caso avanzado: requiere flattening/ALIAS en el DNS del cliente.";
    default:
      return "Hostname gestionado por Leadflow.";
  }
};

export function TeamDomainsClient({ initialRows }: TeamDomainsClientProps) {
  const [rows, setRows] = useState(initialRows.map(normalizeRecord));
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createState, setCreateState] =
    useState<DomainFormState>(buildCreateState);

  const resetMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleCreate = () => {
    resetMessages();

    startTransition(async () => {
      try {
        const record = await teamOperationRequest<DomainRecord>("/domains", {
          method: "POST",
          body: JSON.stringify({
            host: createState.host,
            domainType: createState.domainType,
            verificationMethod: resolveDefaultVerificationMethod(
              createState.domainType,
            ),
            isPrimary: createState.isPrimary,
            canonicalHost: createState.canonicalHost || null,
            redirectToPrimary: createState.redirectToPrimary,
          }),
        });

        const normalized = normalizeRecord(record);

        setRows((current) => [
          ...current.map((item) =>
            normalized.isPrimary
              ? {
                  ...item,
                  isPrimary: false,
                }
              : item,
          ),
          normalized,
        ]);
        setSuccessMessage(
          normalized.onboardingStatus === "active"
            ? "Dominio activado y listo para publicar."
            : "Dominio registrado. Revisa las instrucciones DNS para completar el onboarding.",
        );
        setIsCreateOpen(false);
        setCreateState(buildCreateState());
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos registrar el dominio.",
        );
      }
    });
  };

  const handleRefresh = (domain: DomainRecord) => {
    resetMessages();

    startTransition(async () => {
      try {
        const record = await teamOperationRequest<DomainRecord>(
          `/domains/${domain.id}/refresh`,
          {
            method: "POST",
            body: JSON.stringify({}),
          },
        );

        setRows((current) =>
          current.map((item) =>
            item.id === domain.id ? normalizeRecord(record) : item,
          ),
        );
        setSuccessMessage("Estado del dominio refrescado.");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos refrescar el dominio.",
        );
      }
    });
  };

  const handlePromotePrimary = (domain: DomainRecord) => {
    resetMessages();

    startTransition(async () => {
      try {
        const record = await teamOperationRequest<DomainRecord>(
          `/domains/${domain.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              isPrimary: true,
              canonicalHost: domain.canonicalHost ?? domain.normalizedHost,
            }),
          },
        );

        setRows((current) =>
          current.map((item) =>
            item.id === domain.id
              ? normalizeRecord(record)
              : {
                  ...item,
                  isPrimary: false,
                },
          ),
        );
        setSuccessMessage("Dominio marcado como principal.");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos actualizar el dominio.",
        );
      }
    });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Domains"
        title="Onboarding de dominios externos"
        description="Aquí el team registra hostnames, obtiene un único CNAME target del SaaS y monitorea estado Cloudflare + SSL antes de publicar funnels por host + path."
        actions={
          <button
            type="button"
            onClick={() => {
              resetMessages();
              setIsCreateOpen(true);
            }}
            className={primaryButtonClassName}
          >
            Registrar dominio
          </button>
        }
      />

      {errorMessage ? (
        <OperationBanner tone="error" message={errorMessage} />
      ) : null}
      {successMessage ? (
        <OperationBanner tone="success" message={successMessage} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Domains"
          value={formatCompactNumber(rows.length)}
          hint="Hosts del team entre operación interna y onboarding SaaS."
        />
        <KpiCard
          label="Activos"
          value={formatCompactNumber(
            rows.filter((item) => item.onboardingStatus === "active").length,
          )}
          hint="Dominios ya listos para soportar publicaciones reales."
        />
        <KpiCard
          label="Pendientes DNS"
          value={formatCompactNumber(
            rows.filter((item) => item.onboardingStatus === "pending_dns")
              .length,
          )}
          hint="Todavía requieren acción del cliente o del team sobre DNS."
        />
        <KpiCard
          label="Pendientes validación"
          value={formatCompactNumber(
            rows.filter(
              (item) => item.onboardingStatus === "pending_validation",
            ).length,
          )}
          hint="Cloudflare ya recibió el hostname pero aún no termina verificación/TLS."
        />
      </section>

      <DataTable
        columns={[
          {
            key: "domain",
            header: "Hostname solicitado",
            render: (row) => (
              <div>
                <p className="font-semibold text-slate-950">
                  {row.requestedHostname}
                </p>
                <p className="text-xs text-slate-500">
                  {row.domainType.replace(/_/g, " ")}
                  {row.isPrimary ? " • principal" : ""}
                </p>
              </div>
            ),
          },
          {
            key: "dns",
            header: "CNAME target",
            render: (row) => (
              <div>
                <p className="font-medium text-slate-950">
                  {row.cnameTarget ?? row.dnsTarget ?? "No aplica"}
                </p>
                <p className="text-xs text-slate-500">
                  Fallback origin:{" "}
                  {row.fallbackOrigin ?? "Gestionado internamente"}
                </p>
              </div>
            ),
          },
          {
            key: "cloudflare",
            header: "Cloudflare",
            render: (row) => (
              <div className="space-y-2">
                <StatusBadge
                  value={row.cloudflareHostnameStatus ?? row.onboardingStatus}
                />
                <p className="text-xs text-slate-500">
                  {row.cloudflareErrorMessage
                    ? row.cloudflareErrorMessage
                    : `Metodo simple: ${formatStatus(row.verificationMethod)}`}
                </p>
              </div>
            ),
          },
          {
            key: "ssl",
            header: "SSL",
            render: (row) => (
              <div className="space-y-2">
                <StatusBadge value={row.sslStatus} />
                <p className="text-xs text-slate-500">
                  Estado Cloudflare SSL:{" "}
                  {formatStatus(row.cloudflareSslStatus ?? row.sslStatus)}
                </p>
              </div>
            ),
          },
          {
            key: "onboarding",
            header: "Estado",
            render: (row) => (
              <div className="space-y-2">
                <StatusBadge value={row.onboardingStatus} />
                <p className="text-xs text-slate-500">
                  Sync: {formatDateTime(row.lastCloudflareSyncAt)}
                </p>
              </div>
            ),
          },
          {
            key: "actions",
            header: "Acciones",
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleRefresh(row)}
                  disabled={isPending}
                  className={buttonClassName}
                >
                  Refresh
                </button>
                {!row.isPrimary ? (
                  <button
                    type="button"
                    onClick={() => handlePromotePrimary(row)}
                    disabled={isPending}
                    className={buttonClassName}
                  >
                    Marcar principal
                  </button>
                ) : null}
                <p className="w-full text-xs text-slate-500">
                  Activado: {formatDateTime(row.activatedAt)}
                </p>
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyTitle="No hay dominios registrados"
        emptyDescription="Registra el primer dominio del team para empezar el onboarding SaaS y luego conectar publicaciones host + path."
      />

      <section className="grid gap-4 xl:grid-cols-2">
        {rows.map((domain) => (
          <article
            key={domain.id}
            className="rounded-[1.85rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  DNS playbook
                </p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">
                  {domain.host}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {describeDomainType(domain.domainType)}
                </p>
              </div>
              <StatusBadge value={domain.onboardingStatus} />
            </div>

            <div className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-950">
                  Hostname solicitado:
                </span>{" "}
                {domain.requestedHostname}
              </p>
              <p>
                <span className="font-semibold text-slate-950">
                  CNAME target único:
                </span>{" "}
                {domain.cnameTarget ?? domain.dnsTarget ?? "No aplica"}
              </p>
              <p>
                <span className="font-semibold text-slate-950">
                  Fallback origin fijo:
                </span>{" "}
                {domain.fallbackOrigin ?? "No aplica"}
              </p>
              <p>
                <span className="font-semibold text-slate-950">
                  Cloudflare:
                </span>{" "}
                {formatStatus(
                  domain.cloudflareHostnameStatus ?? domain.onboardingStatus,
                )}
              </p>
              <p>
                <span className="font-semibold text-slate-950">SSL:</span>{" "}
                {formatStatus(domain.cloudflareSslStatus ?? domain.sslStatus)}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {(domain.dnsInstructions ?? []).length > 0 ? (
                (domain.dnsInstructions ?? []).map((instruction) => (
                  <div
                    key={instruction.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={instruction.status} />
                      <p className="text-sm font-semibold text-slate-950">
                        {instruction.label}
                      </p>
                    </div>
                    <p className="mt-2 break-all text-sm text-slate-700">
                      {instruction.host ? `${instruction.host} -> ` : ""}
                      {instruction.value}
                    </p>
                    {instruction.detail ? (
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {instruction.detail}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  Todavía no hay instrucciones DNS adicionales para este
                  dominio.
                </div>
              )}
            </div>
          </article>
        ))}
      </section>

      {isCreateOpen ? (
        <ModalShell
          title="Registrar dominio"
          description="Leadflow registra el hostname, crea el custom hostname en Cloudflare cuando está configurado y devuelve un único target DNS para el flujo SaaS simple."
          onClose={() => setIsCreateOpen(false)}
        >
          <div className="space-y-4">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Host
              <input
                value={createState.host}
                onChange={(event) =>
                  setCreateState((current) => ({
                    ...current,
                    host: event.target.value,
                  }))
                }
                placeholder="promo.cliente.com"
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Tipo de dominio
                <select
                  value={createState.domainType}
                  onChange={(event) =>
                    setCreateState((current) => {
                      const domainType = event.target
                        .value as DomainFormState["domainType"];

                      return {
                        ...current,
                        domainType,
                      };
                    })
                  }
                  className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
                >
                  <option value="custom_subdomain">custom_subdomain</option>
                  <option value="custom_apex">custom_apex</option>
                  <option value="system_subdomain">system_subdomain</option>
                </select>
                <span className="text-xs font-normal leading-5 text-slate-500">
                  Recomendado: <code>custom_subdomain</code> para flujo simple
                  vía CNAME a <code>customers.exitosos.com</code>.
                </span>
              </label>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p className="font-medium text-slate-950">Flujo operativo</p>
                <p className="mt-2 leading-6">
                  Leadflow prioriza CNAME simple para subdominios. El refresh
                  vuelve a consultar y reimpulsar la validación en Cloudflare
                  sin pedir TXT manual por defecto.
                </p>
              </div>
            </div>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              Canonical host
              <input
                value={createState.canonicalHost}
                onChange={(event) =>
                  setCreateState((current) => ({
                    ...current,
                    canonicalHost: event.target.value,
                  }))
                }
                placeholder="promo.cliente.com"
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={createState.isPrimary}
                onChange={(event) =>
                  setCreateState((current) => ({
                    ...current,
                    isPrimary: event.target.checked,
                  }))
                }
              />
              Marcar como dominio principal del team
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={createState.redirectToPrimary}
                onChange={(event) =>
                  setCreateState((current) => ({
                    ...current,
                    redirectToPrimary: event.target.checked,
                  }))
                }
              />
              Preparar redirect al canonical host cuando ese flujo quede
              habilitado
            </label>

            <div className="flex flex-wrap justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className={buttonClassName}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={isPending || createState.host.trim().length === 0}
                className={primaryButtonClassName}
              >
                Crear dominio
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
