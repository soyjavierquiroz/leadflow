"use client";

import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  FileJson,
  Globe,
  Save,
  Sparkles,
} from "lucide-react";

import { SectionHeader } from "@/components/app-shell/section-header";
import {
  defaultBlocksSeed,
  HybridJsonMediaEditor,
  requiredMediaKeys,
  type MediaRow,
  toMediaRows,
} from "@/components/team-operations/hybrid-json-media-editor";
import { buildHybridJsonPreviewDraftKey } from "@/components/team-operations/hybrid-json-preview-state";
import type { BuilderBlockDefinition } from "@/lib/blocks/catalog";
import { optimizeFunnelAssetImage } from "@/lib/media-optimizer";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { availableFunnelThemes, resolveFunnelThemeId } from "@/lib/funnel-theme-registry";
import { uploadFileWithPresignedUrl } from "@/lib/storage";
import { teamOperationRequest } from "@/lib/team-operations";

const primaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const sectionClassName =
  "rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-6";

const defaultMediaRows = requiredMediaKeys.map((key) => ({
  key,
  value: "",
}));

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

const trimOuterSlashes = (value: string) => value.replace(/^\/+|\/+$/g, "");

const normalizePublicationPath = (value?: string | null) => {
  if (!value) {
    return "/";
  }

  const trimmed = value.trim();
  const withoutQuery = trimmed.split("?")[0] ?? "/";
  const withoutHash = withoutQuery.split("#")[0] ?? "/";
  const normalized = withoutHash.replace(/\/+/g, "/").replace(/\/$/, "");

  if (!normalized || normalized === ".") {
    return "/";
  }

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
};

const buildPublicationStepPath = (
  publicationPathPrefix: string,
  stepSlug: string,
  isEntryStep: boolean,
) => {
  const publicationPath = normalizePublicationPath(publicationPathPrefix);

  if (isEntryStep) {
    return publicationPath;
  }

  const normalizedSlug = trimOuterSlashes(stepSlug);
  if (!normalizedSlug) {
    return publicationPath;
  }

  return publicationPath === "/"
    ? `/${normalizedSlug}`
    : `${publicationPath}/${normalizedSlug}`;
};

type HybridPublicationStepDetail = {
  id: string;
  slug: string;
  stepType: string;
  position: number;
  isEntryStep: boolean;
  isConversionStep: boolean;
  blocksJson: unknown;
  mediaMap: unknown;
  settingsJson: unknown;
};

type HybridPublicationDetail = {
  publication: {
    id: string;
    funnelInstanceId: string;
    domainId: string;
    pathPrefix: string;
    status: string;
    isPrimary: boolean;
  };
  funnelInstance: {
    id: string;
    templateId: string;
    name: string;
    code: string;
    status: string;
    settingsJson: unknown;
  };
  step: {
    id: string;
    slug: string;
    stepType: string;
    position: number;
    blocksJson: unknown;
    mediaMap: unknown;
    settingsJson: unknown;
  };
  steps: HybridPublicationStepDetail[];
  seo: {
    title: string;
    metaDescription: string;
  };
};

type StepDraft = {
  blocksText: string;
  mediaRows: MediaRow[];
  settingsJson: unknown;
};

const createEmptyStepDraft = (): StepDraft => ({
  blocksText: JSON.stringify([], null, 2),
  mediaRows: [...defaultMediaRows],
  settingsJson: {},
});

const toBlocksText = (value: unknown) =>
  Array.isArray(value) ? JSON.stringify(value, null, 2) : JSON.stringify([], null, 2);

const buildStepDraft = (step: HybridPublicationStepDetail): StepDraft => ({
  blocksText: toBlocksText(step.blocksJson),
  mediaRows: toMediaRows(step.mediaMap),
  settingsJson: step.settingsJson,
});

const buildStepDraftMap = (steps: HybridPublicationStepDetail[]) =>
  Object.fromEntries(steps.map((step) => [step.id, buildStepDraft(step)]));

const normalizeStepRecords = (
  steps: HybridPublicationDetail["steps"] | undefined,
  legacyStep: HybridPublicationDetail["step"] | null,
) => {
  if (Array.isArray(steps) && steps.length > 0) {
    return steps;
  }

  if (!legacyStep) {
    return [];
  }

  return [
    {
      ...legacyStep,
      isEntryStep: true,
      isConversionStep: false,
    },
  ];
};

