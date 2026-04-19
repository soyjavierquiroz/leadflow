"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import {
  PublicationTrackingFields,
  type PublicationTrackingFieldName,
} from "@/components/forms/publication-tracking-fields";
import { ModalShell } from "@/components/team-operations/modal-shell";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { formatCompactNumber, formatDateTime } from "@/lib/app-shell/utils";
import {
  getFirstZodError,
  systemPublicationFormSchema,
} from "@/lib/funnel-publication-form";
import type {
  SystemPublicationDomainOption,
  SystemPublicationFunnelOption,
  SystemPublicationRecord,
  SystemPublicationTeamOption,
} from "@/lib/system-publications.types";
import { authenticatedOperationRequest } from "@/lib/team-operations";

type SystemPublicationsClientProps = {
  initialRows: SystemPublicationRecord[];
  teams: SystemPublicationTeamOption[];
};

type EditorState =
  | {
      mode: "create";
    }
  | {
      mode: "edit";
      publicationId: string;
    }
  | null;

type TeamAssetCache = Record<
  string,
  {
    domains: SystemPublicationDomainOption[];
    funnels: SystemPublicationFunnelOption[];
  }
>;

export type PublicationFormState = {
  teamId: string;
  domainId: string;
  funnelId: string;
  path: string;
  isActive: boolean;
  metaPixelId: string;
  tiktokPixelId: string;
  metaCapiToken: string;
  tiktokAccessToken: string;
};

const primaryButtonClassName =
  "rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
const dangerButtonClassName =
  "rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60";

