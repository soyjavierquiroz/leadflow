"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, FileJson, Save, Sparkles } from "lucide-react";
import { SectionHeader } from "@/components/app-shell/section-header";
import {
  defaultBlocksSeed,
  HybridJsonMediaEditor,
  requiredMediaKeys,
  type MediaRow,
  toMediaRows,
} from "@/components/team-operations/hybrid-json-media-editor";
import { buildHybridJsonPreviewDraftKey } from "@/components/team-operations/hybrid-json-preview-state";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { availableFunnelThemes, resolveFunnelThemeId } from "@/lib/funnel-theme-registry";
import type { FunnelThemeId } from "@/lib/funnel-theme.types";
import { optimizeFunnelAssetImage } from "@/lib/media-optimizer";
import {
  mergeStepLayoutOverride,
  readStepLayoutOverride,
  type StepLayoutOverrideValue,
} from "@/lib/public-step-layout";
import { uploadFileWithPresignedUrl } from "@/lib/storage";
import type {
  JsonValue,
  SystemTenantDetailRecord,
  SystemTenantFunnelDetailRecord,
  SystemTenantFunnelStepMutationResponse,
  SystemTenantFunnelStepRecord,
} from "@/lib/system-tenants.types";
import { authenticatedOperationRequest } from "@/lib/team-operations";

const primaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full bg-app-text px-4 py-2.5 text-sm font-semibold text-app-bg transition hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full border border-app-border bg-app-card px-4 py-2.5 text-sm font-semibold text-app-text transition hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-60";

const sectionClassName =
  "rounded-[2rem] border border-app-border bg-app-card p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-8";

const fieldLabelClassName = "text-sm font-medium text-app-text-muted";

const editorStepDefinitions = [
  {
    key: "captura",
    label: "Paso 1: Landing (Captura)",
  },
  {
    key: "confirmado",
    label: "Paso 2: Handoff (Confirmación)",
  },
] as const;

type EditorStepTabKey = (typeof editorStepDefinitions)[number]["key"];

type StepDraft = {
  blocksText: string;
  mediaRows: MediaRow[];
  settingsJson: JsonValue;
};

type FunnelStepHistoryVersion = {
  id: string;
  stepId: string;
  blocksJson: JsonValue;
  settingsJson: JsonValue;
  createdAt: string;
  createdBy: string | null;
};

const createEmptyStepDraft = (): StepDraft => ({
  blocksText: defaultBlocksSeed,
  mediaRows: toMediaRows(undefined),
  settingsJson: {},
});

const toBlocksText = (value: JsonValue) =>
  Array.isArray(value) ? JSON.stringify(value, null, 2) : defaultBlocksSeed;

const buildStepDraft = (step: SystemTenantFunnelStepRecord): StepDraft => ({
  blocksText: toBlocksText(step.blocksJson),
  mediaRows: toMediaRows(step.mediaMap),
  settingsJson: step.settingsJson,
});

const buildStepDraftMap = (steps: SystemTenantFunnelStepRecord[]) =>
  Object.fromEntries(steps.map((step) => [step.id, buildStepDraft(step)]));

const normalizeStepRecords = (value: unknown): SystemTenantFunnelStepRecord[] =>
  Array.isArray(value) ? (value as SystemTenantFunnelStepRecord[]) : [];

const asRecord = (value: JsonValue | null | undefined) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, JsonValue>)
    : null;

const extractThemeFromSettings = (value: JsonValue | null | undefined) => {
  const record = asRecord(value);
  return resolveFunnelThemeId(record?.theme);
};

const mergeThemeIntoSettings = (value: JsonValue | null | undefined, themeId: string) => {
  const record = asRecord(value) ?? {};

  return {
    ...record,
    theme: resolveFunnelThemeId(themeId),
  } satisfies Record<string, JsonValue>;
};

const pickPrimaryCaptureStep = (steps: SystemTenantFunnelStepRecord[]) =>
  steps.find((step) => step.slug === "captura") ??
  steps.find((step) => step.isEntryStep) ??
  steps.find((step) => ["landing", "lead_capture"].includes(step.stepType)) ??
  steps[0] ??
  null;

const pickPrimaryConfirmStep = (
  steps: SystemTenantFunnelStepRecord[],
  captureStepId: string | null,
) =>
  steps.find((step) => step.slug === "confirmado") ??
  steps.find(
    (step) =>
      step.id !== captureStepId &&
      ["handoff", "confirmation", "thank_you", "redirect"].includes(step.stepType),
  ) ??
  steps.find((step) => step.id !== captureStepId) ??
  null;

