"use client";

import { useState, useTransition } from "react";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { PublicationCard } from "@/components/app-shell/publication-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { ModalShell } from "@/components/team-operations/modal-shell";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import type {
  DomainRecord,
  FunnelView,
  HandoffStrategyRecord,
  PublicationView,
  TrackingProfileRecord,
} from "@/lib/app-shell/types";
import { formatCompactNumber } from "@/lib/app-shell/utils";
import { teamOperationRequest } from "@/lib/team-operations";

type TeamPublicationsClientProps = {
  initialRows: PublicationView[];
  domains: DomainRecord[];
  funnels: FunnelView[];
  trackingProfiles: TrackingProfileRecord[];
  handoffStrategies: HandoffStrategyRecord[];
};

type PublicationFormState = {
  domainId: string;
  funnelInstanceId: string;
  pathPrefix: string;
  trackingProfileId: string;
  handoffStrategyId: string;
  isPrimary: boolean;
};

const buttonClassName =
  "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const primaryButtonClassName =
  "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";

const buildCreateState = (
  domains: DomainRecord[],
  funnels: FunnelView[],
  trackingProfiles: TrackingProfileRecord[],
  handoffStrategies: HandoffStrategyRecord[],
): PublicationFormState => ({
  domainId: domains[0]?.id ?? "",
  funnelInstanceId: funnels[0]?.id ?? "",
  pathPrefix: "/",
  trackingProfileId: trackingProfiles[0]?.id ?? "",
  handoffStrategyId: handoffStrategies[0]?.id ?? "",
  isPrimary: false,
});

const buildView = (
  record: {
    id: string;
    workspaceId: string;
    teamId: string;
    domainId: string;
    funnelInstanceId: string;
    trackingProfileId: string | null;
    handoffStrategyId: string | null;
    pathPrefix: string;
    status: string;
    isPrimary: boolean;
    createdAt: string;
    updatedAt: string;
  },
  input: {
    domains: DomainRecord[];
    funnels: FunnelView[];
  },
): PublicationView => {
  const domain = input.domains.find((item) => item.id === record.domainId);
  const funnel = input.funnels.find((item) => item.id === record.funnelInstanceId);

  return {
    ...record,
    domainHost: domain?.host ?? "Host no resuelto",
    funnelName: funnel?.name ?? "Funnel sin instancia",
    funnelCode: funnel?.code ?? "pending",
    templateName: funnel?.templateName ?? "Template sin referencia",
    teamName: funnel?.teamName ?? "Team sin metadata",
    trackingLabel: record.trackingProfileId ? "Tracking conectado" : "Tracking pendiente",
    handoffLabel: record.handoffStrategyId ? "Handoff definido" : "Handoff pendiente",
  };
};

