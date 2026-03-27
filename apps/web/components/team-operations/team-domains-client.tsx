"use client";

import type { Dispatch, SetStateAction } from "react";
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

type DeleteDomainResponse = {
  id: string;
  host: string;
  deleted: true;
};

const buttonClassName =
  "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const primaryButtonClassName =
  "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";

const dangerButtonClassName =
  "rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60";

const buildCreateState = (): DomainFormState => ({
  host: "",
  domainType: "custom_subdomain",
  isPrimary: false,
  canonicalHost: "",
  redirectToPrimary: false,
});

const buildStateFromRecord = (record: DomainRecord): DomainFormState => ({
  host: record.host,
  domainType: record.domainType as DomainFormState["domainType"],
  isPrimary: record.isPrimary,
  canonicalHost: record.canonicalHost ?? "",
  redirectToPrimary: record.redirectToPrimary,
});

const sortRows = (rows: DomainRecord[]) =>
  [...rows].sort((left, right) =>
    left.normalizedHost.localeCompare(right.normalizedHost),
  );

const normalizeRecord = (record: DomainRecord): DomainRecord => ({
  ...record,
  dnsInstructions: record.dnsInstructions ?? [],
  operationalStatus: record.operationalStatus ?? record.onboardingStatus,
  isLegacyConfiguration: record.isLegacyConfiguration ?? false,
  recreateRequired: record.recreateRequired ?? false,
  legacyReason: record.legacyReason ?? null,
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

const canEditHostInPatch = (domain: DomainRecord) =>
  domain.cloudflareCustomHostnameId === null &&
  domain.onboardingStatus === "draft";

export function TeamDomainsClient({ initialRows }: TeamDomainsClientProps) {
  const [rows, setRows] = useState(() =>
    sortRows(initialRows.map(normalizeRecord)),
  );
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createState, setCreateState] =
    useState<DomainFormState>(buildCreateState);
  const [editingDomain, setEditingDomain] = useState<DomainRecord | null>(null);
  const [editState, setEditState] = useState<DomainFormState>(buildCreateState);
  const [recreateDomain, setRecreateDomain] = useState<DomainRecord | null>(
    null,
  );
  const [recreateState, setRecreateState] =
    useState<DomainFormState>(buildCreateState);
  const [deleteDomain, setDeleteDomain] = useState<DomainRecord | null>(null);

  const resetMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const upsertRow = (record: DomainRecord) => {
    const normalized = normalizeRecord(record);

    setRows((current) =>
      sortRows(
        [
          ...current
            .filter((item) => item.id !== normalized.id)
            .map((item) =>
              normalized.isPrimary
                ? {
                    ...item,
                    isPrimary: false,
                  }
                : item,
            ),
          normalized,
        ].map((item) => normalizeRecord(item)),
      ),
    );
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

        upsertRow(record);
        setSuccessMessage(
          record.onboardingStatus === "active"
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

        upsertRow(record);
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

  const handleEdit = () => {
    if (!editingDomain) {
      return;
    }

    resetMessages();

    startTransition(async () => {
      try {
        const body: Record<string, unknown> = {
          domainType: editState.domainType,
          verificationMethod: resolveDefaultVerificationMethod(
            editState.domainType,
          ),
          isPrimary: editState.isPrimary,
          canonicalHost: editState.canonicalHost || null,
          redirectToPrimary: editState.redirectToPrimary,
        };

        if (canEditHostInPatch(editingDomain)) {
          body.host = editState.host;
        }

        const record = await teamOperationRequest<DomainRecord>(
          `/domains/${editingDomain.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(body),
          },
        );

        upsertRow(record);
        setEditingDomain(null);
        setSuccessMessage("Dominio actualizado.");
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos actualizar el dominio.",
        );
      }
    });
  };

  const handleRecreate = () => {
    if (!recreateDomain) {
      return;
    }

    resetMessages();

    startTransition(async () => {
      try {
        const record = await teamOperationRequest<DomainRecord>(
          `/domains/${recreateDomain.id}/recreate-onboarding`,
          {
            method: "POST",
            body: JSON.stringify({
              host: recreateState.host,
              domainType: recreateState.domainType,
              verificationMethod: resolveDefaultVerificationMethod(
                recreateState.domainType,
              ),
              isPrimary: recreateState.isPrimary,
              canonicalHost: recreateState.canonicalHost || null,
              redirectToPrimary: recreateState.redirectToPrimary,
            }),
          },
        );

        upsertRow(record);
        setRecreateDomain(null);
        setSuccessMessage(
          "Onboarding recreado. Leadflow limpió el custom hostname anterior y generó el target nuevo del flujo SaaS.",
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos recrear el onboarding.",
        );
      }
    });
  };

  const handleDelete = () => {
    if (!deleteDomain) {
      return;
    }

    resetMessages();

    startTransition(async () => {
      try {
        const response = await teamOperationRequest<DeleteDomainResponse>(
          `/domains/${deleteDomain.id}`,
          {
            method: "DELETE",
            body: JSON.stringify({}),
          },
        );

        setRows((current) => current.filter((item) => item.id !== response.id));
        setDeleteDomain(null);
        setSuccessMessage(`Dominio ${response.host} eliminado.`);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos eliminar el dominio.",
        );
      }
    });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Domains"
        title="Domain management"
        description="Aquí el team limpia dominios heredados, recrea onboarding en Cloudflare y mantiene el flujo SaaS simple sobre customers.leadflow.kurukin.com."
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
          label="Sanos"
          value={formatCompactNumber(
            rows.filter(
              (item) =>
                item.operationalStatus === "active" && !item.recreateRequired,
            ).length,
          )}
          hint="Dominios activos en el modelo nuevo, sin target legado."
        />
        <KpiCard
          label="Recreate required"
          value={formatCompactNumber(
            rows.filter((item) => item.recreateRequired).length,
          )}
          hint="Registros heredados o inconsistentes que deben re-onboardearse."
        />
        <KpiCard
          label="Pendientes"
          value={formatCompactNumber(
            rows.filter(
              (item) =>
                item.operationalStatus === "pending_dns" ||
                item.operationalStatus === "pending_validation",
            ).length,
          )}
          hint="Todavía requieren acción DNS o validación en Cloudflare."
        />
      </section>

      <DataTable
        columns={[
          {
            key: "hostname",
            header: "Hostname",
            render: (row) => (
              <div className="space-y-2">
                <p className="font-semibold text-slate-950">
                  {row.requestedHostname}
                </p>
                <div className="flex flex-wrap gap-2">
                  {row.isPrimary ? <StatusBadge value="primary" /> : null}
                  {row.isLegacyConfiguration ? (
                    <StatusBadge value="legacy" />
                  ) : null}
                  {row.recreateRequired ? (
                    <StatusBadge value="recreate_required" />
                  ) : null}
                </div>
                <p className="text-xs text-slate-500">
                  Canonical: {row.canonicalHost ?? "sin definir"}
                </p>
              </div>
            ),
          },
          {
            key: "type",
            header: "Domain type",
            render: (row) => (
              <div className="space-y-2">
                <StatusBadge value={row.domainType} />
                <p className="text-xs text-slate-500">
                  Verificación: {formatStatus(row.verificationMethod)}
                </p>
              </div>
            ),
          },
          {
            key: "target",
            header: "DNS target actual",
            render: (row) => (
              <div className="space-y-2">
                <p className="font-medium text-slate-950">
                  {row.dnsTarget ?? "No aplica"}
                </p>
                <p className="text-xs text-slate-500">
                  {row.recreateRequired
                    ? "Target sano esperado: customers.leadflow.kurukin.com"
                    : `Fallback interno: ${row.fallbackOrigin ?? "no aplica"}`}
                </p>
              </div>
            ),
          },
          {
            key: "cloudflare",
            header: "Cloudflare status",
            render: (row) => (
              <div className="space-y-2">
                <StatusBadge
                  value={row.cloudflareHostnameStatus ?? row.onboardingStatus}
                />
                <p className="text-xs text-slate-500">
                  {row.cloudflareErrorMessage ??
                    row.legacyReason ??
                    "Sin errores reportados por Cloudflare."}
                </p>
              </div>
            ),
          },
          {
            key: "ssl",
            header: "SSL status",
            render: (row) => (
              <div className="space-y-2">
                <StatusBadge value={row.cloudflareSslStatus ?? row.sslStatus} />
                <p className="text-xs text-slate-500">
                  Estado interno: {formatStatus(row.sslStatus)}
                </p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Estado",
            render: (row) => (
              <div className="space-y-2">
                <StatusBadge value={row.operationalStatus} />
                <p className="text-xs text-slate-500">
                  Onboarding persistido: {formatStatus(row.onboardingStatus)}
                </p>
              </div>
            ),
          },
          {
            key: "sync",
            header: "Last sync",
            render: (row) => (
              <div className="space-y-2 text-xs text-slate-500">
                <p>Último sync: {formatDateTime(row.lastCloudflareSyncAt)}</p>
                <p>Activado: {formatDateTime(row.activatedAt)}</p>
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
                <button
                  type="button"
                  onClick={() => {
                    resetMessages();
                    setEditingDomain(row);
                    setEditState(buildStateFromRecord(row));
                  }}
                  disabled={isPending}
                  className={buttonClassName}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetMessages();
                    setRecreateDomain(row);
                    setRecreateState(buildStateFromRecord(row));
                  }}
                  disabled={isPending}
                  className={primaryButtonClassName}
                >
                  Recrear onboarding
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetMessages();
                    setDeleteDomain(row);
                  }}
                  disabled={isPending}
                  className={dangerButtonClassName}
                >
                  Eliminar
                </button>
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
              <div className="flex flex-wrap justify-end gap-2">
                <StatusBadge value={domain.operationalStatus} />
                {domain.isLegacyConfiguration ? (
                  <StatusBadge value="legacy" />
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-950">Hostname:</span>{" "}
                {domain.requestedHostname}
              </p>
              <p>
                <span className="font-semibold text-slate-950">
                  Domain type:
                </span>{" "}
                {domain.domainType}
              </p>
              <p>
                <span className="font-semibold text-slate-950">
                  DNS target actual:
                </span>{" "}
                {domain.dnsTarget ?? "No aplica"}
              </p>
              <p>
                <span className="font-semibold text-slate-950">
                  Cloudflare status:
                </span>{" "}
                {formatStatus(
                  domain.cloudflareHostnameStatus ?? domain.onboardingStatus,
                )}
              </p>
              <p>
                <span className="font-semibold text-slate-950">SSL:</span>{" "}
                {formatStatus(domain.cloudflareSslStatus ?? domain.sslStatus)}
              </p>
              <p>
                <span className="font-semibold text-slate-950">Last sync:</span>{" "}
                {formatDateTime(domain.lastCloudflareSyncAt)}
              </p>
              {domain.legacyReason ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                  {domain.legacyReason}
                </p>
              ) : null}
            </div>

            <div className="mt-5 space-y-3">
              {(domain.dnsInstructions ?? []).length > 0 ? (
                domain.dnsInstructions?.map((instruction) => (
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
          <DomainForm
            state={createState}
            onChange={setCreateState}
            submitLabel="Crear dominio"
            helperText="Recomendado: custom_subdomain vía CNAME a customers.leadflow.kurukin.com."
            isPending={isPending}
            onCancel={() => setIsCreateOpen(false)}
            onSubmit={handleCreate}
          />
        </ModalShell>
      ) : null}

      {editingDomain ? (
        <ModalShell
          title={`Editar ${editingDomain.host}`}
          description="Edita metadata operativa del dominio. Si necesitas cambiar el hostname de un registro ya onboardeado, usa la acción de recrear onboarding."
          onClose={() => setEditingDomain(null)}
        >
          <DomainForm
            state={editState}
            onChange={setEditState}
            submitLabel="Guardar cambios"
            helperText={
              canEditHostInPatch(editingDomain)
                ? "Este dominio todavía no creó onboarding, así que el host puede ajustarse desde Editar."
                : "Host bloqueado: Leadflow exige recreate-onboarding para cambiar el hostname cuando ya existe target/custom hostname."
            }
            isPending={isPending}
            onCancel={() => setEditingDomain(null)}
            onSubmit={handleEdit}
            disableHost={!canEditHostInPatch(editingDomain)}
          />
        </ModalShell>
      ) : null}

      {recreateDomain ? (
        <ModalShell
          title={`Recrear onboarding de ${recreateDomain.host}`}
          description="Leadflow elimina el custom hostname viejo en Cloudflare, limpia targets heredados y crea un onboarding nuevo sobre customers.leadflow.kurukin.com."
          onClose={() => setRecreateDomain(null)}
        >
          <DomainForm
            state={recreateState}
            onChange={setRecreateState}
            submitLabel="Recrear onboarding"
            helperText="Úsalo para limpiar registros heredados como proxy-fallback.exitosos.com y regenerar el target sano del SaaS."
            isPending={isPending}
            onCancel={() => setRecreateDomain(null)}
            onSubmit={handleRecreate}
          />
        </ModalShell>
      ) : null}

      {deleteDomain ? (
        <ModalShell
          title={`Eliminar ${deleteDomain.host}`}
          description="Esta acción borra el dominio del team y también intenta limpiar su custom hostname en Cloudflare antes de eliminar el registro local."
          onClose={() => setDeleteDomain(null)}
        >
          <div className="space-y-5">
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
              <p>
                Se eliminará <strong>{deleteDomain.host}</strong>. Si el dominio
                estaba asociado a publicaciones, Prisma también las eliminará
                por cascada.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteDomain(null)}
                className={buttonClassName}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className={dangerButtonClassName}
              >
                Eliminar dominio
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

type DomainFormProps = {
  state: DomainFormState;
  onChange: Dispatch<SetStateAction<DomainFormState>>;
  submitLabel: string;
  helperText: string;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  disableHost?: boolean;
};

function DomainForm({
  state,
  onChange,
  submitLabel,
  helperText,
  isPending,
  onCancel,
  onSubmit,
  disableHost = false,
}: DomainFormProps) {
  return (
    <div className="space-y-4">
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Host
        <input
          value={state.host}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              host: event.target.value,
            }))
          }
          disabled={disableHost}
          placeholder="promo.cliente.com"
          className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500 disabled:cursor-not-allowed disabled:bg-slate-100"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Tipo de dominio
          <select
            value={state.domainType}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                domainType: event.target.value as DomainFormState["domainType"],
              }))
            }
            className="rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-slate-500"
          >
            <option value="custom_subdomain">custom_subdomain</option>
            <option value="custom_apex">custom_apex</option>
            <option value="system_subdomain">system_subdomain</option>
          </select>
          <span className="text-xs font-normal leading-5 text-slate-500">
            {helperText}
          </span>
        </label>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-medium text-slate-950">Flujo operativo</p>
          <p className="mt-2 leading-6">
            Leadflow entrega siempre el target público del SaaS y mantiene el
            fallback origin interno fuera del DNS del cliente.
          </p>
        </div>
      </div>

      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Canonical host
        <input
          value={state.canonicalHost}
          onChange={(event) =>
            onChange((current) => ({
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
          checked={state.isPrimary}
          onChange={(event) =>
            onChange((current) => ({
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
          checked={state.redirectToPrimary}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              redirectToPrimary: event.target.checked,
            }))
          }
        />
        Preparar redirect al canonical host cuando ese flujo quede habilitado
      </label>

      <div className="flex flex-wrap justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className={buttonClassName}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isPending || state.host.trim().length === 0}
          className={primaryButtonClassName}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
