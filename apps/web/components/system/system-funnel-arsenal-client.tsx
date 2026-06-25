"use client";

import {
  businessBlueprints,
  commercialVerticals,
} from "@leadflow/account-model";
import { Archive, Pencil, Plus, Save } from "lucide-react";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { SectionHeader } from "@/components/app-shell/section-header";
import { StatusBadge } from "@/components/app-shell/status-badge";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { authenticatedOperationRequest } from "@/lib/team-operations";
import type {
  SystemFunnelArsenalTemplate,
  SystemFunnelArsenalTemplateStatus,
} from "@/lib/system-funnel-arsenal";

type SystemFunnelArsenalClientProps = {
  initialTemplates: SystemFunnelArsenalTemplate[];
};

type FormState = {
  templateKey: string;
  blueprintKey: string;
  vertical: string;
  label: string;
  description: string;
  goal: string;
  recommendedFor: string;
  cta: string;
  pathSuggestion: string;
  difficulty: string;
  status: SystemFunnelArsenalTemplateStatus;
  blocksPresetKey: string;
  funnelTemplateId: string;
  sourceFunnelId: string;
  sourceFunnelInstanceId: string;
};

const emptyFormState: FormState = {
  templateKey: "",
  blueprintKey: "blueprint.health_wellness.v1",
  vertical: "health_wellness",
  label: "",
  description: "",
  goal: "",
  recommendedFor: "",
  cta: "",
  pathSuggestion: "/evaluacion",
  difficulty: "basic",
  status: "draft",
  blocksPresetKey: "basic-lead-capture",
  funnelTemplateId: "",
  sourceFunnelId: "",
  sourceFunnelInstanceId: "",
};

const primaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full bg-app-text px-4 py-2.5 text-sm font-semibold text-app-bg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full border border-app-border bg-app-card px-4 py-2.5 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-60";
const fieldClassName =
  "mt-2 w-full rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition placeholder:text-app-text-soft focus:border-app-border-strong focus:ring-2 focus:ring-app-accent-soft [&>option]:bg-app-card [&>option]:text-app-text";

const toFormState = (template: SystemFunnelArsenalTemplate): FormState => ({
  templateKey: template.templateKey,
  blueprintKey: template.blueprintKey,
  vertical: template.vertical,
  label: template.label,
  description: template.description,
  goal: template.goal,
  recommendedFor: template.recommendedFor,
  cta: template.cta,
  pathSuggestion: template.pathSuggestion,
  difficulty: template.difficulty,
  status: template.status,
  blocksPresetKey: template.blocksPresetKey ?? "",
  funnelTemplateId: template.funnelTemplateId ?? "",
  sourceFunnelId: template.sourceFunnelId ?? "",
  sourceFunnelInstanceId: template.sourceFunnelInstanceId ?? "",
});

const toPayload = (formState: FormState) => ({
  ...formState,
  blocksPresetKey: formState.blocksPresetKey || null,
  funnelTemplateId: formState.funnelTemplateId || null,
  sourceFunnelId: formState.sourceFunnelId || null,
  sourceFunnelInstanceId: formState.sourceFunnelInstanceId || null,
});

const sortTemplates = (templates: SystemFunnelArsenalTemplate[]) =>
  [...templates].sort((left, right) =>
    `${left.blueprintKey}:${left.label}`.localeCompare(
      `${right.blueprintKey}:${right.label}`,
    ),
  );

