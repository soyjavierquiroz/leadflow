"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/app-shell/data-table";
import { KpiCard } from "@/components/app-shell/kpi-card";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { ModalShell } from "@/components/team-operations/modal-shell";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { formatCompactNumber, formatDateTime } from "@/lib/app-shell/utils";
import { AVAILABLE_TEMPLATE_STYLES } from "@/lib/template-registry";
import type {
  SystemTemplateDeploymentResponse,
  SystemTemplateRecord,
  SystemTenantRecord,
} from "@/lib/system-tenants";
import { authenticatedOperationRequest } from "@/lib/team-operations";

type SystemTemplatesClientProps = {
  initialRows: SystemTemplateRecord[];
  teams: SystemTenantRecord[];
};

type DeployTargetState = {
  id: string;
  name: string;
} | null;

type ToastState = {
  title: string;
  description: string | null;
};

const primaryButtonClassName =
  "rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const sortRows = (rows: SystemTemplateRecord[]) =>
  [...rows].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );

const officialTemplateIds = new Set(
  AVAILABLE_TEMPLATE_STYLES.map((template) => template.id),
);
const officialTemplateNames = new Set(
  AVAILABLE_TEMPLATE_STYLES.map((template) => template.name.trim().toLowerCase()),
);

const isOfficialTemplateRow = (row: SystemTemplateRecord) =>
  officialTemplateIds.has(row.id) ||
  officialTemplateIds.has(row.code) ||
  officialTemplateNames.has(row.name.trim().toLowerCase());

const getTemplateEditHref = (templateId: string) =>
  `/admin/templates/${encodeURIComponent(templateId)}/edit`;

export function SystemTemplatesClient({
  initialRows,
  teams,
}: SystemTemplatesClientProps) {
  const router = useRouter();
  const toastTimeoutRef = useRef<number | null>(null);
  const [rows, setRows] = useState(() =>
    sortRows(initialRows.filter(isOfficialTemplateRow)),
  );
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [deployTarget, setDeployTarget] = useState<DeployTargetState>(null);
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setRows(sortRows(initialRows.filter(isOfficialTemplateRow)));
  }, [initialRows]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

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

  const activeCount = rows.filter((item) => item.status === "active").length;
  const draftCount = rows.filter((item) => item.status === "draft").length;
  const archivedCount = rows.filter((item) => item.status === "archived").length;
  const totalBlocks = rows.reduce(
    (sum, row) => sum + (Array.isArray(row.blocks) ? row.blocks.length : 0),
    0,
  );

  const sortedTeams = [...teams].sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  const openDeployModal = (row: SystemTemplateRecord) => {
    setFeedback(null);
    setSelectedTeamId(sortedTeams[0]?.id ?? "");
    setDeployTarget({
      id: row.id,
      name: row.name,
    });
  };

  const handleDeploySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!deployTarget) {
      return;
    }

    const teamId = selectedTeamId.trim();

    if (!teamId) {
      setFeedback({
        tone: "error",
        message: "Selecciona una agencia antes de desplegar el template.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const payload =
          await authenticatedOperationRequest<SystemTemplateDeploymentResponse>(
            `/system/templates/${encodeURIComponent(deployTarget.id)}/deploy`,
            {
              method: "POST",
              body: JSON.stringify({ teamId }),
            },
          );

        setDeployTarget(null);
        showToast(
          "Template desplegado.",
          `${payload.funnel.name} ya quedó creado en ${payload.team.name}.`,
        );
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos desplegar el template al tenant.",
        });
      }
    });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Super Admin / Templates"
        title="Catálogo global de templates"
        description="Administra las plantillas base que nacen en el builder híbrido y luego se despliegan como funnels hacia los tenants."
        actions={
          <button
            type="button"
            onClick={() => router.push("/admin/templates/new")}
            className={primaryButtonClassName}
          >
            Nuevo Template
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
          label="Templates Totales"
          value={formatCompactNumber(rows.length)}
          hint="Catálogo global disponible para creación y despliegue."
        />
        <KpiCard
          label="Activos"
          value={formatCompactNumber(activeCount)}
          hint="Templates listos para despliegue inmediato a tenants."
        />
        <KpiCard
          label="Drafts"
          value={formatCompactNumber(draftCount)}
          hint="Plantillas en edición dentro del builder compartido."
        />
        <KpiCard
          label="Bloques totales"
          value={formatCompactNumber(totalBlocks)}
          hint="Inventario agregado de bloques persistidos en el catálogo."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {AVAILABLE_TEMPLATE_STYLES.map((template) => (
          <article
            key={template.id}
            className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
                  Core Template Asset
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  {template.name}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  {template.description}
                </p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
                Oficial
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Template ID
                </p>
                <code className="mt-2 block text-sm font-semibold text-slate-950">
                  {template.id}
                </code>
              </div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Variables
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-950">
                  {Object.keys(template.themeStyle).length} tokens CSS
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Utilidades
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-950">
                  {Object.keys(template.classNames).length} clases compartidas
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {template.styleModulePath}
            </p>
          </article>
        ))}
      </section>

      <DataTable
        columns={[
          {
            key: "template",
            header: "Template",
            render: (row) => (
              <div>
                <Link
                  href={getTemplateEditHref(row.id)}
                  className="font-semibold text-slate-950 transition hover:text-teal-700 hover:underline"
                >
                  {row.name}
                </Link>
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
            key: "blocks",
            header: "Blocks",
            render: (row) => (
              <div className="space-y-1">
                <p>{Array.isArray(row.blocks) ? row.blocks.length : 0} bloques</p>
                <p className="text-xs text-slate-500">
                  {Object.keys(
                    row.mediaMap && typeof row.mediaMap === "object" && !Array.isArray(row.mediaMap)
                      ? row.mediaMap
                      : {},
                  ).length}{" "}
                  llaves media
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
                <Link
                  href={getTemplateEditHref(row.id)}
                  className={secondaryButtonClassName}
                >
                  Editar
                </Link>
                <button
                  type="button"
                  onClick={() => openDeployModal(row)}
                  className={primaryButtonClassName}
                >
                  Desplegar a Agencia
                </button>
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyTitle="Sin templates globales"
        emptyDescription="Crea el primer template en el builder para activar el catálogo global del super admin."
      />

      {deployTarget ? (
        <ModalShell
          eyebrow="Super Admin / Templates"
          title={`Desplegar ${deployTarget.name}`}
          description="Selecciona la agencia destino. El backend creará un nuevo funnel asignado a ese tenant usando los blocks y la metadata del template."
          onClose={() => setDeployTarget(null)}
        >
          <form className="space-y-5" onSubmit={handleDeploySubmit}>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Agencia destino
              </span>
              <select
                value={selectedTeamId}
                onChange={(event) => setSelectedTeamId(event.target.value)}
                disabled={isPending}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-950 disabled:cursor-not-allowed disabled:bg-slate-100"
              >
                <option value="">Selecciona una agencia</option>
                {sortedTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.code})
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
              Este despliegue crea un nuevo funnel del tenant usando el contrato
              <code> POST /v1/system/templates/:templateId/deploy</code> con el
              <code> teamId</code> seleccionado.
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeployTarget(null)}
                disabled={isPending}
                className={secondaryButtonClassName}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending || sortedTeams.length === 0}
                className={primaryButtonClassName}
              >
                {isPending ? "Desplegando..." : "Desplegar"}
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}
    </div>
  );
}
