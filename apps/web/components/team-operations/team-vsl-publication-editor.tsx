"use client";

import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  CircleHelp,
  FileJson,
  Globe,
  Sparkles,
} from "lucide-react";
import {
  readyMadeFunnelRecipes,
  SmartWiringService,
} from "../../../../packages/shared/funnel-orchestrator/src";

import { ZenModeShell } from "@/components/app-shell/ZenModeShell";
import { StepManagerSidebar } from "@/components/admin/funnel-builder/StepManagerSidebar";
import type { FlowGraphV1 } from "../../../../packages/shared/funnel-lint/src";
import type { PublicationTrackingFieldName } from "@/components/forms/publication-tracking-fields";
import { PublicationInspectorDrawer } from "@/components/team-operations/PublicationInspectorDrawer";
import {
  defaultBlocksSeed,
  HybridJsonMediaEditor,
  requiredMediaKeys,
  type MediaRow,
  toMediaRows,
} from "@/components/team-operations/hybrid-json-media-editor";
import type { ComposerDestination } from "@/components/team-operations/BlockCard";
import { buildHybridJsonPreviewDraftKey } from "@/components/team-operations/hybrid-json-preview-state";
import type { BuilderBlockDefinition } from "@/lib/blocks/catalog";
import { optimizeFunnelAssetImage } from "@/lib/media-optimizer";
import {
  mergeStepLayoutOverride,
  readStepLayoutOverride,
  type StepLayoutOverrideValue,
} from "@/lib/public-step-layout";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { availableFunnelThemes, resolveFunnelThemeId } from "@/lib/funnel-theme-registry";
import { webPublicConfig } from "@/lib/public-env";
import { uploadFileWithPresignedUrl } from "@/lib/storage";
import { teamOperationRequest } from "@/lib/team-operations";
import {
  type PublicationLintIssue,
  type PublicationRuntimeHealthStatus,
  usePublicationStore,
} from "@/store/usePublicationStore";

const sectionClassName =
  "rounded-[2rem] border border-slate-200 bg-white/90 p-6 text-left text-slate-900 shadow-xl shadow-slate-200/50 md:p-8 dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-100 dark:shadow-slate-950/30";

const fieldLabelClassName = "text-sm font-medium text-slate-700 dark:text-slate-300";