export function SystemFunnelArsenalClient({
  initialTemplates,
}: SystemFunnelArsenalClientProps) {
  const [templates, setTemplates] = useState(() => sortTemplates(initialTemplates));
  const [formState, setFormState] = useState<FormState>(emptyFormState);
  const [editingTemplateKey, setEditingTemplateKey] = useState<string | null>(
    null,
  );
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeTemplates = useMemo(
    () => templates.filter((template) => template.status === "active").length,
    [templates],
  );

  const updateField = <Key extends keyof FormState>(
    key: Key,
    value: FormState[Key],
  ) => {
    if (key === "blueprintKey") {
      const blueprint = businessBlueprints.find(
        (item) => item.blueprintKey === value,
      );

      setFormState((current) => ({
        ...current,
        blueprintKey: String(value),
        vertical: blueprint?.vertical ?? current.vertical,
      }));
      return;
    }

    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const resetForm = () => {
    setEditingTemplateKey(null);
    setFormState(emptyFormState);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    const path = editingTemplateKey
      ? `/system/funnel-arsenal/${encodeURIComponent(editingTemplateKey)}`
      : "/system/funnel-arsenal";
    const method = editingTemplateKey ? "PATCH" : "POST";

    startTransition(async () => {
      try {
        const saved =
          await authenticatedOperationRequest<SystemFunnelArsenalTemplate>(path, {
            method,
            body: JSON.stringify(toPayload(formState)),
          });

        setTemplates((current) =>
          sortTemplates([
            ...current.filter(
              (template) => template.templateKey !== editingTemplateKey,
            ),
            saved,
          ]),
        );
        setFeedback({
          tone: "success",
          message: editingTemplateKey
            ? "Template del Arsenal actualizado."
            : "Template del Arsenal creado.",
        });
        resetForm();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos guardar el template del Arsenal.",
        });
      }
    });
  };

  const handleEdit = (template: SystemFunnelArsenalTemplate) => {
    setFeedback(null);
    setEditingTemplateKey(template.templateKey);
    setFormState(toFormState(template));
  };

  const handleArchive = (templateKey: string) => {
    setFeedback(null);

    startTransition(async () => {
      try {
        const archived =
          await authenticatedOperationRequest<SystemFunnelArsenalTemplate>(
            `/system/funnel-arsenal/${encodeURIComponent(templateKey)}`,
            {
              method: "DELETE",
            },
          );

        setTemplates((current) =>
          sortTemplates(
            current.map((template) =>
              template.templateKey === templateKey ? archived : template,
            ),
          ),
        );
        setFeedback({
          tone: "success",
          message: "Template archivado.",
        });
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos archivar el template.",
        });
      }
    });
  };

  return (
    <div className="w-full space-y-8">
      <SectionHeader
        eyebrow="Super Admin / Funnel Arsenal"
        title="Arsenal de embudos"
        description="Crea fichas habilitables por blueprint y conecta embudos fuente cuando quieras clonar una estructura real."
      />

      {feedback ? (
        <OperationBanner tone={feedback.tone} message={feedback.message} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-app-border bg-app-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-app-text-soft">
            Templates
          </p>
          <p className="mt-2 text-2xl font-semibold text-app-text">
            {templates.length}
          </p>
        </div>
        <div className="rounded-2xl border border-app-border bg-app-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-app-text-soft">
            Activos
          </p>
          <p className="mt-2 text-2xl font-semibold text-app-text">
            {activeTemplates}
          </p>
        </div>
        <div className="rounded-2xl border border-app-border bg-app-card p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-app-text-soft">
            Blueprints
          </p>
          <p className="mt-2 text-2xl font-semibold text-app-text">
            {new Set(templates.map((template) => template.blueprintKey)).size}
          </p>
        </div>
      </section>

      <form
        className="grid gap-4 rounded-2xl border border-app-border bg-app-surface p-5 xl:grid-cols-2"
        onSubmit={handleSubmit}
      >
        <div className="xl:col-span-2">
          <h2 className="text-lg font-semibold text-app-text">
            {editingTemplateKey ? "Editar template" : "Crear template"}
          </h2>
          <p className="mt-1 text-sm text-app-text-muted">
            La ficha puede ser manual o apuntar a un FunnelInstance fuente para
            clonar estructura al habilitar.
          </p>
        </div>

        <label className="text-sm font-medium text-app-text">
          Template key
          <input
            className={fieldClassName}
            value={formState.templateKey}
            onChange={(event) => updateField("templateKey", event.target.value)}
            required
          />
        </label>

        <label className="text-sm font-medium text-app-text">
          Blueprint
          <select
            className={fieldClassName}
            value={formState.blueprintKey}
            onChange={(event) => updateField("blueprintKey", event.target.value)}
          >
            {businessBlueprints.map((blueprint) => (
              <option key={blueprint.blueprintKey} value={blueprint.blueprintKey}>
                {blueprint.blueprintKey}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-app-text">
          Vertical
          <select
            className={fieldClassName}
            value={formState.vertical}
            onChange={(event) => updateField("vertical", event.target.value)}
          >
            {commercialVerticals.map((vertical) => (
              <option key={vertical.key} value={vertical.key}>
                {vertical.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-medium text-app-text">
          Nombre
          <input
            className={fieldClassName}
            value={formState.label}
            onChange={(event) => updateField("label", event.target.value)}
            required
          />
        </label>

        <label className="text-sm font-medium text-app-text xl:col-span-2">
          Descripción
          <textarea
            className={fieldClassName}
            value={formState.description}
            onChange={(event) => updateField("description", event.target.value)}
            required
            rows={3}
          />
        </label>

        <label className="text-sm font-medium text-app-text">
          Goal
          <input
            className={fieldClassName}
            value={formState.goal}
            onChange={(event) => updateField("goal", event.target.value)}
            required
          />
        </label>

        <label className="text-sm font-medium text-app-text">
          Recomendado para
          <input
            className={fieldClassName}
            value={formState.recommendedFor}
            onChange={(event) =>
              updateField("recommendedFor", event.target.value)
            }
            required
          />
        </label>

        <label className="text-sm font-medium text-app-text">
          CTA
          <input
            className={fieldClassName}
            value={formState.cta}
            onChange={(event) => updateField("cta", event.target.value)}
            required
          />
        </label>

        <label className="text-sm font-medium text-app-text">
          Path sugerido
          <input
            className={fieldClassName}
            value={formState.pathSuggestion}
            onChange={(event) =>
              updateField("pathSuggestion", event.target.value)
            }
            required
          />
        </label>

        <label className="text-sm font-medium text-app-text">
          Dificultad
          <select
            className={fieldClassName}
            value={formState.difficulty}
            onChange={(event) => updateField("difficulty", event.target.value)}
          >
            <option value="basic">basic</option>
            <option value="intermediate">intermediate</option>
            <option value="advanced">advanced</option>
          </select>
        </label>

        <label className="text-sm font-medium text-app-text">
          Estado
          <select
            className={fieldClassName}
            value={formState.status}
            onChange={(event) =>
              updateField(
                "status",
                event.target.value as SystemFunnelArsenalTemplateStatus,
              )
            }
          >
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="archived">archived</option>
          </select>
        </label>

        <label className="text-sm font-medium text-app-text">
          Source FunnelInstance ID
          <input
            className={fieldClassName}
            value={formState.sourceFunnelInstanceId}
            onChange={(event) =>
              updateField("sourceFunnelInstanceId", event.target.value)
            }
            placeholder="Opcional"
          />
        </label>

        <label className="text-sm font-medium text-app-text">
          Source Funnel ID
          <input
            className={fieldClassName}
            value={formState.sourceFunnelId}
            onChange={(event) => updateField("sourceFunnelId", event.target.value)}
            placeholder="Opcional"
          />
        </label>

        <div className="flex flex-col gap-3 border-t border-app-border pt-4 xl:col-span-2 sm:flex-row">
          <button className={primaryButtonClassName} disabled={isPending}>
            {editingTemplateKey ? (
              <Save className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {isPending
              ? "Guardando..."
              : editingTemplateKey
                ? "Guardar cambios"
                : "Crear template"}
          </button>
          {editingTemplateKey ? (
            <button
              type="button"
              className={secondaryButtonClassName}
              onClick={resetForm}
              disabled={isPending}
            >
              Cancelar edición
            </button>
          ) : null}
        </div>
      </form>

      <section className="grid gap-4 xl:grid-cols-2">
        {templates.map((template) => (
          <article
            key={template.templateKey}
            className="rounded-2xl border border-app-border bg-app-card p-5 shadow-[var(--ai-card-shadow)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-app-text-soft">
                  {template.blueprintKey}
                </p>
                <h2 className="mt-2 text-xl font-semibold text-app-text">
                  {template.label}
                </h2>
                <p className="mt-2 text-sm leading-6 text-app-text-muted">
                  {template.description}
                </p>
              </div>
              <StatusBadge value={template.status} />
            </div>

            <dl className="mt-4 grid gap-3 text-sm text-app-text-muted md:grid-cols-2">
              <div className="rounded-xl border border-app-border bg-app-surface px-3 py-2">
                <dt className="font-semibold text-app-text">Template key</dt>
                <dd className="mt-1 break-all">{template.templateKey}</dd>
              </div>
              <div className="rounded-xl border border-app-border bg-app-surface px-3 py-2">
                <dt className="font-semibold text-app-text">Path sugerido</dt>
                <dd className="mt-1">{template.pathSuggestion}</dd>
              </div>
              <div className="rounded-xl border border-app-border bg-app-surface px-3 py-2">
                <dt className="font-semibold text-app-text">CTA</dt>
                <dd className="mt-1">{template.cta}</dd>
              </div>
              <div className="rounded-xl border border-app-border bg-app-surface px-3 py-2">
                <dt className="font-semibold text-app-text">Source</dt>
                <dd className="mt-1 break-all">
                  {template.sourceFunnelInstanceId ?? "Manual"}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => handleEdit(template)}
                disabled={isPending}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </button>
              {template.status !== "archived" ? (
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() => handleArchive(template.templateKey)}
                  disabled={isPending}
                >
                  <Archive className="h-4 w-4" />
                  Archivar
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