const sortRows = (rows: SystemPublicationRecord[]) =>
  [...rows].sort((left, right) => {
    if (left.isRoutable !== right.isRoutable) {
      return left.isRoutable ? -1 : 1;
    }

    const hostDelta = left.domain.host.localeCompare(right.domain.host);

    if (hostDelta !== 0) {
      return hostDelta;
    }

    const pathDelta = left.path.localeCompare(right.path);

    if (pathDelta !== 0) {
      return pathDelta;
    }

    return (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  });

const buildInitialFormState = (
  teams: SystemPublicationTeamOption[],
): PublicationFormState => ({
  teamId: teams[0]?.id ?? "",
  domainId: "",
  funnelId: "",
  path: "/",
  isActive: true,
  metaPixelId: "",
  tiktokPixelId: "",
  metaCapiToken: "",
  tiktokAccessToken: "",
});

export function SystemPublicationsClient({
  initialRows,
  teams,
}: SystemPublicationsClientProps) {
  const router = useRouter();
  const [rows, setRows] = useState(() => sortRows(initialRows));
  const [editorState, setEditorState] = useState<EditorState>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<SystemPublicationRecord | null>(null);
  const [formState, setFormState] = useState(() =>
    buildInitialFormState(teams),
  );
  const [assetCache, setAssetCache] = useState<TeamAssetCache>({});
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setRows(sortRows(initialRows));
  }, [initialRows]);

  const currentAssets = formState.teamId
    ? assetCache[formState.teamId]
    : undefined;

  const currentDomains = currentAssets?.domains ?? [];
  const currentFunnels = currentAssets?.funnels ?? [];
  const currentDomain =
    currentDomains.find((item) => item.id === formState.domainId) ?? null;
  const currentFunnel =
    currentFunnels.find((item) => item.id === formState.funnelId) ?? null;

  const activeCount = rows.filter((item) => item.isActive).length;
  const routableCount = rows.filter((item) => item.isRoutable).length;
  const teamCoverageCount = useMemo(
    () => new Set(rows.map((item) => item.team.id)).size,
    [rows],
  );
  const rootBindingsCount = rows.filter((item) => item.path === "/").length;

  const ensureTeamAssets = async (teamId: string) => {
    const normalizedTeamId = teamId.trim();

    if (!normalizedTeamId || assetCache[normalizedTeamId]) {
      return assetCache[normalizedTeamId] ?? null;
    }

    setIsLoadingAssets(true);

    try {
      const [domains, funnels] = await Promise.all([
        authenticatedOperationRequest<SystemPublicationDomainOption[]>(
          `/domains?teamId=${encodeURIComponent(normalizedTeamId)}`,
          {
            method: "GET",
          },
        ),
        authenticatedOperationRequest<SystemPublicationFunnelOption[]>(
          `/funnel-instances?teamId=${encodeURIComponent(normalizedTeamId)}`,
          {
            method: "GET",
          },
        ),
      ]);

      const nextEntry = {
        domains,
        funnels,
      };

      setAssetCache((current) => ({
        ...current,
        [normalizedTeamId]: nextEntry,
      }));

      return nextEntry;
    } finally {
      setIsLoadingAssets(false);
    }
  };

  useEffect(() => {
    if (!editorState || !formState.teamId) {
      return;
    }

    let isCancelled = false;

    const syncTeamAssets = async () => {
      try {
        const assets = await ensureTeamAssets(formState.teamId);

        if (!assets || isCancelled) {
          return;
        }

        setFormState((current) => {
          if (current.teamId !== formState.teamId) {
            return current;
          }

          const nextDomainId = assets.domains.some(
            (item) => item.id === current.domainId,
          )
            ? current.domainId
            : (assets.domains[0]?.id ?? "");
          const nextFunnelId = assets.funnels.some(
            (item) => item.id === current.funnelId,
          )
            ? current.funnelId
            : (assets.funnels[0]?.id ?? "");

          if (
            nextDomainId === current.domainId &&
            nextFunnelId === current.funnelId
          ) {
            return current;
          }

          return {
            ...current,
            domainId: nextDomainId,
            funnelId: nextFunnelId,
          };
        });
      } catch (error) {
        if (!isCancelled) {
          setFeedback({
            tone: "error",
            message:
              error instanceof Error
                ? error.message
                : "No pudimos cargar los dominios y funnels del tenant.",
          });
        }
      }
    };

    void syncTeamAssets();

    return () => {
      isCancelled = true;
    };
  }, [editorState, formState.teamId]);

  const closeEditor = () => {
    setEditorState(null);
    setFormState(buildInitialFormState(teams));
  };

  const updateTrackingField = (
    field: PublicationTrackingFieldName,
    value: PublicationFormState[PublicationTrackingFieldName],
  ) => {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const openCreateModal = () => {
    setFeedback(null);
    setEditorState({ mode: "create" });
    setFormState(buildInitialFormState(teams));
  };

  const openEditModal = (publication: SystemPublicationRecord) => {
    setFeedback(null);
    setEditorState({
      mode: "edit",
      publicationId: publication.id,
    });
    setFormState({
      teamId: publication.team.id,
      domainId: publication.domain.id,
      funnelId: publication.funnel.id,
      path: publication.path,
      isActive: publication.isActive,
      metaPixelId: publication.metaPixelId ?? "",
      tiktokPixelId: publication.tiktokPixelId ?? "",
      metaCapiToken: publication.metaCapiToken ?? "",
      tiktokAccessToken: publication.tiktokAccessToken ?? "",
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const parsedForm = systemPublicationFormSchema.safeParse({
      ...formState,
      path: formState.path.trim() || "/",
    });

    if (!parsedForm.success) {
      setFeedback({
        tone: "error",
        message: getFirstZodError(parsedForm.error),
      });
      return;
    }

    startTransition(async () => {
      try {
        const payload = parsedForm.data;
        const record =
          await authenticatedOperationRequest<SystemPublicationRecord>(
            editorState?.mode === "edit"
              ? `/system/publications/${encodeURIComponent(editorState.publicationId)}`
              : "/system/publications",
            {
              method: editorState?.mode === "edit" ? "PATCH" : "POST",
              body: JSON.stringify({
                domainId: payload.domainId,
                funnelId: payload.funnelId,
                path: payload.path,
                isActive: payload.isActive,
                metaPixelId: payload.metaPixelId ?? null,
                tiktokPixelId: payload.tiktokPixelId ?? null,
                metaCapiToken: payload.metaCapiToken ?? null,
                tiktokAccessToken: payload.tiktokAccessToken ?? null,
              }),
            },
          );

        setRows((current) => {
          if (editorState?.mode === "edit") {
            return sortRows(
              current.map((item) => (item.id === record.id ? record : item)),
            );
          }

          return sortRows([record, ...current]);
        });
        closeEditor();
        setFeedback({
          tone: "success",
          message:
            editorState?.mode === "edit"
              ? "El binding global quedó actualizado."
              : "El binding global fue creado correctamente.",
        });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos guardar el binding global.",
        });
      }
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) {
      return;
    }

    setFeedback(null);

    startTransition(async () => {
      try {
        await authenticatedOperationRequest<{ id: string; deleted: true }>(
          `/system/publications/${encodeURIComponent(deleteTarget.id)}`,
          {
            method: "DELETE",
          },
        );

        setRows((current) =>
          current.filter((item) => item.id !== deleteTarget.id),
        );
        setDeleteTarget(null);
        setFeedback({
          tone: "success",
          message: "El binding seleccionado fue eliminado del router global.",
        });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos eliminar el binding global.",
        });
      }
    });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Super Admin / Publicaciones"
        title="CRUD global de bindings por dominio y path"
        description="Controla qué funnel atiende cada host y ruta pública. El binding vive a nivel global, pero respeta el tenant dueño del dominio y del funnel seleccionado."
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className={primaryButtonClassName}
          >
            Nuevo Binding
          </button>
        }
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Bindings"
          value={formatCompactNumber(rows.length)}
          hint="Reglas globales host + path activas o en espera."
        />
        <KpiCard
          label="Activos"
          value={formatCompactNumber(activeCount)}
          hint="Bindings encendidos por el super admin."
        />
        <KpiCard
          label="Ruteables"
          value={formatCompactNumber(routableCount)}
          hint="Bindings que pueden resolver tráfico ahora mismo."
        />
        <KpiCard
          label="Tenants Cubiertos"
          value={formatCompactNumber(teamCoverageCount)}
          hint="Agencias con al menos un binding en el router global."
        />
        <KpiCard
          label="Roots"
          value={formatCompactNumber(rootBindingsCount)}
          hint="Publicaciones colocadas sobre la raíz del dominio."
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        {rows.slice(0, 6).map((row) => (
          <article
            key={row.id}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">
                  {row.team.name}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-950">
                  {row.domain.host}
                  <span className="text-slate-400">{row.path}</span>
                </h3>
              </div>
              <StatusBadge value={row.isRoutable ? "active" : "draft"} />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-800">
              {row.funnel.name}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {row.funnel.template.name} · {row.funnel.code}
            </p>
            <div className="mt-5 flex items-center justify-between gap-3 text-xs text-slate-500">
              <span>{formatDateTime(row.updatedAt)}</span>
              <button
                type="button"
                onClick={() => openEditModal(row)}
                className="font-semibold text-slate-800 underline-offset-4 hover:underline"
              >
                Editar
              </button>
            </div>
          </article>
        ))}
      </div>

      <DataTable
        columns={[
          {
            key: "host",
            header: "Host / Path",
            render: (row) => (
              <div>
                <p className="font-semibold text-slate-950">
                  {row.domain.host}
                  <span className="text-slate-400">{row.path}</span>
                </p>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  {row.workspace.name}
                </p>
              </div>
            ),
          },
          {
            key: "funnel",
            header: "Funnel",
            render: (row) => (
              <div>
                <p>{row.funnel.name}</p>
                <p className="text-xs text-slate-500">
                  {row.funnel.template.name} · {row.funnel.code}
                </p>
              </div>
            ),
          },
          {
            key: "team",
            header: "Team",
            render: (row) => (
              <div>
                <p>{row.team.name}</p>
                <p className="text-xs text-slate-500">{row.team.code}</p>
              </div>
            ),
          },
          {
            key: "status",
            header: "Estado",
            render: (row) => (
              <div className="space-y-2">
                <StatusBadge value={row.isActive ? "active" : "paused"} />
                <p className="text-xs text-slate-500">
                  {row.isRoutable
                    ? "Resolviendo tráfico"
                    : "Sin salida pública"}
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
                  onClick={() => openEditModal(row)}
                  className={secondaryButtonClassName}
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(row)}
                  className={dangerButtonClassName}
                >
                  Eliminar
                </button>
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyTitle="Sin bindings globales"
        emptyDescription="Cuando el super admin cree reglas de host y path, aparecerán aquí con su funnel y tenant asociado."
      />

      {editorState ? (
        <ModalShell
          eyebrow="Super Admin / Publicaciones"
          title={
            editorState.mode === "edit"
              ? "Editar Binding Global"
              : "Crear Binding Global"
          }
          description="Selecciona el tenant dueño del binding, luego su dominio y funnel. La ruta decide qué publicación responde dentro del host."
          onClose={closeEditor}
        >
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Team</span>
                <select
                  value={formState.teamId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      teamId: event.target.value,
                      domainId: "",
                      funnelId: "",
                    }))
                  }
                  disabled={editorState.mode === "edit" || isPending}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                >
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} · {team.workspaceName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Dominio</span>
                <select
                  value={formState.domainId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      domainId: event.target.value,
                    }))
                  }
                  disabled={
                    isLoadingAssets || isPending || currentDomains.length === 0
                  }
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                >
                  {currentDomains.length === 0 ? (
                    <option value="">
                      {isLoadingAssets
                        ? "Cargando dominios..."
                        : "Sin dominios disponibles"}
                    </option>
                  ) : null}
                  {currentDomains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.host} · {domain.status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Funnel</span>
                <select
                  value={formState.funnelId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      funnelId: event.target.value,
                    }))
                  }
                  disabled={
                    isLoadingAssets || isPending || currentFunnels.length === 0
                  }
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                >
                  {currentFunnels.length === 0 ? (
                    <option value="">
                      {isLoadingAssets
                        ? "Cargando funnels..."
                        : "Sin funnels disponibles"}
                    </option>
                  ) : null}
                  {currentFunnels.map((funnel) => (
                    <option key={funnel.id} value={funnel.id}>
                      {funnel.name} · {funnel.code} · {funnel.status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm text-slate-700">
                <span className="font-semibold text-slate-900">Path</span>
                <input
                  value={formState.path}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      path: event.target.value,
                    }))
                  }
                  placeholder="/ o /promo"
                  disabled={isPending}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                />
              </label>
            </div>

            <PublicationTrackingFields
              value={{
                metaPixelId: formState.metaPixelId,
                tiktokPixelId: formState.tiktokPixelId,
                metaCapiToken: formState.metaCapiToken,
                tiktokAccessToken: formState.tiktokAccessToken,
              }}
              onChange={updateTrackingField}
              description="Configura los identificadores y tokens que viajarán con esta publicación al runtime y al API."
              disabled={isPending}
              variant="system"
            />

            <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Preview Operativo
              </p>
              <p className="mt-2 text-base font-semibold text-slate-950">
                {currentDomain?.host ?? "Dominio pendiente"}
                <span className="text-slate-400">
                  {formState.path.trim() || "/"}
                </span>
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {currentFunnel
                  ? `${currentFunnel.name} · ${currentFunnel.code}`
                  : "Selecciona un funnel del tenant para completar el binding."}
              </p>
            </div>

            <label className="flex items-start gap-3 rounded-[1.5rem] border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={formState.isActive}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
                disabled={isPending}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
              />
              <span>
                <strong className="block text-slate-900">Binding activo</strong>
                Si queda apagado, el registro persiste pero no resolverá tráfico
                público hasta reactivarlo.
              </span>
            </label>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                disabled={isPending}
                className={secondaryButtonClassName}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending || isLoadingAssets}
                className={primaryButtonClassName}
              >
                {isPending
                  ? "Guardando..."
                  : editorState.mode === "edit"
                    ? "Guardar Cambios"
                    : "Crear Binding"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {deleteTarget ? (
        <ModalShell
          eyebrow="Super Admin / Publicaciones"
          title="Eliminar Binding"
          description="Esta acción borra la regla global de host y path. Si el binding tenía tráfico asignado, dejará de resolver inmediatamente."
          onClose={() => setDeleteTarget(null)}
        >
          <div className="space-y-6">
            <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
              <p className="font-semibold">
                {deleteTarget.domain.host}
                <span className="text-rose-500">{deleteTarget.path}</span>
              </p>
              <p className="mt-1">
                {deleteTarget.funnel.name} · {deleteTarget.team.name}
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isPending}
                className={secondaryButtonClassName}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className={dangerButtonClassName}
              >
                {isPending ? "Eliminando..." : "Eliminar Binding"}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
