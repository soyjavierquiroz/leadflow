"use client";

import { useRef, useState, useTransition } from "react";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { ModalShell } from "@/components/team-operations/modal-shell";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import type {
  FunnelView,
  HandoffStrategyRecord,
  RotationPoolRecord,
  TrackingProfileRecord,
  FunnelTemplateRecord,
} from "@/lib/app-shell/types";
import { formatCompactNumber } from "@/lib/app-shell/utils";
import { teamOperationRequest } from "@/lib/team-operations";
import { uploadFileWithPresignedUrl } from "@/lib/storage";

type FunnelInstanceApiRecord = {
  id: string;
  workspaceId: string;
  teamId: string;
  templateId: string;
  legacyFunnelId: string | null;
  name: string;
  code: string;
  thumbnailUrl: string | null;
  status: string;
  rotationPoolId: string | null;
  trackingProfileId: string | null;
  handoffStrategyId: string | null;
  settingsJson: unknown;
  mediaMap: unknown;
  stepIds: string[];
  publicationIds: string[];
  createdAt: string;
  updatedAt: string;
};

type TeamFunnelsClientProps = {
  initialRows: FunnelView[];
  teamName: string;
  templates: FunnelTemplateRecord[];
  rotationPools: RotationPoolRecord[];
  trackingProfiles: TrackingProfileRecord[];
  handoffStrategies: HandoffStrategyRecord[];
};

type FunnelFormState = {
  name: string;
  code: string;
  thumbnailUrl: string | null;
  templateId: string;
  rotationPoolId: string;
  trackingProfileId: string;
  handoffStrategyId: string;
};

const buttonClassName =
  "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const primaryButtonClassName =
  "rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";

const buildCreateState = (
  templates: FunnelTemplateRecord[],
  rotationPools: RotationPoolRecord[],
  trackingProfiles: TrackingProfileRecord[],
  handoffStrategies: HandoffStrategyRecord[],
): FunnelFormState => ({
  name: "",
  code: "",
  thumbnailUrl: null,
  templateId: templates[0]?.id ?? "",
  rotationPoolId: rotationPools[0]?.id ?? "",
  trackingProfileId: trackingProfiles[0]?.id ?? "",
  handoffStrategyId: handoffStrategies[0]?.id ?? "",
});

const buildView = (
  record: {
    id: string;
    workspaceId: string;
    teamId: string;
    templateId: string;
    legacyFunnelId: string | null;
    name: string;
    code: string;
    thumbnailUrl: string | null;
    status: string;
    rotationPoolId: string | null;
    trackingProfileId: string | null;
    handoffStrategyId: string | null;
    settingsJson: unknown;
    mediaMap: unknown;
    stepIds: string[];
    publicationIds: string[];
    createdAt: string;
    updatedAt: string;
  },
  input: {
    teamName: string;
    templates: FunnelTemplateRecord[];
  },
): FunnelView => {
  const template = input.templates.find((item) => item.id === record.templateId);

  return {
    ...record,
    publicationCount: record.publicationIds.length,
    templateName: template?.name ?? "Template pendiente",
    teamName: input.teamName,
    rotationLabel: record.rotationPoolId ? "Pool asignado" : "Pool pendiente",
    trackingReady: Boolean(record.trackingProfileId),
  };
};