type SystemTenantTemplateFunnelEditorProps = {
  tenant: SystemTenantDetailRecord;
  funnel: SystemTenantFunnelDetailRecord;
};

export function SystemTenantTemplateFunnelEditor({
  tenant,
  funnel,
}: SystemTenantTemplateFunnelEditorProps) {
  const router = useRouter();
  const normalizedSteps = useMemo(
    () => normalizeStepRecords((funnel as { steps?: unknown }).steps),
    [funnel],
  );
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploadingRowIndex, setUploadingRowIndex] = useState<number | null>(null);
  const [name, setName] = useState(funnel.name);
  const [description, setDescription] = useState(funnel.description ?? "");
  const [funnelSettingsJson, setFunnelSettingsJson] = useState<JsonValue>(
    funnel.settingsJson,
  );
  const [selectedThemeId, setSelectedThemeId] = useState(
    extractThemeFromSettings(funnel.settingsJson),
  );
  const [stepRecords, setStepRecords] = useState<SystemTenantFunnelStepRecord[]>(
    normalizedSteps,
  );
  const [stepDrafts, setStepDrafts] = useState<Record<string, StepDraft>>(
    () => buildStepDraftMap(normalizedSteps),
  );
  const [fallbackDrafts, setFallbackDrafts] = useState<
    Record<EditorStepTabKey, StepDraft>
  >({
    captura: createEmptyStepDraft(),
    confirmado: createEmptyStepDraft(),
  });
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyErrorMessage, setHistoryErrorMessage] = useState<string | null>(
    null,
  );
  const [historyVersions, setHistoryVersions] = useState<FunnelStepHistoryVersion[]>(
    [],
  );
  const mediaUploadInputRef = useRef<HTMLInputElement | null>(null);
  const pendingMediaUploadIndexRef = useRef<number | null>(null);

  useEffect(() => {
    setStepRecords(normalizedSteps);
    setStepDrafts(buildStepDraftMap(normalizedSteps));
    setName(funnel.name);
    setDescription(funnel.description ?? "");
    setFunnelSettingsJson(funnel.settingsJson);
    setSelectedThemeId(extractThemeFromSettings(funnel.settingsJson));
  }, [funnel, normalizedSteps]);

  useEffect(() => {
    if (normalizedSteps.length === 0) {
      console.warn(
        "[SystemTenantTemplateFunnelEditor] Funnel detail arrived without step records; rendering step switcher in fallback mode.",
        {
          funnelId: funnel.id,
          teamId: tenant.id,
        },
      );
    }
  }, [funnel.id, normalizedSteps.length, tenant.id]);

  const captureStep = useMemo(
    () => pickPrimaryCaptureStep(stepRecords),
    [stepRecords],
  );
  const confirmStep = useMemo(
    () => pickPrimaryConfirmStep(stepRecords, captureStep?.id ?? null),
    [stepRecords, captureStep?.id],
  );
  const stepTabs = useMemo(
    () =>
      editorStepDefinitions.map((definition) => ({
        ...definition,
        step:
          definition.key === "captura"
            ? captureStep
            : confirmStep,
      })),
    [captureStep, confirmStep],
  );
  const [activeStepTab, setActiveStepTab] = useState<EditorStepTabKey>("captura");

  useEffect(() => {
    if (!editorStepDefinitions.some((step) => step.key === activeStepTab)) {
      setActiveStepTab("captura");
    }
  }, [activeStepTab]);

  const activeStep = stepTabs.find((tab) => tab.key === activeStepTab)?.step ?? null;
  const activeStepTabLabel =
    stepTabs.find((tab) => tab.key === activeStepTab)?.label ??
    "Paso activo";
  const activeDraft = activeStep
    ? stepDrafts[activeStep.id] ?? buildStepDraft(activeStep)
    : fallbackDrafts[activeStepTab] ?? createEmptyStepDraft();
  const nextFunnelSettingsJson = mergeThemeIntoSettings(
    funnelSettingsJson,
    selectedThemeId,
  );
  const blocksText = activeDraft.blocksText;
  const mediaRows = activeDraft.mediaRows;
  const stepLayoutOverride = readStepLayoutOverride(activeDraft.settingsJson);
  const editorContext = {
    stepName: activeStepTabLabel,
    stepPath: activeStep ? `/${activeStep.slug}` : `/${activeStepTab}`,
  };

  useEffect(() => {
    setIsHistoryOpen(false);
    setIsHistoryLoading(false);
    setHistoryErrorMessage(null);
    setHistoryVersions([]);
  }, [activeStep?.id]);
  const previewDraftKey = buildHybridJsonPreviewDraftKey(
    `tenant-funnel-${funnel.id}`,
    activeStep?.id ?? activeStepTab,
  );
  const activeStepHistoryTitle = activeStep
    ? `${activeStepTabLabel} (${activeStep.slug})`
    : activeStepTabLabel;

  const updateActiveStepDraft = (patch: Partial<StepDraft>) => {
    if (activeStep) {
      setStepDrafts((current) => ({
        ...current,
        [activeStep.id]: {
          ...(current[activeStep.id] ?? buildStepDraft(activeStep)),
          ...patch,
        },
      }));
      return;
    }

    setFallbackDrafts((current) => ({
      ...current,
      [activeStepTab]: {
        ...(current[activeStepTab] ?? createEmptyStepDraft()),
        ...patch,
      },
    }));
  };

  const parsedBlocks = useMemo(() => {
    try {
      const value = JSON.parse(blocksText) as unknown;
      if (!Array.isArray(value)) {
        return {
          value: null,
          error: "El blocks debe ser un JSON Array válido.",
        };
      }

      return {
        value,
        error: null,
      };
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : "JSON inválido.",
      };
    }
  }, [blocksText]);

  const mediaMap = useMemo(() => {
    return mediaRows.reduce<Record<string, string>>((accumulator, row) => {
      const key = row.key.trim();
      const value = row.value.trim();
      if (!key || !value) {
        return accumulator;
      }

      accumulator[key] = value;
      return accumulator;
    }, {});
  }, [mediaRows]);

  const mediaValidation = useMemo(() => {
    const keySet = new Set<string>();
    for (const row of mediaRows) {
      const key = row.key.trim();
      if (!key) {
        continue;
      }

      if (keySet.has(key)) {
        return `La llave "${key}" está duplicada en el media dictionary.`;
      }

      keySet.add(key);
    }

    return null;
  }, [mediaRows]);

  const isSaveDisabled =
    isPending ||
    uploadingRowIndex !== null ||
    !name.trim() ||
    Boolean(parsedBlocks.error) ||
    Boolean(mediaValidation) ||
    !activeStep;

  const handleMediaRowChange = (index: number, patch: Partial<MediaRow>) => {
    updateActiveStepDraft({
      mediaRows: mediaRows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              ...patch,
            }
          : row,
      ),
    });
  };

  const handleAddMediaRow = (key = "") => {
    updateActiveStepDraft({
      mediaRows: [...mediaRows, { key, value: "" }],
    });
  };

  const handleUploadMediaClick = (index: number) => {
    pendingMediaUploadIndexRef.current = index;
    mediaUploadInputRef.current?.click();
  };

  const handleOpenHistory = () => {
    if (!activeStep) {
      return;
    }

    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    setHistoryErrorMessage(null);

    void authenticatedOperationRequest<FunnelStepHistoryVersion[]>(
      `/system/tenants/${encodeURIComponent(tenant.id)}/funnels/${encodeURIComponent(funnel.id)}/steps/${encodeURIComponent(activeStep.id)}/history`,
      { method: "GET" },
    )
      .then((payload) => {
        setHistoryVersions(Array.isArray(payload) ? payload : []);
      })
      .catch((error) => {
        setHistoryErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos cargar el historial del paso.",
        );
      })
      .finally(() => setIsHistoryLoading(false));
  };

  const handleRestoreHistoryVersion = (historyId: string) => {
    const version = historyVersions.find((entry) => entry.id === historyId);
    if (!version) {
      return;
    }

    updateActiveStepDraft({
      blocksText: toBlocksText(version.blocksJson),
      settingsJson: version.settingsJson,
    });
    setIsHistoryOpen(false);
    setSuccessMessage(
      `Versión previa cargada en el borrador de ${
        activeStepTabLabel.toLowerCase()
      }. Guarda cuando confirmes el rollback.`,
    );
    setErrorMessage(null);
  };

  const handleMediaUploadChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const targetIndex = pendingMediaUploadIndexRef.current;
    const file = event.target.files?.[0];
    event.target.value = "";

    if (targetIndex === null || !file) {
      pendingMediaUploadIndexRef.current = null;
      return;
    }

    if (!file.type.startsWith("image/")) {
      pendingMediaUploadIndexRef.current = null;
      setErrorMessage("Solo puedes subir imágenes al media dictionary.");
      return;
    }

    const rowKey = mediaRows[targetIndex]?.key.trim() || `media_${targetIndex + 1}`;

    setErrorMessage(null);
    setSuccessMessage(null);
    setUploadingRowIndex(targetIndex);

    try {
      const optimizedFile = await optimizeFunnelAssetImage(file);
      const publicUrl = await uploadFileWithPresignedUrl(
        optimizedFile,
        "funnels",
        {
          teamId: tenant.id,
        },
      );
      handleMediaRowChange(targetIndex, { value: publicUrl });
      setSuccessMessage(`Imagen subida al CDN para ${rowKey}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No pudimos subir la imagen al CDN.",
      );
    } finally {
      pendingMediaUploadIndexRef.current = null;
      setUploadingRowIndex(null);
    }
  };

  const handleSave = () => {
    if (!parsedBlocks.value || !activeStep) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const funnelSettingsPayload = mergeThemeIntoSettings(
          nextFunnelSettingsJson,
          selectedThemeId,
        );

        await authenticatedOperationRequest(
          `/system/tenants/${encodeURIComponent(tenant.id)}/funnels/${encodeURIComponent(funnel.id)}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              funnelInstanceId: funnel.funnelInstanceId,
              name: name.trim(),
              description: description.trim() || null,
              settingsJson: funnelSettingsPayload,
            }),
          },
        );

        const payload = {
          name: name.trim(),
          description: description.trim() || null,
          blocksJson: parsedBlocks.value,
          mediaMap,
          settingsJson: activeDraft?.settingsJson ?? activeStep.settingsJson,
        };

        const response =
          await authenticatedOperationRequest<SystemTenantFunnelStepMutationResponse>(
            `/system/tenants/${encodeURIComponent(tenant.id)}/funnels/${encodeURIComponent(funnel.id)}/steps/${encodeURIComponent(activeStep.id)}`,
            {
              method: "PATCH",
              body: JSON.stringify(payload),
            },
          );

        setName(response.funnel.name);
        setDescription(response.funnel.description ?? "");
        setStepRecords((current) =>
          current.map((step) => (step.id === response.step.id ? response.step : step)),
        );
        setStepDrafts((current) => ({
          ...current,
          [response.step.id]: buildStepDraft(response.step),
        }));
        setFunnelSettingsJson(funnelSettingsPayload);
        setSelectedThemeId(extractThemeFromSettings(funnelSettingsPayload));
        setSuccessMessage(
          `${stepTabs.find((tab) => tab.key === activeStepTab)?.label ?? "Paso"} actualizado correctamente.`,
        );
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "No pudimos guardar el funnel del tenant.",
        );
      }
    });
  };

  const activeStepLabel =
    stepTabs.find((tab) => tab.key === activeStepTab)?.label ?? "Paso activo";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`Super Admin / Tenant / ${tenant.code} / Template Funnel`}
        title={`Editor de ${name || funnel.name}`}
        description="Este funnel nació desde el Template Engine global y ahora separa edición por paso entre captura y confirmación."
        actions={
          <>
            <Link
              href={`/admin/tenants/${encodeURIComponent(tenant.id)}`}
              className={secondaryButtonClassName}
            >
              Volver al tenant
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaveDisabled}
              className={primaryButtonClassName}
            >
              <Save className="h-4 w-4" />
              Guardar embudo
            </button>
          </>
        }
      />

      {errorMessage ? <OperationBanner tone="error" message={errorMessage} /> : null}
      {successMessage ? (
        <OperationBanner tone="success" message={successMessage} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <article className={sectionClassName}>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-app-accent-soft p-2 text-app-accent">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                Funnel asignado
              </p>
              <p className="mt-1 text-sm font-semibold text-app-text">
                {tenant.name}
              </p>
            </div>
          </div>
        </article>
        <article className={sectionClassName}>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-app-warning-bg p-2 text-app-warning-text">
              <FileJson className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                Bloques válidos
              </p>
              <p className="mt-1 text-sm font-semibold text-app-text">
                {parsedBlocks.value
                  ? `${parsedBlocks.value.length} bloques listos`
                  : "Corrige el JSON"}
              </p>
            </div>
          </div>
        </article>
        <article className={sectionClassName}>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-app-success-bg p-2 text-app-success-text">
              <Check className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                Paso activo
              </p>
              <p className="mt-1 text-sm font-semibold text-app-text">
                {activeStep ? activeStepLabel : "Sin paso disponible"}
              </p>
            </div>
          </div>
        </article>
      </section>

      <details open className={sectionClassName}>
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-text-soft">
              Configuración
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-app-text">
              Identidad del funnel
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-app-text-muted">
              Ordena nombre, descripción y tema del funnel antes de bajar al
              detalle operativo por paso.
            </p>
          </div>
        </summary>

        <div className="mt-6 grid gap-5">
          <label className="grid gap-2">
            <span className={fieldLabelClassName}>Nombre del funnel</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent"
            />
          </label>

          <label className="grid gap-2">
            <span className={fieldLabelClassName}>Descripción</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent"
            />
          </label>

          <label className="grid gap-2">
            <span className={fieldLabelClassName}>Funnel Theme</span>
            <select
              value={selectedThemeId}
              onChange={(event) =>
                setSelectedThemeId(event.target.value as FunnelThemeId)
              }
              className="rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent"
            >
              {availableFunnelThemes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
            <span className="text-xs leading-5 text-app-text-soft">
              Se guarda en `funnelInstance.settingsJson.theme` y aplica al funnel
              completo, no al paso activo.
            </span>
          </label>
        </div>
      </details>

      <HybridJsonMediaEditor
        key={activeStep?.id ?? activeStepTab}
        blocksText={blocksText}
        previewDraftKey={previewDraftKey}
        editorContext={editorContext}
        onBlocksTextChange={(value) => updateActiveStepDraft({ blocksText: value })}
        parsedBlocksError={parsedBlocks.error}
        parsedBlocksCount={parsedBlocks.value?.length ?? 0}
        mediaRows={mediaRows}
        mediaValidation={mediaValidation}
        mediaMapKeys={requiredMediaKeys.filter((key) =>
          Object.prototype.hasOwnProperty.call(mediaMap, key),
        )}
        uploadingRowIndex={uploadingRowIndex}
        mediaUploadInputRef={mediaUploadInputRef}
        onMediaUploadChange={handleMediaUploadChange}
        onMediaRowChange={handleMediaRowChange}
        onAddMediaRow={handleAddMediaRow}
        onUploadMediaClick={handleUploadMediaClick}
        onRemoveMediaRow={(index) =>
          updateActiveStepDraft({
            mediaRows: mediaRows.filter((_, rowIndex) => rowIndex !== index),
          })
        }
        previewTheme={selectedThemeId}
        previewSettingsJson={activeDraft.settingsJson}
        stepSpecificSettingsPanel={
          <article className="rounded-[1.5rem] border border-app-border bg-app-surface-muted p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-text-soft">
                  Configuración específica del paso
                </p>
                <h3 className="mt-2 text-xl font-semibold text-app-text">
                  Layout del paso
                </h3>
                <p className="mt-2 text-sm leading-6 text-app-text-muted">
                  Ajusta cómo se renderiza este paso en runtime sin tocar el
                  layout global del funnel. Ideal para que el handoff o la
                  confirmación salgan del split sticky cuando haga falta.
                </p>
              </div>

              <label className="grid min-w-full gap-2 lg:min-w-[22rem]">
                <span className={fieldLabelClassName}>Layout del paso</span>
                <select
                  value={stepLayoutOverride}
                  onChange={(event) =>
                    updateActiveStepDraft({
                      settingsJson: mergeStepLayoutOverride(
                        activeDraft.settingsJson,
                        event.target.value as StepLayoutOverrideValue,
                      ),
                    })
                  }
                  className="rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm text-app-text outline-none transition focus:border-app-accent"
                >
                  <option value="inherit">Heredar del Funnel (Por defecto)</option>
                  <option value="full-page">Estructura Centrada / Full Page</option>
                  <option value="blank">Blank</option>
                </select>
              </label>
            </div>
          </article>
        }
        historyPanel={
          activeStep
            ? {
                isOpen: isHistoryOpen,
                isLoading: isHistoryLoading,
                errorMessage: historyErrorMessage,
                title: activeStepHistoryTitle,
                versions: historyVersions,
                onOpen: handleOpenHistory,
                onClose: () => setIsHistoryOpen(false),
                onRestore: handleRestoreHistoryVersion,
              }
            : null
        }
        stepSwitcher={{
          activeKey: activeStepTab,
          badge: activeStep?.slug ?? activeStepTab,
          disabled: isPending || uploadingRowIndex !== null,
          helperText:
            "Cada pestaña carga y guarda el JSON del FunnelStep activo.",
          tabs: stepTabs.map((tab) => ({
            key: tab.key,
            label: tab.label,
          })),
          warningText: !activeStep
            ? "El backend todavía no expone los FunnelStep detallados en esta vista. El switcher queda visible en modo fallback y el guardado seguirá bloqueado hasta recibir el step activo."
            : null,
          onChange: (key) => {
            setErrorMessage(null);
            setSuccessMessage(null);
            setActiveStepTab(key as EditorStepTabKey);
          },
        }}
      />
    </div>
  );
}