const pickPrimaryCaptureStep = (steps: HybridPublicationStepDetail[]) =>
  steps.find((step) => step.slug === "captura") ??
  steps.find((step) => step.isEntryStep) ??
  steps.find((step) => ["landing", "lead_capture"].includes(step.stepType)) ??
  steps[0] ??
  null;

const pickPrimaryConfirmStep = (
  steps: HybridPublicationStepDetail[],
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

type PublicationEditorDomainOption = {
  id: string;
  host: string;
  status: string;
};

type PublicationEditorTemplateOption = {
  id: string;
  name: string;
  code: string;
};

type TeamVslPublicationEditorProps = {
  domains: PublicationEditorDomainOption[];
  templates: PublicationEditorTemplateOption[];
  mode?: "team" | "system";
  teamId?: string;
  initialPublicationId?: string | null;
  backHref?: string;
  backLabel?: string;
  editorHref?: string;
  headerEyebrow?: string;
  headerTitle?: string;
  headerDescription?: string;
  availableBlocks?: BuilderBlockDefinition[];
};

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildTemplateOptions = (templates: PublicationEditorTemplateOption[]) => {
  return [...templates].sort((left, right) => {
    const leftPriority =
      left.name === "VexerCore Pro (Split 50/50)" ||
      left.code === "vexercore-pro-split-50-50"
        ? 0
        : 1;
    const rightPriority =
      right.name === "VexerCore Pro (Split 50/50)" ||
      right.code === "vexercore-pro-split-50-50"
        ? 0
        : 1;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.name.localeCompare(right.name);
  });
};

const ensureSelectedTemplateOption = (
  templates: PublicationEditorTemplateOption[],
  selectedTemplateId: string,
) => {
  if (
    !selectedTemplateId ||
    templates.some((template) => template.id === selectedTemplateId)
  ) {
    return templates;
  }

  return [
    {
      id: selectedTemplateId,
      name: `Template actual (${selectedTemplateId})`,
      code: selectedTemplateId,
    },
    ...templates,
  ];
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const extractThemeFromSettings = (value: unknown) => {
  const record = asRecord(value);
  return resolveFunnelThemeId(record?.theme);
};

const toStepReferenceLabel = (
  step: HybridPublicationStepDetail,
  captureStepId: string | null,
  confirmStepId: string | null,
) => {
  if (step.id === captureStepId) {
    return `Paso ${step.position} (Captura)`;
  }

  if (step.id === confirmStepId) {
    return `Paso ${step.position} (Confirmación)`;
  }

  return `Paso ${step.position} (${step.slug})`;
};

export function TeamVslPublicationEditor({
  domains,
  templates,
  mode = "team",
  teamId,
  initialPublicationId = null,
  backHref = "/team/publications",
  backLabel = "Volver a publicaciones",
  editorHref,
  headerEyebrow = "Team Admin / Publicaciones híbridas",
  headerTitle = "Crear o editar funnel VSL/Landing",
  headerDescription = "Gestiona el blocksJson y el mediaMap como dos capas separadas del assembly engine. Guardamos la instancia, el landing step y la publicación activa en una sola transacción.",
  availableBlocks,
}: TeamVslPublicationEditorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const publicationId =
    initialPublicationId ?? searchParams.get("publicationId");
  const templateOptions = useMemo(
    () => buildTemplateOptions(templates),
    [templates],
  );
  const activeDomains = useMemo(
    () => domains.filter((domain) => domain.status === "active"),
    [domains],
  );
  const [isPending, startTransition] = useTransition();
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploadingRowIndex, setUploadingRowIndex] = useState<number | null>(
    null,
  );
  const [currentPublicationId, setCurrentPublicationId] = useState<
    string | null
  >(publicationId);
  const [funnelName, setFunnelName] = useState("");
  const [selectedDomainId, setSelectedDomainId] = useState(
    activeDomains[0]?.id ?? "",
  );
  const [pathPrefix, setPathPrefix] = useState("/");
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    templateOptions[0]?.id ?? "",
  );
  const [selectedThemeId, setSelectedThemeId] = useState("default");
  const [seoTitle, setSeoTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [blocksText, setBlocksText] = useState(defaultBlocksSeed);
  const [mediaRows, setMediaRows] = useState<MediaRow[]>([...defaultMediaRows]);
  const [stepRecords, setStepRecords] = useState<HybridPublicationStepDetail[]>([]);
  const [stepDrafts, setStepDrafts] = useState<Record<string, StepDraft>>({});
  const [fallbackDrafts, setFallbackDrafts] = useState<
    Record<EditorStepTabKey, StepDraft>
  >({
    captura: createEmptyStepDraft(),
    confirmado: createEmptyStepDraft(),
  });
  const [activeStepTab, setActiveStepTab] = useState<EditorStepTabKey>("captura");
  const mediaUploadInputRef = useRef<HTMLInputElement | null>(null);
  const pendingMediaUploadIndexRef = useRef<number | null>(null);
  const visibleTemplateOptions = useMemo(
    () => ensureSelectedTemplateOption(templateOptions, selectedTemplateId),
    [selectedTemplateId, templateOptions],
  );

  const publicationApiBasePath =
    mode === "system" && teamId
      ? `/system/tenants/${encodeURIComponent(teamId)}/hybrid-funnel-publications`
      : "/hybrid-funnel-publications";

  useEffect(() => {
    if (!publicationId) {
      setCurrentPublicationId(null);
      setStepRecords([]);
      setStepDrafts({});
      return;
    }

    setIsLoadingExisting(true);
    setErrorMessage(null);

    void teamOperationRequest<HybridPublicationDetail>(
      `${publicationApiBasePath}/${publicationId}`,
      { method: "GET" },
    )
      .then((payload) => {
        const nextStepRecords = normalizeStepRecords(payload.steps, payload.step);
        setCurrentPublicationId(payload.publication.id);
        setFunnelName(payload.funnelInstance.name);
        setSelectedDomainId(payload.publication.domainId);
        setPathPrefix(payload.publication.pathPrefix);
        setSelectedTemplateId(payload.funnelInstance.templateId);
        setSelectedThemeId(extractThemeFromSettings(payload.funnelInstance.settingsJson));
        setSeoTitle(payload.seo.title);
        setMetaDescription(payload.seo.metaDescription);
        setBlocksText(JSON.stringify(payload.step.blocksJson, null, 2));
        setMediaRows(toMediaRows(payload.step.mediaMap));
        setStepRecords(nextStepRecords);
        setStepDrafts(buildStepDraftMap(nextStepRecords));
      })
      .catch((error) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos cargar la publicación híbrida.",
        );
      })
      .finally(() => setIsLoadingExisting(false));
  }, [publicationApiBasePath, publicationId]);

  const showStepSwitcher = mode === "system" && Boolean(currentPublicationId);

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
        step: definition.key === "captura" ? captureStep : confirmStep,
      })),
    [captureStep, confirmStep],
  );
  const activeStep = showStepSwitcher
    ? stepTabs.find((tab) => tab.key === activeStepTab)?.step ?? null
    : null;
  const activeStepTabLabel =
    stepTabs.find((tab) => tab.key === activeStepTab)?.label ??
    "Paso activo";
  const activeDraft = showStepSwitcher
    ? activeStep
      ? stepDrafts[activeStep.id] ?? buildStepDraft(activeStep)
      : fallbackDrafts[activeStepTab] ?? createEmptyStepDraft()
    : null;
  const editorBlocksText = activeDraft?.blocksText ?? blocksText;
  const editorMediaRows = activeDraft?.mediaRows ?? mediaRows;
  const editorContext = showStepSwitcher
    ? {
        stepName: activeStepTabLabel,
        stepPath: activeStep
          ? buildPublicationStepPath(
              pathPrefix,
              activeStep.slug,
              activeStep.isEntryStep,
            )
          : activeStepTab === "captura"
            ? normalizePublicationPath(pathPrefix)
            : buildPublicationStepPath(pathPrefix, "confirmado", false),
      }
    : null;
  const previewDraftKey =
    mode === "system"
      ? buildHybridJsonPreviewDraftKey(
          currentPublicationId ?? `system-${teamId ?? "draft"}`,
          activeStep?.id ?? activeStepTab,
        )
      : null;

  const updateEditorDraft = (patch: Partial<StepDraft>) => {
    if (!showStepSwitcher) {
      if (patch.blocksText !== undefined) {
        setBlocksText(patch.blocksText);
      }

      if (patch.mediaRows !== undefined) {
        setMediaRows(patch.mediaRows);
      }

      return;
    }

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

  useEffect(() => {
    if (selectedTemplateId || templateOptions.length === 0) {
      return;
    }

    setSelectedTemplateId(templateOptions[0].id);
  }, [selectedTemplateId, templateOptions]);

  useEffect(() => {
    if (selectedDomainId || activeDomains.length === 0) {
      return;
    }

    setSelectedDomainId(activeDomains[0].id);
  }, [activeDomains, selectedDomainId]);

  const parsedBlocks = useMemo(() => {
    try {
      const value = JSON.parse(editorBlocksText) as unknown;
      if (!Array.isArray(value)) {
        return {
          value: null,
          error: "El blocksJson debe ser un JSON Array válido.",
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
  }, [editorBlocksText]);

  const mediaMap = useMemo(() => {
    return editorMediaRows.reduce<Record<string, string>>((accumulator, row) => {
      const key = row.key.trim();
      const value = row.value.trim();
      if (!key || !value) {
        return accumulator;
      }

      accumulator[key] = value;
      return accumulator;
    }, {});
  }, [editorMediaRows]);

  const mediaValidation = useMemo(() => {
    const keySet = new Set<string>();
    for (const row of editorMediaRows) {
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
  }, [editorMediaRows]);

  const isSaveDisabled =
    isPending ||
    isLoadingExisting ||
    uploadingRowIndex !== null ||
    !funnelName.trim() ||
    !selectedDomainId ||
    !selectedTemplateId ||
    !pathPrefix.trim() ||
    Boolean(parsedBlocks.error) ||
    Boolean(mediaValidation);

  const selectedDomain = activeDomains.find(
    (domain) => domain.id === selectedDomainId,
  );
  const selectedTemplate = visibleTemplateOptions.find(
    (template) => template.id === selectedTemplateId,
  );
  const routingReference = useMemo(() => {
    if (!showStepSwitcher || stepRecords.length === 0) {
      return null;
    }

    const captureStepId = captureStep?.id ?? null;
    const confirmStepId = confirmStep?.id ?? null;

    return {
      title: "Enrutamiento del Embudo (Referencia)",
      helperText:
        "Usa estas rutas relativas al configurar success_redirect dentro del JSON del modal de captura.",
      items: stepRecords
        .slice()
        .sort((left, right) => left.position - right.position)
        .map((step) => ({
          id: step.id,
          label: toStepReferenceLabel(step, captureStepId, confirmStepId),
          path: buildPublicationStepPath(pathPrefix, step.slug, step.isEntryStep),
          badge: step.isEntryStep ? "Entrada" : step.slug,
        })),
    };
  }, [captureStep, confirmStep, pathPrefix, showStepSwitcher, stepRecords]);

  const handleMediaRowChange = (index: number, patch: Partial<MediaRow>) => {
    updateEditorDraft({
      mediaRows: editorMediaRows.map((row, rowIndex) =>
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
    updateEditorDraft({
      mediaRows: [...editorMediaRows, { key, value: "" }],
    });
  };

  const handleUploadMediaClick = (index: number) => {
    pendingMediaUploadIndexRef.current = index;
    mediaUploadInputRef.current?.click();
  };

  const handleMediaUploadChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
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

    const rowKey =
      editorMediaRows[targetIndex]?.key.trim() || `media_${targetIndex + 1}`;

    setErrorMessage(null);
    setSuccessMessage(null);
    setUploadingRowIndex(targetIndex);

    try {
      const optimizedFile = await optimizeFunnelAssetImage(file);
      const publicUrl = await uploadFileWithPresignedUrl(
        optimizedFile,
        "funnels",
        {
          teamId: mode === "system" ? teamId : undefined,
        },
      );
      handleMediaRowChange(targetIndex, { value: publicUrl });
      setSuccessMessage(`Imagen subida al CDN para ${rowKey}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No pudimos subir la imagen al CDN.",
      );
    } finally {
      pendingMediaUploadIndexRef.current = null;
      setUploadingRowIndex(null);
    }
  };

  const handleSave = () => {
    if (!parsedBlocks.value) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const payload = {
          name: funnelName.trim(),
          domainId: selectedDomainId,
          pathPrefix: pathPrefix.trim(),
          templateId: selectedTemplateId,
          theme: selectedThemeId,
          seoTitle: seoTitle.trim(),
          metaDescription: metaDescription.trim(),
          stepId: activeStep?.id,
          stepKey: showStepSwitcher ? activeStepTab : undefined,
          blocksJson: parsedBlocks.value,
          mediaMap,
        };

        if (!currentPublicationId && mode === "system") {
          throw new Error(
            "Este builder de admin solo puede abrir publicaciones híbridas existentes.",
          );
        }

        const response =
          currentPublicationId || mode === "system"
            ? await teamOperationRequest<HybridPublicationDetail>(
                `${publicationApiBasePath}/${currentPublicationId}`,
                {
                  method: "PATCH",
                  body: JSON.stringify(payload),
                },
              )
            : await teamOperationRequest<HybridPublicationDetail>(
                publicationApiBasePath,
                {
                  method: "POST",
                  body: JSON.stringify(payload),
                },
              );

        setCurrentPublicationId(response.publication.id);
        const nextStepRecords = normalizeStepRecords(response.steps, response.step);
        setSelectedThemeId(
          extractThemeFromSettings(response.funnelInstance.settingsJson),
        );
        setBlocksText(JSON.stringify(response.step.blocksJson, null, 2));
        setMediaRows(toMediaRows(response.step.mediaMap));
        setStepRecords(nextStepRecords);
        setStepDrafts(buildStepDraftMap(nextStepRecords));
        setSuccessMessage(
          currentPublicationId
            ? showStepSwitcher
              ? `${
                  stepTabs.find((tab) => tab.key === activeStepTab)?.label ?? "Paso"
                } actualizado y publicado.`
              : "Funnel híbrido actualizado y publicado."
            : "Funnel híbrido creado, publicado y listo para edición.",
        );
        if (editorHref) {
          router.replace(editorHref);
          router.refresh();
          return;
        }

        router.replace(
          `/team/publications/new-vsl?publicationId=${response.publication.id}`,
        );
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos guardar el funnel híbrido.",
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={headerEyebrow}
        title={headerTitle}
        description={headerDescription}
        actions={
          <>
            <Link href={backHref} className={secondaryButtonClassName}>
              {backLabel}
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaveDisabled}
              className={primaryButtonClassName}
            >
              <Save className="h-4 w-4" />
              {currentPublicationId ? "Guardar cambios" : "Crear y publicar"}
            </button>
          </>
        }
      />

      {errorMessage ? (
        <OperationBanner tone="error" message={errorMessage} />
      ) : null}
      {successMessage ? (
        <OperationBanner tone="success" message={successMessage} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <article className={sectionClassName}>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-teal-100 p-2 text-teal-700">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Template activo
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                {selectedTemplate?.name ?? "Selecciona un template"}
              </p>
            </div>
          </div>
        </article>
        <article className={sectionClassName}>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <FileJson className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Bloques válidos
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                {parsedBlocks.value
                  ? `${parsedBlocks.value.length} bloques listos`
                  : "Corrige el JSON"}
              </p>
            </div>
          </div>
        </article>
        <article className={sectionClassName}>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-sky-100 p-2 text-sky-700">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                {showStepSwitcher ? "Paso activo" : "Publicación"}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                {showStepSwitcher
                  ? stepTabs.find((tab) => tab.key === activeStepTab)?.label ??
                    "Paso activo"
                  : selectedDomain
                    ? `${selectedDomain.host}${pathPrefix}`
                    : "Selecciona dominio y ruta"}
              </p>
            </div>
          </div>
        </article>
      </section>

      <details open className={sectionClassName}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Configuración
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Header y metadata del funnel
            </h2>
          </div>
          <ChevronDown className="h-5 w-5 text-slate-400" />
        </summary>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-900">
              Nombre del funnel
            </span>
            <input
              value={funnelName}
              onChange={(event) => setFunnelName(event.target.value)}
              placeholder="Dragon Vintage T9 - Jakawi Import"
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
            />
            <span className="text-xs leading-5 text-slate-500">
              Código interno sugerido:{" "}
              {slugify(funnelName || "nuevo-funnel") || "nuevo-funnel"}
            </span>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-900">
              Dominio activo
            </span>
            <select
              value={selectedDomainId}
              onChange={(event) => setSelectedDomainId(event.target.value)}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
            >
              {activeDomains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.host}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-900">Ruta</span>
            <input
              value={pathPrefix}
              onChange={(event) => setPathPrefix(event.target.value)}
              placeholder="/"
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-900">
              Template base
            </span>
            <select
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
            >
              <option value="">Selecciona un template</option>
              {visibleTemplateOptions.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-900">
              Funnel Theme
            </span>
            <select
              value={selectedThemeId}
              onChange={(event) => setSelectedThemeId(event.target.value)}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
            >
              {availableFunnelThemes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.name}
                </option>
              ))}
            </select>
            <span className="text-xs leading-5 text-slate-500">
              Este theme se guarda a nivel Funnel y el runtime público lo expone
              en la raíz del payload.
            </span>
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-900">
              SEO Title
            </span>
            <input
              value={seoTitle}
              onChange={(event) => setSeoTitle(event.target.value)}
              placeholder={funnelName || "Dragon Vintage T9 | Leadflow"}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
            />
            <span className="text-xs leading-5 text-slate-500">
              Si lo dejas vacío, usamos automáticamente el nombre del funnel.
            </span>
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-900">
              Meta Description
            </span>
            <textarea
              value={metaDescription}
              onChange={(event) => setMetaDescription(event.target.value)}
              placeholder="Resumen comercial y beneficio principal de la landing para buscadores y shares."
              rows={4}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
            />
            <span className="text-xs leading-5 text-slate-500">
              Recomendado: 140-160 caracteres orientados al beneficio principal.
            </span>
          </label>
        </div>
      </details>

      <HybridJsonMediaEditor
        key={activeStep?.id ?? activeStepTab}
        blocksText={editorBlocksText}
        previewDraftKey={previewDraftKey}
        editorContext={editorContext}
        onBlocksTextChange={(value) => updateEditorDraft({ blocksText: value })}
        parsedBlocksError={parsedBlocks.error}
        parsedBlocksCount={parsedBlocks.value?.length ?? 0}
        mediaRows={editorMediaRows}
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
          updateEditorDraft({
            mediaRows: editorMediaRows.filter((_, rowIndex) => rowIndex !== index),
          })
        }
        previewTheme={selectedThemeId}
        availableBlocks={availableBlocks}
        routingReference={routingReference}
        stepSwitcher={
          showStepSwitcher
            ? {
                activeKey: activeStepTab,
                badge: activeStep?.slug ?? activeStepTab,
                disabled: isPending || uploadingRowIndex !== null,
                helperText:
                  "Cada pestaña carga y guarda el JSON del FunnelStep activo del builder real.",
                tabs: stepTabs.map((tab) => ({
                  key: tab.key,
                  label: tab.label,
                })),
                warningText: !activeStep
                  ? "Ese paso todavía no existe en la publicación. Puedes prepararlo aquí y al guardar lo crearemos."
                  : null,
                onChange: (key) => {
                  setErrorMessage(null);
                  setSuccessMessage(null);
                  setActiveStepTab(key as EditorStepTabKey);
                },
              }
            : null
        }
      />

      <section className={sectionClassName}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Persistencia
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Guardado atómico listo
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              El submit crea o actualiza la FunnelInstance, el FunnelStep activo
              y la FunnelPublication en una transacción, dejando todos los
              estados en `active`.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaveDisabled}
            className={primaryButtonClassName}
          >
            {isPending ? (
              <>Guardando...</>
            ) : (
              <>
                <Check className="h-4 w-4" />
                {currentPublicationId ? "Guardar cambios" : "Crear y publicar"}
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