const inputClassName =
  "rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-900/70 dark:disabled:text-slate-500";

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
    metaPixelId: string | null;
    tiktokPixelId: string | null;
    metaCapiToken: string | null;
    tiktokAccessToken: string | null;
    status: string;
    isPrimary: boolean;
  };
  funnelInstance: {
    id: string;
    templateId: string;
    name: string;
    code: string;
    status: string;
    conversionContract: unknown;
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

type ExecuteOrchestrationApiResponse = {
  status: number;
  sessionId: string;
  runtimeContext: {
    tenant?: {
      id?: string;
      code?: string;
    };
    member?: {
      id?: string;
    };
  } | null;
  data: unknown;
};

type InitOrchestrationSessionApiResponse = {
  status: number;
  sessionId: string;
  runtimeContext: {
    tenant?: {
      id?: string;
      code?: string;
    };
    member?: {
      id?: string;
    };
  } | null;
  data: unknown;
};

type FunnelStepHistoryVersion = {
  id: string;
  stepId: string;
  blocksJson: unknown;
  settingsJson: unknown;
  createdAt: string;
  createdBy: string | null;
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

const readNestedValue = (value: unknown, path: string[]) => {
  let current: unknown = value;

  for (const key of path) {
    const record = asRecord(current);
    if (!record || !(key in record)) {
      return undefined;
    }

    current = record[key];
  }

  return current;
};

const extractOrchestrationBlocks = (value: unknown) => {
  const candidates = [
    readNestedValue(value, ["blocks"]),
    readNestedValue(value, ["blocks_json"]),
    readNestedValue(value, ["output", "blocks"]),
    readNestedValue(value, ["output", "blocks_json"]),
    readNestedValue(value, ["result", "blocks"]),
    readNestedValue(value, ["result", "blocks_json"]),
    readNestedValue(value, ["funnel_context", "blocks"]),
    readNestedValue(value, ["funnel_context", "blocks_json"]),
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return null;
};

const extractOrchestrationMediaMap = (value: unknown) => {
  const candidates = [
    readNestedValue(value, ["media_map"]),
    readNestedValue(value, ["output", "media_map"]),
    readNestedValue(value, ["result", "media_map"]),
    readNestedValue(value, ["funnel_context", "media_map"]),
  ];

  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (record) {
      return record;
    }
  }

  return null;
};

const extractOrchestrationSettings = (value: unknown) => {
  const candidates = [
    readNestedValue(value, ["settings_json"]),
    readNestedValue(value, ["output", "settings_json"]),
    readNestedValue(value, ["result", "settings_json"]),
    readNestedValue(value, ["funnel_context", "settings_json"]),
  ];

  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (record) {
      return record;
    }
  }

  return null;
};

const extractOrchestrationRecipeKey = (value: unknown) => {
  const candidates = [
    readNestedValue(value, ["recipe_key"]),
    readNestedValue(value, ["recipeKey"]),
    readNestedValue(value, ["output", "recipe_key"]),
    readNestedValue(value, ["output", "recipeKey"]),
    readNestedValue(value, ["result", "recipe_key"]),
    readNestedValue(value, ["result", "recipeKey"]),
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
};

const extractOrchestrationReplace = (value: unknown) => {
  const candidates = [
    readNestedValue(value, ["replace"]),
    readNestedValue(value, ["output", "replace"]),
    readNestedValue(value, ["result", "replace"]),
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "boolean") {
      return candidate;
    }
  }

  return false;
};

const extractFlowGraphFromContract = (value: unknown): FlowGraphV1 | null => {
  const contract = asRecord(value);
  const flowGraph = asRecord(contract?.flowGraph);
  const nodes = asRecord(flowGraph?.nodes);

  if (!flowGraph || !nodes || flowGraph.version !== 1) {
    return null;
  }

  return flowGraph as unknown as FlowGraphV1;
};

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

type StepManagerActiveStepEvent = CustomEvent<{
  stepId?: string;
  orderIndex?: number;
  node?: {
    stepId?: string;
    slug?: string;
    stepType?: string;
  };
}>;

const syncStepRecordsWithGraph = (
  steps: HybridPublicationStepDetail[],
  graph: FlowGraphV1 | null,
) => {
  if (!graph || steps.length === 0) {
    return steps;
  }

  return steps.map((step) => {
    const node = graph.nodes[step.id];

    if (!node || node.slug === step.slug) {
      return step;
    }

    return {
      ...step,
      slug: node.slug,
    };
  });
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
  headerTitle = "Crear o editar funnel VSL/Landing",
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
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [orchestrationSessionId, setOrchestrationSessionId] = useState<
    string | null
  >(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploadingRowIndex, setUploadingRowIndex] = useState<number | null>(
    null,
  );
  const [currentPublicationId, setCurrentPublicationId] = useState<
    string | null
  >(publicationId);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [funnelName, setFunnelName] = useState("");
  const [selectedDomainId, setSelectedDomainId] = useState(
    activeDomains[0]?.id ?? "",
  );
  const [pathPrefix, setPathPrefix] = useState("/");
  const [metaPixelId, setMetaPixelId] = useState("");
  const [tiktokPixelId, setTiktokPixelId] = useState("");
  const [metaCapiToken, setMetaCapiToken] = useState("");
  const [tiktokAccessToken, setTiktokAccessToken] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    templateOptions[0]?.id ?? "",
  );
  const [selectedThemeId, setSelectedThemeId] = useState("default");
  const [funnelInstanceId, setFunnelInstanceId] = useState<string | null>(null);
  const [flowGraph, setFlowGraph] = useState<FlowGraphV1 | null>(null);
  const [seoTitle, setSeoTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [blocksText, setBlocksText] = useState(defaultBlocksSeed);
  const [mediaRows, setMediaRows] = useState<MediaRow[]>([...defaultMediaRows]);
  const [stepSettingsJson, setStepSettingsJson] = useState<unknown>({});
  const [stepRecords, setStepRecords] = useState<HybridPublicationStepDetail[]>([]);
  const [stepDrafts, setStepDrafts] = useState<Record<string, StepDraft>>({});
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [activeStepTab, setActiveStepTab] = useState<EditorStepTabKey>("captura");
  const mediaUploadInputRef = useRef<HTMLInputElement | null>(null);
  const pendingMediaUploadIndexRef = useRef<number | null>(null);
  const visibleTemplateOptions = useMemo(
    () => ensureSelectedTemplateOption(templateOptions, selectedTemplateId),
    [selectedTemplateId, templateOptions],
  );
  const setPublicationIdInStore = usePublicationStore(
    (state) => state.setPublicationId,
  );
  const setBlocksTextInStore = usePublicationStore(
    (state) => state.setBlocksText,
  );
  const setRuntimeHealthStatusInStore = usePublicationStore(
    (state) => state.setRuntimeHealthStatus,
  );
  const setLintIssuesInStore = usePublicationStore(
    (state) => state.setLintIssues,
  );
  const runtimeHealthStatus = usePublicationStore(
    (state) => state.runtimeHealthStatus,
  );

  const publicationApiBasePath =
    mode === "system" && teamId
      ? `/system/tenants/${encodeURIComponent(teamId)}/hybrid-funnel-publications`
      : "/hybrid-funnel-publications";

  useEffect(() => {
    if (!publicationId) {
      setOrchestrationSessionId(null);
      setCurrentPublicationId(null);
      setFunnelInstanceId(null);
      setFlowGraph(null);
      setStepRecords([]);
      setStepDrafts({});
      setStepSettingsJson({});
      setMetaPixelId("");
      setTiktokPixelId("");
      setMetaCapiToken("");
      setTiktokAccessToken("");
      return;
    }

    setIsLoadingExisting(true);
    setErrorMessage(null);

    void teamOperationRequest<HybridPublicationDetail>(
      `${publicationApiBasePath}/${publicationId}`,
      { method: "GET" },
    )
      .then((payload) => {
        setOrchestrationSessionId(null);
        const nextStepRecords = normalizeStepRecords(payload.steps, payload.step);
        setCurrentPublicationId(payload.publication.id);
        setFunnelInstanceId(payload.publication.funnelInstanceId);
        setFunnelName(payload.funnelInstance.name);
        setSelectedDomainId(payload.publication.domainId);
        setPathPrefix(payload.publication.pathPrefix);
        setMetaPixelId(payload.publication.metaPixelId ?? "");
        setTiktokPixelId(payload.publication.tiktokPixelId ?? "");
        setMetaCapiToken(payload.publication.metaCapiToken ?? "");
        setTiktokAccessToken(payload.publication.tiktokAccessToken ?? "");
        setSelectedTemplateId(payload.funnelInstance.templateId);
        setSelectedThemeId(extractThemeFromSettings(payload.funnelInstance.settingsJson));
        setSeoTitle(payload.seo.title);
        setMetaDescription(payload.seo.metaDescription);
        setBlocksText(JSON.stringify(payload.step.blocksJson, null, 2));
        setMediaRows(toMediaRows(payload.step.mediaMap));
        setStepSettingsJson(payload.step.settingsJson);
        setStepRecords(nextStepRecords);
        setStepDrafts(buildStepDraftMap(nextStepRecords));
        setFlowGraph(
          extractFlowGraphFromContract(payload.funnelInstance.conversionContract),
        );
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

  const showStepSwitcher = Boolean(currentPublicationId) && stepRecords.length > 1;

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
  const editorSettingsJson = activeDraft?.settingsJson ?? stepSettingsJson;
  const editorLayoutOverride = readStepLayoutOverride(editorSettingsJson);
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
        stepType: activeStep?.stepType ?? activeStepTab,
      }
    : null;
  const previewDraftKey =
    mode === "system"
      ? buildHybridJsonPreviewDraftKey(
          currentPublicationId ?? `system-${teamId ?? "draft"}`,
          activeStep?.id ?? activeStepTab,
        )
      : null;
  const activeStepHistoryTitle = activeStep
    ? `${activeStepTabLabel} (${activeStep.slug})`
    : activeStepTabLabel;

  useEffect(() => {
    const handleStepManagerChange = (event: Event) => {
      if (!showStepSwitcher) {
        return;
      }

      const detail = (event as StepManagerActiveStepEvent).detail ?? {};
      const candidateIds = new Set(
        [detail.stepId, detail.node?.stepId, detail.node?.slug]
          .filter((value): value is string => Boolean(value))
          .map((value) => value.trim()),
      );

      const directMatch = stepTabs.find(
        (tab) =>
          tab.step &&
          (candidateIds.has(tab.step.id) || candidateIds.has(tab.step.slug)),
      );
      const orderedFallback =
        typeof detail.orderIndex === "number" ? stepTabs[detail.orderIndex] : null;
      const targetTab = directMatch ?? (orderedFallback?.step ? orderedFallback : null);

      if (!targetTab || targetTab.key === activeStepTab) {
        return;
      }

      setErrorMessage(null);
      setSuccessMessage(null);
      setActiveStepTab(targetTab.key);
    };

    window.addEventListener(
      "leadflow:step-manager:active-step-change",
      handleStepManagerChange,
    );

    return () => {
      window.removeEventListener(
        "leadflow:step-manager:active-step-change",
        handleStepManagerChange,
      );
    };
  }, [activeStepTab, showStepSwitcher, stepTabs]);

  const updateEditorDraft = (patch: Partial<StepDraft>) => {
    if (!showStepSwitcher) {
      if (patch.blocksText !== undefined) {
        setBlocksText(patch.blocksText);
      }

      if (patch.mediaRows !== undefined) {
        setMediaRows(patch.mediaRows);
      }

      if (patch.settingsJson !== undefined) {
        setStepSettingsJson(patch.settingsJson);
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

  useEffect(() => {
    setIsHistoryOpen(false);
    setIsHistoryLoading(false);
    setHistoryErrorMessage(null);
    setHistoryVersions([]);
  }, [activeStep?.id, currentPublicationId]);

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

  const lintIssues = useMemo<PublicationLintIssue[]>(() => {
    const issues: PublicationLintIssue[] = [];

    if (parsedBlocks.error) {
      issues.push({
        code: "BLOCKS_JSON_INVALID",
        severity: "error",
        message: parsedBlocks.error,
      });
    }

    if (mediaValidation) {
      issues.push({
        code: "MEDIA_MAP_INVALID",
        severity: "error",
        message: mediaValidation,
      });
    }

    return issues;
  }, [mediaValidation, parsedBlocks.error]);

  const derivedRuntimeHealthStatus = useMemo<PublicationRuntimeHealthStatus>(() => {
    if (lintIssues.some((issue) => issue.severity === "error")) {
      return "broken";
    }

    if (!parsedBlocks.value) {
      return "warning";
    }

    return "healthy";
  }, [lintIssues, parsedBlocks.value]);

  const draftStorageId =
    currentPublicationId ??
    publicationId ??
    `${mode}-${teamId ?? "local"}-new-vsl`;

  useEffect(() => {
    setPublicationIdInStore(draftStorageId);
    setBlocksTextInStore(editorBlocksText);
    setRuntimeHealthStatusInStore(derivedRuntimeHealthStatus);
    setLintIssuesInStore(lintIssues);
  }, [
    derivedRuntimeHealthStatus,
    draftStorageId,
    editorBlocksText,
    lintIssues,
    setBlocksTextInStore,
    setLintIssuesInStore,
    setPublicationIdInStore,
    setRuntimeHealthStatusInStore,
  ]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `leadflow_draft_${draftStorageId}`,
        JSON.stringify({
          activeStep: activeStep?.id ?? activeStepTab,
          blocksText: editorBlocksText,
          runtimeHealthStatus: derivedRuntimeHealthStatus,
          lintIssues,
          updatedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // Draft persistence is best-effort; save/publish remains the source of truth.
    }
  }, [
    activeStep?.id,
    activeStepTab,
    derivedRuntimeHealthStatus,
    draftStorageId,
    editorBlocksText,
    lintIssues,
  ]);

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
  const graphDestinations = useMemo<ComposerDestination[]>(() => {
    if (!flowGraph) {
      return [];
    }

    return Object.entries(flowGraph.nodes).map(([nodeId, node]) => ({
      value: buildPublicationStepPath(
        pathPrefix,
        node.slug,
        node.stepId === flowGraph.entryStepId,
      ),
      label: `FlowGraph: ${node.meta?.title ?? node.slug}`,
      kind: "route",
    }));
  }, [flowGraph, pathPrefix]);

  useEffect(() => {
    if (!orchestrationSessionId) {
      return;
    }

    return () => {
      void fetch(`${webPublicConfig.urls.api}/v1/runtime/session/close`, {
        method: "POST",
        body: JSON.stringify({
          session_id: orchestrationSessionId,
        }),
        credentials: "include",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
        },
      }).catch(() => {
        // Session cleanup on unload is best-effort.
      });
    };
  }, [orchestrationSessionId]);

  const orchestrationFunnelContext = useMemo(() => {
    if (!parsedBlocks.value) {
      return null;
    }

    const successRedirect = confirmStep
      ? buildPublicationStepPath(
          pathPrefix,
          confirmStep.slug,
          confirmStep.isEntryStep,
        )
      : "/confirmado";

    return {
      publication: {
        id: currentPublicationId,
        funnelInstanceId,
        pathPrefix,
        domainId: selectedDomainId,
        seoTitle,
        metaDescription,
      },
      funnel: {
        id: funnelInstanceId,
        name: funnelName,
        templateId: selectedTemplateId,
        themeId: selectedThemeId,
      },
      activeStep: {
        id: activeStep?.id ?? null,
        slug: activeStep?.slug ?? captureStep?.slug ?? "captura",
        stepType: activeStep?.stepType ?? captureStep?.stepType ?? "landing",
        label: activeStepTabLabel,
        path: editorContext?.stepPath ?? normalizePublicationPath(pathPrefix),
      },
      graph: flowGraph,
      stepRecords,
      blocks: parsedBlocks.value,
      mediaMap,
      settingsJson: editorSettingsJson,
      successRedirect,
    };
  }, [
    activeStep?.id,
    activeStep?.slug,
    activeStep?.stepType,
    activeStepTabLabel,
    captureStep?.slug,
    captureStep?.stepType,
    confirmStep?.id,
    confirmStep?.isEntryStep,
    confirmStep?.slug,
    currentPublicationId,
    editorContext?.stepPath,
    editorSettingsJson,
    flowGraph,
    funnelInstanceId,
    funnelName,
    mediaMap,
    metaDescription,
    parsedBlocks.value,
    pathPrefix,
    selectedDomainId,
    selectedTemplateId,
    selectedThemeId,
    seoTitle,
    stepRecords,
  ]);

  const initializeOrchestrationSession = async () => {
    if (!currentPublicationId || !funnelInstanceId || !orchestrationFunnelContext) {
      throw new Error("Guarda o carga una publicación antes de inicializar Smart Wiring.");
    }

    const response = await teamOperationRequest<InitOrchestrationSessionApiResponse>(
      "/runtime/session/init",
      {
        method: "POST",
        body: JSON.stringify({
          funnel_id: funnelInstanceId,
          funnel_context: orchestrationFunnelContext,
          metadata: {
            publication_id: currentPublicationId,
            funnel_instance_id: funnelInstanceId,
            editor_mode: mode,
            active_step_id: activeStep?.id ?? null,
          },
        }),
      },
    );

    setOrchestrationSessionId(response.sessionId);
    return response.sessionId;
  };

  useEffect(() => {
    if (
      orchestrationSessionId ||
      !currentPublicationId ||
      !funnelInstanceId ||
      !orchestrationFunnelContext
    ) {
      return;
    }

    void teamOperationRequest<InitOrchestrationSessionApiResponse>(
      "/runtime/session/init",
      {
        method: "POST",
        body: JSON.stringify({
          funnel_id: funnelInstanceId,
          funnel_context: orchestrationFunnelContext,
          metadata: {
            publication_id: currentPublicationId,
            funnel_instance_id: funnelInstanceId,
            editor_mode: mode,
            active_step_id: activeStep?.id ?? null,
          },
        }),
      },
    )
      .then((response) => {
        setOrchestrationSessionId(response.sessionId);
      })
      .catch(() => {
        // Warm-up is best-effort; Smart Wiring retries the handshake before execute.
      });
  }, [
    activeStep?.id,
    currentPublicationId,
    funnelInstanceId,
    mode,
    orchestrationFunnelContext,
    orchestrationSessionId,
  ]);

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

  const handleOpenHistory = () => {
    if (!currentPublicationId || !activeStep) {
      return;
    }

    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    setHistoryErrorMessage(null);

    void teamOperationRequest<FunnelStepHistoryVersion[]>(
      `${publicationApiBasePath}/${currentPublicationId}/steps/${activeStep.id}/history`,
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

    updateEditorDraft({
      blocksText: toBlocksText(version.blocksJson),
      settingsJson: version.settingsJson,
    });
    setIsHistoryOpen(false);
    setSuccessMessage(
      `Versión previa cargada en el borrador de ${
        activeStepTabLabel.toLowerCase()
      }. Revisa el JSON y guarda cuando estés listo.`,
    );
    setErrorMessage(null);
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
          metaPixelId: metaPixelId.trim() || null,
          tiktokPixelId: tiktokPixelId.trim() || null,
          metaCapiToken: metaCapiToken.trim() || null,
          tiktokAccessToken: tiktokAccessToken.trim() || null,
          templateId: selectedTemplateId,
          theme: selectedThemeId,
          seoTitle: seoTitle.trim(),
          metaDescription: metaDescription.trim(),
          stepId: activeStep?.id,
          stepKey: showStepSwitcher ? activeStepTab : undefined,
          blocksJson: parsedBlocks.value,
          mediaMap,
          settingsJson: editorSettingsJson,
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
        setMetaPixelId(response.publication.metaPixelId ?? "");
        setTiktokPixelId(response.publication.tiktokPixelId ?? "");
        setMetaCapiToken(response.publication.metaCapiToken ?? "");
        setTiktokAccessToken(response.publication.tiktokAccessToken ?? "");
        const nextStepRecords = normalizeStepRecords(response.steps, response.step);
        setOrchestrationSessionId(null);
        setFunnelInstanceId(response.publication.funnelInstanceId);
        setSelectedThemeId(
          extractThemeFromSettings(response.funnelInstance.settingsJson),
        );
        setBlocksText(JSON.stringify(response.step.blocksJson, null, 2));
        setMediaRows(toMediaRows(response.step.mediaMap));
        setStepSettingsJson(response.step.settingsJson);
        setStepRecords(nextStepRecords);
        setStepDrafts(buildStepDraftMap(nextStepRecords));
        setFlowGraph(
          extractFlowGraphFromContract(response.funnelInstance.conversionContract),
        );
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

  const updateTrackingField = (
    field: PublicationTrackingFieldName,
    value: string,
  ) => {
    switch (field) {
      case "metaPixelId":
        setMetaPixelId(value);
        return;
      case "tiktokPixelId":
        setTiktokPixelId(value);
        return;
      case "metaCapiToken":
        setMetaCapiToken(value);
        return;
      case "tiktokAccessToken":
        setTiktokAccessToken(value);
        return;
    }
  };

  const handleGraphUpdated = (graph: FlowGraphV1) => {
    setFlowGraph(graph);
    setStepRecords((current) => {
      const nextRecords = syncStepRecordsWithGraph(current, graph);
      const nextCaptureStep = pickPrimaryCaptureStep(nextRecords);
      const nextConfirmStep = pickPrimaryConfirmStep(
        nextRecords,
        nextCaptureStep?.id ?? null,
      );

      if (nextConfirmStep) {
        const successRedirect = buildPublicationStepPath(
          pathPrefix,
          nextConfirmStep.slug,
          nextConfirmStep.isEntryStep,
        );

        setStepDrafts((drafts) => {
          const sourceEntries = nextRecords.map((step) => [
            step.id,
            drafts[step.id] ?? buildStepDraft(step),
          ] as const);

          return Object.fromEntries(
            sourceEntries.map(([stepId, draft]) => [
              stepId,
              {
                ...draft,
                blocksText: SmartWiringService.serialize(
                  SmartWiringService.syncSuccessRedirect({
                    blocks: draft.blocksText,
                    successRedirect,
                  }),
                ),
              },
            ]),
          );
        });
      }

      return nextRecords;
    });
  };

  const handleSmartWiring = async () => {
    if (!currentPublicationId || !funnelInstanceId) {
      setErrorMessage("Guarda o carga una publicación antes de ejecutar Smart Wiring.");
      return;
    }

    if (parsedBlocks.error || !Array.isArray(parsedBlocks.value)) {
      setErrorMessage("Corrige el JSON de bloques antes de pedir Smart Wiring.");
      return;
    }

    const userIntent =
      "Optimiza el wiring del funnel actual, preserva el contrato de navegación y mejora la continuidad entre CTA, captura y confirmación.";
    const successRedirect = confirmStep
      ? buildPublicationStepPath(
          pathPrefix,
          confirmStep.slug,
          confirmStep.isEntryStep,
        )
      : "/confirmado";

    setIsOrchestrating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const sessionId = await initializeOrchestrationSession();
      const response = await teamOperationRequest<ExecuteOrchestrationApiResponse>(
        "/runtime/execute-orchestration",
        {
          method: "POST",
          body: JSON.stringify({
            session_id: sessionId,
            intent: userIntent,
          }),
        },
      );
      const recipeKey = extractOrchestrationRecipeKey(response.data);
      const replace = extractOrchestrationReplace(response.data);
      const catalog = availableBlocks ?? [];
      let nextBlocks: unknown = null;

      if (recipeKey && catalog.length > 0) {
        const recipe = readyMadeFunnelRecipes.find(
          (candidate) => candidate.key === recipeKey,
        );

        if (recipe) {
          nextBlocks = SmartWiringService.applyRecipe({
            blocks: editorBlocksText,
            recipe,
            catalog,
            stepType: editorContext?.stepType ?? activeStep?.stepType ?? null,
            successRedirect,
            replace,
          });
        }
      }

      if (!nextBlocks) {
        const rawBlocks = extractOrchestrationBlocks(response.data);

        if (!rawBlocks) {
          throw new Error(
            "La IA respondió sin un contrato de bloques aplicable para Smart Wiring.",
          );
        }

        nextBlocks = SmartWiringService.syncSuccessRedirect({
          blocks: rawBlocks,
          successRedirect,
        });
      }

      updateEditorDraft({
        blocksText: SmartWiringService.serialize(nextBlocks),
        mediaRows: toMediaRows(
          extractOrchestrationMediaMap(response.data) ?? mediaMap,
        ),
        settingsJson:
          extractOrchestrationSettings(response.data) ?? editorSettingsJson,
      });
      setSuccessMessage(
        "Smart Wiring aplicó una nueva estructura visual sobre el paso activo.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No pudimos completar Smart Wiring.",
      );
    } finally {
      setIsOrchestrating(false);
    }
  };

  const quickHelpContent: ReactNode = (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-300">
          Captación nativa
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Usa <code>lead_capture_form</code> si quieres que los CTAs comerciales
          salten al formulario nativo con la ancla <code>#public-capture-form</code>.
        </p>
      </div>
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
          Media dictionary
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Sube assets al CDN solo cuando lo necesites. Las llaves base recomendadas
          siguen siendo <code>hero</code>, <code>product_box</code>, <code>gallery_1</code> y <code>seo_cover</code>.
        </p>
      </div>
    </div>
  );

  return (
    <ZenModeShell
      funnelName={funnelName || headerTitle}
      publicationStatus={currentPublicationId ? "published" : "draft"}
      runtimeHealthStatus={runtimeHealthStatus}
      isPublishing={isPending}
      publishDisabled={isSaveDisabled}
      onPublish={handleSave}
      onOpenInspector={() => setIsInspectorOpen(true)}
      backHref={backHref}
      backLabel={backLabel}
      stepSelector={null}
      inspector={
        <PublicationInspectorDrawer
          isOpen={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
          seoTitle={seoTitle}
          metaDescription={metaDescription}
          onSeoTitleChange={setSeoTitle}
          onMetaDescriptionChange={setMetaDescription}
          metaPixelId={metaPixelId}
          tiktokPixelId={tiktokPixelId}
          metaCapiToken={metaCapiToken}
          tiktokAccessToken={tiktokAccessToken}
          onTrackingChange={updateTrackingField}
        />
      }
    >
      <div className="min-h-full w-full bg-slate-50 dark:bg-slate-950 dark:[background-image:var(--bg-glow-conferencia)] dark:bg-cover dark:bg-fixed dark:bg-center">
      <div className="flex min-h-full w-full gap-5 px-4 py-5 text-left text-slate-900 dark:text-slate-100 md:px-6">
        <StepManagerSidebar
          funnelInstanceId={funnelInstanceId}
          graph={flowGraph}
          runtimeHealthStatus={runtimeHealthStatus}
          isOrchestrating={isOrchestrating}
          onGraphUpdated={handleGraphUpdated}
          onSmartWiring={handleSmartWiring}
        />

        <div className="min-w-0 flex-1">
          <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 text-left">
            {errorMessage ? (
              <OperationBanner tone="error" message={errorMessage} />
            ) : null}
            {successMessage ? (
              <OperationBanner tone="success" message={successMessage} />
            ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <article className={sectionClassName}>
            <div className="flex items-center gap-3 text-left">
              <div className="rounded-full bg-cyan-500/15 p-2 text-cyan-300">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Template activo
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedTemplate?.name ?? "Selecciona un template"}
                </p>
              </div>
            </div>
          </article>
          <article className={sectionClassName}>
            <div className="flex items-center gap-3 text-left">
              <div className="rounded-full bg-amber-500/15 p-2 text-amber-300">
                <FileJson className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Bloques válidos
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {parsedBlocks.value
                    ? `${parsedBlocks.value.length} bloques listos`
                    : "Corrige el JSON"}
                </p>
              </div>
            </div>
          </article>
          <article className={sectionClassName}>
            <div className="flex items-center gap-3 text-left">
              <div className="rounded-full bg-emerald-500/15 p-2 text-emerald-300">
                <Globe className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {showStepSwitcher ? "Paso activo" : "Publicación"}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
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
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Configuración
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                Configuración operativa del funnel
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                Mantén aquí solo los cables estructurales. SEO, tracking y
                metadata viven en el inspector lateral para no competir con el
                canvas de conversión.
              </p>
            </div>
            <ChevronDown className="h-5 w-5 text-slate-500" />
          </summary>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="grid gap-2">
              <span className={fieldLabelClassName}>Nombre del funnel</span>
              <input
                value={funnelName}
                onChange={(event) => setFunnelName(event.target.value)}
                placeholder="Dragon Vintage T9 - Jakawi Import"
                className={inputClassName}
              />
              <span className="text-xs leading-5 text-slate-500">
                Código interno sugerido:{" "}
                {slugify(funnelName || "nuevo-funnel") || "nuevo-funnel"}
              </span>
            </label>

            <label className="grid gap-2">
              <span className={fieldLabelClassName}>Dominio activo</span>
              <select
                value={selectedDomainId}
                onChange={(event) => setSelectedDomainId(event.target.value)}
                className={inputClassName}
              >
                {activeDomains.map((domain) => (
                  <option key={domain.id} value={domain.id}>
                    {domain.host}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className={fieldLabelClassName}>Ruta</span>
              <input
                value={pathPrefix}
                onChange={(event) => setPathPrefix(event.target.value)}
                placeholder="/"
                className={inputClassName}
              />
            </label>

            <label className="grid gap-2">
              <span className={fieldLabelClassName}>Template base</span>
              <select
                value={selectedTemplateId}
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                className={inputClassName}
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
              <span className={fieldLabelClassName}>Funnel Theme</span>
              <select
                value={selectedThemeId}
                onChange={(event) => setSelectedThemeId(event.target.value)}
                className={inputClassName}
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
          previewSettingsJson={editorSettingsJson}
          availableBlocks={availableBlocks}
          graphDestinations={graphDestinations}
          stepSpecificSettingsPanel={
            <article className="rounded-[1.5rem] border border-app-border bg-app-surface-muted p-6 text-left">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl text-left">
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-text-soft">
                    Configuración específica del paso
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-app-text">
                    Layout del paso
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-app-text-muted">
                    Este ajuste vive dentro de <code>settingsJson</code> del paso
                    activo y permite que páginas como <code>/confirmado</code>{" "}
                    rompan la herencia del layout sticky del funnel cuando haga
                    falta.
                  </p>
                </div>

                <label className="grid min-w-full gap-2 lg:min-w-[22rem]">
                  <span className={fieldLabelClassName}>Layout del paso</span>
                  <select
                    value={editorLayoutOverride}
                    onChange={(event) =>
                      updateEditorDraft({
                        settingsJson: mergeStepLayoutOverride(
                          editorSettingsJson,
                          event.target.value as StepLayoutOverrideValue,
                        ),
                      })
                    }
                    className={inputClassName}
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
            currentPublicationId && activeStep
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
          routingReference={routingReference}
          stepSwitcher={null}
        />
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setIsHelpOpen(true)}
        className="fixed bottom-5 right-5 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-cyan-400/25 bg-white/90 text-cyan-700 shadow-xl shadow-slate-200/50 backdrop-blur transition hover:bg-cyan-50 dark:bg-slate-900/90 dark:text-cyan-200 dark:shadow-slate-950/40 dark:hover:bg-slate-800"
        aria-label="Abrir ayuda rápida"
      >
        <CircleHelp className="h-5 w-5" />
      </button>

      {isHelpOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-end bg-slate-900/20 p-4 backdrop-blur-sm md:items-start dark:bg-slate-950/40">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-200/50 dark:border-white/10 dark:bg-slate-900 dark:shadow-slate-950/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-500">
                  Ayuda rápida
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Cheatsheet del builder
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
            <div className="mt-4">{quickHelpContent}</div>
          </div>
        </div>
      ) : null}
      </div>
    </ZenModeShell>
  );
}
