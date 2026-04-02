"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { ModalShell } from "@/components/team-operations/modal-shell";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { formatCompactNumber, formatDateTime } from "@/lib/app-shell/utils";
import type { SystemFunnelTemplateRecord } from "@/lib/system-tenants";
import { authenticatedOperationRequest } from "@/lib/team-operations";

type SystemTemplatesClientProps = {
  initialRows: SystemFunnelTemplateRecord[];
};

type TemplateEditorState =
  | {
      mode: "create";
    }
  | {
      mode: "edit";
      templateId: string;
    }
  | null;

type TemplateFormState = {
  name: string;
  description: string;
  status: SystemFunnelTemplateRecord["status"];
};

const primaryButtonClassName =
  "rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
const dangerButtonClassName =
  "rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60";

const buildInitialFormState = (): TemplateFormState => ({
  name: "",
  description: "",
  status: "draft",
});

const sortRows = (rows: SystemFunnelTemplateRecord[]) => {
  const statusOrder = {
    active: 0,
    draft: 1,
    archived: 2,
  } satisfies Record<SystemFunnelTemplateRecord["status"], number>;

  return [...rows].sort((left, right) => {
    const statusDelta = statusOrder[left.status] - statusOrder[right.status];

    if (statusDelta !== 0) {
      return statusDelta;
    }

    return (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  });
};

export function SystemTemplatesClient({
  initialRows,
}: SystemTemplatesClientProps) {
  const router = useRouter();
  const [rows, setRows] = useState(() => sortRows(initialRows));
  const [editorState, setEditorState] = useState<TemplateEditorState>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<SystemFunnelTemplateRecord | null>(null);
  const [formState, setFormState] = useState(buildInitialFormState);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setRows(sortRows(initialRows));
  }, [initialRows]);

  const activeCount = rows.filter((item) => item.status === "active").length;
  const draftCount = rows.filter((item) => item.status === "draft").length;
  const archivedCount = rows.filter(
    (item) => item.status === "archived",
  ).length;

  const editingTemplate =
    editorState?.mode === "edit"
      ? (rows.find((row) => row.id === editorState.templateId) ?? null)
      : null;

  const resetForm = () => {
    setFormState(buildInitialFormState());
  };

  const closeEditor = () => {
    setEditorState(null);
    resetForm();
  };

  const openCreateModal = () => {
    setFeedback(null);
    resetForm();
    setEditorState({ mode: "create" });
  };

  const openEditModal = (template: SystemFunnelTemplateRecord) => {
    setFeedback(null);
    setFormState({
      name: template.name,
      description: template.description ?? "",
      status: template.status,
    });
    setEditorState({
      mode: "edit",
      templateId: template.id,
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const name = formState.name.trim();
    const description = formState.description.trim();

    if (!name) {
      setFeedback({
        tone: "error",
        message: "Asigna un nombre claro para el template.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          name,
          description: description || null,
          status: formState.status,
        };
        const record =
          await authenticatedOperationRequest<SystemFunnelTemplateRecord>(
            editorState?.mode === "edit"
              ? `/system/funnels/templates/${encodeURIComponent(editorState.templateId)}`
              : "/system/funnels/templates",
            {
              method: editorState?.mode === "edit" ? "PATCH" : "POST",
              body: JSON.stringify(payload),
            },
          );

        setRows((current) => {
          if (editorState?.mode === "edit") {
            return sortRows(
              current.map((row) => (row.id === record.id ? record : row)),
            );
          }

          return sortRows([record, ...current]);
        });
        closeEditor();
        setFeedback({
          tone: "success",
          message:
            editorState?.mode === "edit"
              ? "El template global quedó actualizado."
              : "El template global quedó creado y listo para clonación.",
        });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos guardar el template global.",
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
          `/system/funnels/templates/${encodeURIComponent(deleteTarget.id)}`,
          {
            method: "DELETE",
          },
        );

        setRows((current) =>
          current.filter((row) => row.id !== deleteTarget.id),
        );
        setDeleteTarget(null);
        setFeedback({
          tone: "success",
          message: "El template global fue eliminado del catálogo base.",
        });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos eliminar el template global.",
        });
      }
    });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Super Admin / Templates"
        title="CRUD de templates globales"
        description="Administra los funnels legacy que funcionan como plantillas base del sistema y quedan disponibles para clonación hacia los tenants."
        actions={
          <button
            type="button"
            onClick={openCreateModal}
            className={primaryButtonClassName}
          >
            Nuevo Template
          </button>
        }
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Templates Totales"
          value={formatCompactNumber(rows.length)}
          hint="Catálogo legacy disponible para clonación global."
        />
        <KpiCard
          label="Activos"
          value={formatCompactNumber(activeCount)}
          hint="Templates listos para uso inmediato en provisioning u operación."
        />
        <KpiCard
          label="Drafts"
          value={formatCompactNumber(draftCount)}
          hint="Base editable antes de quedar aprobada para equipos."
        />
        <KpiCard
          label="Archivados"
          value={formatCompactNumber(archivedCount)}
          hint="Historial retirado sin perder trazabilidad administrativa."
        />
      </section>

      <DataTable
        columns={[
          {
            key: "name",
            header: "Template",
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
            key: "description",
            header: "Descripción",
            render: (row) => (
              <p className="max-w-md text-sm leading-6 text-slate-600">
                {row.description?.trim() || "Sin descripción operativa."}
              </p>
            ),
          },
          {
            key: "configuration",
            header: "Configuración",
            render: (row) => (
              <div className="space-y-1">
                <p>{row.stages.length} etapas</p>
                <p className="text-xs text-slate-500">
                  {row.entrySources.join(", ")}
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
            key: "updatedAt",
            header: "Actualizado",
            render: (row) => formatDateTime(row.updatedAt),
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
                  onClick={() => {
                    setFeedback(null);
                    setDeleteTarget(row);
                  }}
                  className={dangerButtonClassName}
                >
                  Eliminar
                </button>
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyTitle="Sin templates globales"
        emptyDescription="Crea el primer template base para que el catálogo del sistema quede operativo y clonable."
      />

      {editorState ? (
        <ModalShell
          eyebrow="Super Admin / Templates"
          title={
            editorState.mode === "edit"
              ? "Editar template global"
              : "Crear template global"
          }
          description={
            editorState.mode === "edit"
              ? "Ajusta el naming y la descripción del template base sin salir del panel."
              : "Registra una nueva plantilla global que luego podrá clonarse en tenants."
          }
          onClose={closeEditor}
        >
          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-900">
                Nombre
              </span>
              <input
                type="text"
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Ej. Funnel Base Captación Premium"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                disabled={isPending}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-900">
                Descripción
              </span>
              <textarea
                value={formState.description}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Describe el propósito del template y su uso esperado."
                rows={4}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                disabled={isPending}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-900">
                Estado
              </span>
              <select
                value={formState.status}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    status: event.target.value as TemplateFormState["status"],
                  }))
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950"
                disabled={isPending}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </label>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                className={secondaryButtonClassName}
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={primaryButtonClassName}
                disabled={isPending}
              >
                {isPending
                  ? "Guardando..."
                  : editorState.mode === "edit"
                    ? "Guardar Cambios"
                    : "Crear Template"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {deleteTarget ? (
        <ModalShell
          eyebrow="Super Admin / Templates"
          title="Eliminar template global"
          description="Esta acción borra el registro base del catálogo legacy. Verifica que ya no sea necesario para nuevos tenants o clonaciones."
          onClose={() => setDeleteTarget(null)}
        >
          <div className="space-y-5">
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700">
              Vas a eliminar <strong>{deleteTarget.name}</strong>. Esta acción
              no se puede deshacer desde esta vista.
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className={secondaryButtonClassName}
                disabled={isPending}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className={dangerButtonClassName}
                disabled={isPending}
              >
                {isPending ? "Eliminando..." : "Confirmar Eliminación"}
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