export function TeamFunnelsClient({
  initialRows,
  teamName,
  templates,
  rotationPools,
  trackingProfiles,
  handoffStrategies,
}: TeamFunnelsClientProps) {
  const [rows, setRows] = useState(initialRows);
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<FunnelView | null>(null);
  const [createState, setCreateState] = useState(() =>
    buildCreateState(templates, rotationPools, trackingProfiles, handoffStrategies),
  );
  const [editState, setEditState] = useState<FunnelFormState | null>(null);
  const [uploadingThumbnailId, setUploadingThumbnailId] = useState<
    string | null
  >(null);
  const thumbnailInputRef = useRef<HTMLInputElement | null>(null);

  const resetMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const openEdit = (row: FunnelView) => {
    resetMessages();
    setEditingRow(row);
    setEditState({
      name: row.name,
      code: row.code,
      thumbnailUrl: row.thumbnailUrl,
      templateId: row.templateId,
      rotationPoolId: row.rotationPoolId ?? "",
      trackingProfileId: row.trackingProfileId ?? "",
      handoffStrategyId: row.handoffStrategyId ?? "",
    });
  };

  const handleCreate = () => {
    resetMessages();

    startTransition(async () => {
      try {
        const record = await teamOperationRequest<FunnelInstanceApiRecord>(
          "/funnel-instances",
          {
          method: "POST",
          body: JSON.stringify({
            name: createState.name,
            code: createState.code,
            templateId: createState.templateId,
            rotationPoolId: createState.rotationPoolId || null,
            trackingProfileId: createState.trackingProfileId || null,
            handoffStrategyId: createState.handoffStrategyId || null,
          }),
          },
        );

        setRows((current) => [
          ...current,
          buildView(record, {
            teamName,
            templates,
          }),
        ]);
        setSuccessMessage("Funnel creado en draft y listo para operación.");
        setIsCreateOpen(false);
        setCreateState(
          buildCreateState(
            templates,
            rotationPools,
            trackingProfiles,
            handoffStrategies,
          ),
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "No pudimos crear el funnel.",
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
        const record = await teamOperationRequest<FunnelInstanceApiRecord>(
          `/funnel-instances/${editingRow.id}`,
          {
          method: "PATCH",
          body: JSON.stringify({
            name: editState.name,
            code: editState.code,
            thumbnailUrl: editState.thumbnailUrl,
            rotationPoolId: editState.rotationPoolId || null,
            trackingProfileId: editState.trackingProfileId || null,
            handoffStrategyId: editState.handoffStrategyId || null,
          }),
          },
        );

        setRows((current) =>
          current.map((row) =>
            row.id === editingRow.id
              ? {
                  ...row,
                  ...buildView(record, {
                    teamName,
                    templates,
                  }),
                  publicationCount: row.publicationCount,
                }
              : row,
          ),
        );
        setSuccessMessage("Funnel actualizado correctamente.");
        setEditingRow(null);
        setEditState(null);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos actualizar el funnel.",
        );
      }
    });
  };

  const handleStatusToggle = (row: FunnelView) => {
    resetMessages();

    startTransition(async () => {
      try {
        const nextStatus = row.status === "active" ? "draft" : "active";
        const record = await teamOperationRequest<FunnelInstanceApiRecord>(
          `/funnel-instances/${row.id}`,
          {
          method: "PATCH",
          body: JSON.stringify({
            status: nextStatus,
          }),
          },
        );

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
            ? "Funnel activado."
            : "Funnel regresado a draft operativo.",
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos cambiar el estado del funnel.",
        );
      }
    });
  };

  const handleThumbnailUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file || !editingRow) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Selecciona una imagen valida para la portada del funnel.");
      event.target.value = "";
      return;
    }

    const previousThumbnailUrl = editingRow.thumbnailUrl;
    const previewUrl = URL.createObjectURL(file);

    resetMessages();
    setUploadingThumbnailId(editingRow.id);
    setRows((current) =>
      current.map((row) =>
        row.id === editingRow.id
          ? {
              ...row,
              thumbnailUrl: previewUrl,
            }
          : row,
      ),
    );
    setEditingRow((current) =>
      current
        ? {
            ...current,
            thumbnailUrl: previewUrl,
          }
        : current,
    );
    setEditState((current) =>
      current
        ? {
            ...current,
            thumbnailUrl: previewUrl,
          }
        : current,
    );

    try {
      const publicUrl = await uploadFileWithPresignedUrl(file, "funnels");
      const record = await teamOperationRequest<FunnelInstanceApiRecord>(
        `/funnel-instances/${editingRow.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            thumbnailUrl: publicUrl,
          }),
        },
      );

      const nextView = buildView(record, {
        teamName,
        templates,
      });

      setRows((current) =>
        current.map((row) =>
          row.id === editingRow.id
            ? {
                ...row,
                ...nextView,
                publicationCount: row.publicationCount,
              }
            : row,
        ),
      );
      setEditingRow((current) =>
        current?.id === editingRow.id
          ? {
              ...current,
              ...nextView,
            }
          : current,
      );
      setEditState((current) =>
        current
          ? {
              ...current,
              thumbnailUrl: record.thumbnailUrl,
            }
          : current,
      );
      setSuccessMessage("Portada del funnel actualizada correctamente.");
    } catch (error) {
      setRows((current) =>
        current.map((row) =>
          row.id === editingRow.id
            ? {
                ...row,
                thumbnailUrl: previousThumbnailUrl,
              }
            : row,
        ),
      );
      setEditingRow((current) =>
        current?.id === editingRow.id
          ? {
              ...current,
              thumbnailUrl: previousThumbnailUrl,
            }
          : current,
      );
      setEditState((current) =>
        current
          ? {
              ...current,
              thumbnailUrl: previousThumbnailUrl,
            }
          : current,
      );
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No pudimos actualizar la portada del funnel.",
      );
    } finally {
      URL.revokeObjectURL(previewUrl);
      event.target.value = "";
      setUploadingThumbnailId(null);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team Admin / Funnels"
        title="Instancias operativas del team"
        description="El team puede crear instancias desde templates aprobados, ajustar metadatos operativos y activar o pausar funnels sin tocar la estructura JSON."
        actions={
          <button
            type="button"
            onClick={() => {
              resetMessages();
              setIsCreateOpen(true);
            }}
            className={primaryButtonClassName}
          >
            Crear funnel
          </button>
        }
      />

      {errorMessage ? <OperationBanner tone="error" message={errorMessage} /> : null}
      {successMessage ? (
        <OperationBanner tone="success" message={successMessage} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Funnels"
          value={formatCompactNumber(rows.length)}
          hint="Instancias activas o draft listas para publicación."
        />
        <KpiCard
          label="Tracking listo"
          value={formatCompactNumber(rows.filter((item) => item.trackingReady).length)}
          hint="Funnels con perfil de tracking ya resuelto."
        />
        <KpiCard
          label="Con publicaciones"
          value={formatCompactNumber(
            rows.filter((item) => item.publicationCount > 0).length,
          )}
          hint="Instancias que ya están conectadas a un host + path."
        />
        <KpiCard
          label="Activos"
          value={formatCompactNumber(rows.filter((item) => item.status === "active").length)}
          hint="Funnels listos para operar con publicaciones activas."
        />
      </section>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Funnel",
            render: (row) => (
              <div className="flex items-center gap-3">
                {row.thumbnailUrl ? (
                  <img
                    src={row.thumbnailUrl}
                    alt={`Portada de ${row.name}`}
                    className="h-14 w-20 rounded-2xl border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-20 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Sin imagen
                  </div>
                )}
                <div>
                  <p className="font-semibold text-slate-950">{row.name}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    {row.code}
                  </p>
                </div>
              </div>
            ),
          },
          {
            key: "template",
            header: "Template",
            render: (row) => row.templateName,
          },
          {
            key: "publications",
            header: "Publicaciones",
            render: (row) => `${row.publicationCount} activas/draft`,
          },
          {
            key: "ops",
            header: "Operación",
            render: (row) => (
              <div className="space-y-1">
                <p>{row.rotationLabel}</p>
                <p className="text-xs text-slate-500">
                  {row.trackingReady ? "Tracking listo" : "Tracking pendiente"}
                </p>
              </div>
            ),
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
        emptyTitle="Sin funnels operativos"
        emptyDescription="Cuando el team cree instancias desde templates aprobados, aparecerán aquí con su estado operativo."
      />

      {isCreateOpen ? (
        <ModalShell
          title="Crear funnel desde template"
          description="Esta operación crea una instancia draft para el team usando un template ya aprobado por plataforma."
          onClose={() => setIsCreateOpen(false)}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Nombre</span>
              <input
                value={createState.name}
                onChange={(event) =>
                  setCreateState((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-950"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Code</span>
              <input
                value={createState.code}
                onChange={(event) =>
                  setCreateState((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-950"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Template</span>
              <select
                value={createState.templateId}
                onChange={(event) =>
                  setCreateState((current) => ({
                    ...current,
                    templateId: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-950"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Pool</span>
              <select
                value={createState.rotationPoolId}
                onChange={(event) =>
                  setCreateState((current) => ({
                    ...current,
                    rotationPoolId: event.target.value,
                  }))
                }
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-950"
              >
                <option value="">Sin pool</option>
                {rotationPools.map((pool) => (
                  <option key={pool.id} value={pool.id}>
                    {pool.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Tracking</span>
              <select
                value={createState.trackingProfileId}
                onChange={(event) =>
                  setCreateState((current) => ({
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
                value={createState.handoffStrategyId}
                onChange={(event) =>
                  setCreateState((current) => ({
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
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending}
              className={primaryButtonClassName}
            >
              {isPending ? "Creando..." : "Crear funnel"}
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
          title="Editar funnel operativo"
          description="Puedes ajustar nombre, código y dependencias operativas del funnel sin alterar la estructura del template."
          onClose={() => {
            setEditingRow(null);
            setEditState(null);
          }}
        >
          <section className="mb-6 rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                {editState.thumbnailUrl ? (
                  <img
                    src={editState.thumbnailUrl}
                    alt={`Portada de ${editState.name || editingRow.name}`}
                    className="h-20 w-28 rounded-[1.5rem] border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-28 items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Portada pendiente
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Imagen del funnel
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-950">
                    Thumbnail promocional
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                    Esta imagen se usa como portada operativa del funnel y se
                    sube directo a MinIO sin pasar por la API.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={handleThumbnailUpload}
                />
                <button
                  type="button"
                  onClick={() => thumbnailInputRef.current?.click()}
                  disabled={uploadingThumbnailId === editingRow.id}
                  className={primaryButtonClassName}
                >
                  {uploadingThumbnailId === editingRow.id
                    ? "Subiendo imagen..."
                    : "Cambiar portada"}
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Nombre</span>
              <input
                value={editState.name}
                onChange={(event) =>
                  setEditState((current) =>
                    current
                      ? {
                          ...current,
                          name: event.target.value,
                        }
                      : current,
                  )
                }
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-950"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Code</span>
              <input
                value={editState.code}
                onChange={(event) =>
                  setEditState((current) =>
                    current
                      ? {
                          ...current,
                          code: event.target.value,
                        }
                      : current,
                  )
                }
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-950"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Pool</span>
              <select
                value={editState.rotationPoolId}
                onChange={(event) =>
                  setEditState((current) =>
                    current
                      ? {
                          ...current,
                          rotationPoolId: event.target.value,
                        }
                      : current,
                  )
                }
                className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-950"
              >
                <option value="">Sin pool</option>
                {rotationPools.map((pool) => (
                  <option key={pool.id} value={pool.id}>
                    {pool.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Tracking</span>
              <select
                value={editState.trackingProfileId}
                onChange={(event) =>
                  setEditState((current) =>
                    current
                      ? {
                          ...current,
                          trackingProfileId: event.target.value,
                        }
                      : current,
                  )
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
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Handoff</span>
              <select
                value={editState.handoffStrategyId}
                onChange={(event) =>
                  setEditState((current) =>
                    current
                      ? {
                          ...current,
                          handoffStrategyId: event.target.value,
                        }
                      : current,
                  )
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
          </div>
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