export function TeamPublicationsClient({
  initialRows,
  domains,
  funnels,
  trackingProfiles,
  handoffStrategies,
}: TeamPublicationsClientProps) {
  const [rows, setRows] = useState(initialRows);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<PublicationView | null>(null);
  const [createState, setCreateState] = useState(() =>
    buildCreateState(domains, funnels, trackingProfiles, handoffStrategies),
  );
  const [editState, setEditState] = useState<PublicationFormState | null>(null);

  const resetMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const openEdit = (row: PublicationView) => {
    resetMessages();
    setEditingRow(row);
    setEditState({
      domainId: row.domainId,
      funnelInstanceId: row.funnelInstanceId,
      pathPrefix: row.pathPrefix,
      trackingProfileId: row.trackingProfileId ?? "",
      handoffStrategyId: row.handoffStrategyId ?? "",
      isPrimary: row.isPrimary,
    });
  };

  const handleCreate = () => {
    resetMessages();

    startTransition(async () => {
      try {
        const record = await teamOperationRequest<{
          id: string;
          workspaceId: string;
          teamId: string;
          domainId: string;
          funnelInstanceId: string;
          trackingProfileId: string | null;
          handoffStrategyId: string | null;
          pathPrefix: string;
          status: string;
          isPrimary: boolean;
          createdAt: string;
          updatedAt: string;
        }>("/funnel-publications", {
          method: "POST",
          body: JSON.stringify({
            domainId: createState.domainId,
            funnelInstanceId: createState.funnelInstanceId,
            pathPrefix: createState.pathPrefix,
            trackingProfileId: createState.trackingProfileId || null,
            handoffStrategyId: createState.handoffStrategyId || null,
            isPrimary: createState.isPrimary,
          }),
        });

        setRows((current) => [
          ...current.map((item) =>
            record.isPrimary && item.domainId === record.domainId
              ? {
                  ...item,
                  isPrimary: false,
                }
              : item,
          ),
          buildView(record, { domains, funnels }),
        ]);
        setSuccessMessage("Publicación creada en draft.");
        setIsCreateOpen(false);
        setCreateState(
          buildCreateState(domains, funnels, trackingProfiles, handoffStrategies),
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos crear la publicación.",
        );
      }
    });
  };

  const handleEdit = () => {
    if (!editingRow || !editState) {
      return;
    }

    resetMessages();

    startTransition(async () => {
      try {
        const record = await teamOperationRequest<{
          id: string;
          workspaceId: string;
          teamId: string;
          domainId: string;
          funnelInstanceId: string;
          trackingProfileId: string | null;
          handoffStrategyId: string | null;
          pathPrefix: string;
          status: string;
          isPrimary: boolean;
          createdAt: string;
          updatedAt: string;
        }>(`/funnel-publications/${editingRow.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            domainId: editState.domainId,
            funnelInstanceId: editState.funnelInstanceId,
            pathPrefix: editState.pathPrefix,
            trackingProfileId: editState.trackingProfileId || null,
            handoffStrategyId: editState.handoffStrategyId || null,
            isPrimary: editState.isPrimary,
          }),
        });

        setRows((current) =>
          current.map((item) =>
            item.id === editingRow.id
              ? buildView(record, { domains, funnels })
              : record.isPrimary && item.domainId === record.domainId
                ? {
                    ...item,
                    isPrimary: false,
                  }
                : item,
          ),
        );
        setSuccessMessage("Publicación actualizada.");
        setEditingRow(null);
        setEditState(null);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos actualizar la publicación.",
        );
      }
    });
  };

  const handleStatusToggle = (row: PublicationView) => {
    resetMessages();

    startTransition(async () => {
      try {
        const nextStatus = row.status === "active" ? "draft" : "active";
        const record = await teamOperationRequest<{
          id: string;
          workspaceId: string;
          teamId: string;
          domainId: string;
          funnelInstanceId: string;
          trackingProfileId: string | null;
          handoffStrategyId: string | null;
          pathPrefix: string;
          status: string;
          isPrimary: boolean;
          createdAt: string;
          updatedAt: string;
        }>(`/funnel-publications/${row.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: nextStatus,
          }),
        });

        setRows((current) =>
          current.map((item) =>
            item.id === row.id
              ? {
                  ...item,
                  status: record.status,
                }
              : item,
          ),
        );
        setSuccessMessage(
          nextStatus === "active"
            ? "Publicación activada."
            : "Publicación regresada a draft.",
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos cambiar el estado de la publicación.",
        );
      }
    });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Publicaciones"
        title="Rutas visibles del team"
        description="Aquí el team puede crear bindings reales por host + path, resolver conflictos de publicación y activar o pausar rutas operativas."
        actions={
          <button
            type="button"
            onClick={() => {
              resetMessages();
              setIsCreateOpen(true);
            }}
            className={primaryButtonClassName}
          >
            Crear publicación
          </button>
        }
      />

      {errorMessage ? <OperationBanner tone="error" message={errorMessage} /> : null}
      {successMessage ? (
        <OperationBanner tone="success" message={successMessage} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Publicaciones"
          value={formatCompactNumber(rows.length)}
          hint="Bindings activos o draft bajo ownership del team."
        />
        <KpiCard
          label="Activas"
          value={formatCompactNumber(rows.filter((item) => item.status === "active").length)}
          hint="Rutas ya operativas en el runtime público."
        />
        <KpiCard
          label="Root routes"
          value={formatCompactNumber(rows.filter((item) => item.pathPrefix === "/").length)}
          hint="Landings principales del dominio."
        />
        <KpiCard
          label="Subrutas"
          value={formatCompactNumber(rows.filter((item) => item.pathPrefix !== "/").length)}
          hint="Entradas específicas como oportunidades u ofertas."
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        {rows.map((publication) => (
          <PublicationCard
            key={publication.id}
            publication={publication}
            actions={
              <>
                <button
                  type="button"
                  onClick={() => openEdit(publication)}
                  className={buttonClassName}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusToggle(publication)}
                  disabled={isPending}
                  className={buttonClassName}
                >
                  {publication.status === "active" ? "Pausar" : "Activar"}
                </button>
              </>
            }
          />
        ))}
      </div>

      <DataTable
        columns={[
          {
            key: "path",
            header: "Path",
            render: (row) => (
              <div>
                <p className="font-semibold text-slate-950">{row.pathPrefix}</p>
                <p className="text-xs text-slate-500">{row.domainHost}</p>
              </div>
            ),
          },
          {
            key: "funnel",
            header: "Funnel",
            render: (row) => row.funnelName,
          },
          {
            key: "tracking",
            header: "Tracking",
            render: (row) => row.trackingLabel,
          },
          {
            key: "status",
            header: "Estado",
            render: (row) => <StatusBadge value={row.status} />,
          },
          {
            key: "actions",
            header: "Acciones",
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(row)}
                  className={buttonClassName}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusToggle(row)}
                  disabled={isPending}
                  className={buttonClassName}
                >
                  {row.status === "active" ? "Pausar" : "Activar"}
                </button>
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyTitle="Sin publicaciones para este team"
        emptyDescription="Cuando el team publique funnels sobre dominios propios, esta tabla se llenará automáticamente."
      />

      {isCreateOpen ? (
        <ModalShell
          title="Crear publicación"
          description="La publicación conecta un funnel activo con un host y un path del team."
          onClose={() => setIsCreateOpen(false)}
        >
          <PublicationForm
            state={createState}
            onChange={setCreateState}
            domains={domains}
            funnels={funnels}
            trackingProfiles={trackingProfiles}
            handoffStrategies={handoffStrategies}
          />
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending}
              className={primaryButtonClassName}
            >
              {isPending ? "Creando..." : "Crear publicación"}
            </button>
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className={buttonClassName}
            >
              Cancelar
            </button>
          </div>
        </ModalShell>
      ) : null}

      {editingRow && editState ? (
        <ModalShell
          title="Editar publicación"
          description="Puedes ajustar host, path y dependencias operativas sin tocar el template ni la estructura del funnel."
          onClose={() => {
            setEditingRow(null);
            setEditState(null);
          }}
        >
          <PublicationForm
            state={editState}
            onChange={(updater) =>
              setEditState((current) =>
                current
                  ? typeof updater === "function"
                    ? updater(current)
                    : updater
                  : current,
              )
            }
            domains={domains}
            funnels={funnels}
            trackingProfiles={trackingProfiles}
            handoffStrategies={handoffStrategies}
          />
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleEdit}
              disabled={isPending}
              className={primaryButtonClassName}
            >
              {isPending ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingRow(null);
                setEditState(null);
              }}
              className={buttonClassName}
            >
              Cancelar
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}

type PublicationFormProps = {
  state: PublicationFormState;
  onChange: (
    updater:
      | PublicationFormState
      | ((current: PublicationFormState) => PublicationFormState),
  ) => void;
  domains: DomainRecord[];
  funnels: FunnelView[];
  trackingProfiles: TrackingProfileRecord[];
  handoffStrategies: HandoffStrategyRecord[];
};

function PublicationForm({
  state,
  onChange,
  domains,
  funnels,
  trackingProfiles,
  handoffStrategies,
}: PublicationFormProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Dominio</span>
        <select
          value={state.domainId}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              domainId: event.target.value,
            }))
          }
          className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-950"
        >
          {domains.map((domain) => (
            <option key={domain.id} value={domain.id}>
              {domain.host}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Funnel</span>
        <select
          value={state.funnelInstanceId}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              funnelInstanceId: event.target.value,
            }))
          }
          className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-950"
        >
          {funnels.map((funnel) => (
            <option key={funnel.id} value={funnel.id}>
              {funnel.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Path</span>
        <input
          value={state.pathPrefix}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              pathPrefix: event.target.value,
            }))
          }
          className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-950"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Tracking</span>
        <select
          value={state.trackingProfileId}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              trackingProfileId: event.target.value,
            }))
          }
          className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-950"
        >
          <option value="">Sin tracking</option>
          {trackingProfiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Handoff</span>
        <select
          value={state.handoffStrategyId}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              handoffStrategyId: event.target.value,
            }))
          }
          className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-950"
        >
          <option value="">Sin handoff</option>
          {handoffStrategies.map((strategy) => (
            <option key={strategy.id} value={strategy.id}>
              {strategy.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <input
          checked={state.isPrimary}
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              isPrimary: event.target.checked,
            }))
          }
          type="checkbox"
        />
        Marcar como publicación primaria del dominio
      </label>
    </div>
  );
}
