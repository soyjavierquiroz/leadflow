"use client";

import {
  useEffect,
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  readyMadeFunnelRecipes,
  SmartWiringService,
  type SmartWiringRecipe,
} from "../../../../packages/shared/funnel-orchestrator/src";
import {
  Check,
  ChevronDown,
  Copy,
  FileQuestion,
  FileJson,
  History,
  ImagePlus,
  Link2,
  MessageSquare,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Wand2,
  CircleHelp,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  BlockCard,
  type ComposerDestination,
} from "@/components/team-operations/BlockCard";
import { ModalShell } from "@/components/team-operations/modal-shell";
import {
  buildMediaMap,
  type HybridJsonPreviewDraft,
  writeHybridJsonPreviewDraft,
} from "@/components/team-operations/hybrid-json-preview-state";
import {
  defaultBuilderBlockDefinitions,
  type BuilderBlockDefinition,
} from "@/lib/blocks/registry";
import { FUNNEL_ASSET_IMAGE_ACCEPT } from "@/lib/media-optimizer";
import type { JsonValue } from "@/lib/public-funnel-runtime.types";

const sectionClassName =
  "rounded-xl border border-slate-200 bg-white/90 p-3 text-left text-slate-900 shadow-sm shadow-slate-200/50 md:p-4 dark:border-white/10 dark:bg-slate-900/90 dark:text-slate-100 dark:shadow-slate-950/30";

const secondaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full border border-app-border bg-app-card px-4 py-2.5 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-60";

const scaffoldButtonClassName =
  "inline-flex min-h-28 w-full items-start justify-between gap-4 rounded-[1.75rem] border border-app-border bg-app-card px-5 py-4 text-left text-app-text shadow-sm transition hover:-translate-y-0.5 hover:border-app-border-strong hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-60";

const inputClassName =
  "w-full rounded-xl border border-app-border bg-app-card px-3 py-2 text-sm text-app-text outline-none transition placeholder:text-app-text-soft focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft";

const codePanelClassName =
  "overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-4 text-xs leading-6 text-slate-900 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-100";

export const requiredMediaKeys = [
  "hero",
  "product_box",
  "gallery_1",
  "seo_cover",
] as const;

export const defaultBlocksSeed = JSON.stringify(
  [
    {
      type: "hook_and_promise",
      block_id: "hook_dragon_t9_seed",
      eyebrow_text: "barba precisa en casa",
      content: {
        headline: "Perfila tu barba en minutos con la DRAGON VINTAGE T9®",
        subheadline:
          "Consigue una barba limpia, definida y con acabado profesional sin salir de casa.",
        cta_button_text: "quiero mi dragon t9 ahora",
        cta_footer: "Te llevamos al siguiente paso sin romper el tracking.",
      },
      primary_benefit_bullets: [
        "Define contornos con precisión profesional",
        "Reduce volumen y da forma en pocos minutos",
        "Cuchillas de alta precisión para cortes uniformes",
      ],
      price_anchor_text: "precio regular",
      price_main_text: "ver precio especial",
      trust_badges: ["envío rápido", "pago seguro", "garantía"],
    },
    {
      type: "unique_mechanism",
      block_id: "mechanism_dragon_t9_seed",
      media_url: "product_box",
      headline: "La diferencia está en su precisión profesional de detalle",
      mechanism_name: "sistema de corte t-blade de precisión dragon",
      how_it_works_steps: [
        {
          step_title: "define",
          step_text:
            "Marca contornos de mejilla, cuello y patillas con máxima visibilidad.",
        },
        {
          step_title: "rebaja",
          step_text: "Reduce volumen y empareja la barba sin dejar huecos.",
        },
      ],
      feature_benefit_pairs: [
        {
          feature: "cuchilla t-blade de precisión",
          benefit: "permite perfilar líneas más definidas y simétricas",
        },
      ],
      comparison_title: "por qué dragon t9 sí y una máquina común no",
      comparison_points: [
        "Una máquina común recorta volumen; Dragon T9 también define detalles",
      ],
    },
    {
      type: "grand_slam_offer",
      block_id: "offer_dragon_t9_seed",
      headline: "Llévate hoy tu kit Dragon T9",
      offer_name: "oferta dragon t9 barbero en casa",
      what_is_included: [
        {
          item_name: "rasuradora dragon t9",
          item_description:
            "La herramienta principal para perfilar y detallar.",
          item_value_text: "valor percibido Bs.150",
        },
      ],
      price_stack: {
        anchor_price_text: "valor total percibido Bs.210",
        final_price_text: "oferta activa",
        savings_text: "ahorro aplicado",
      },
      primary_cta_text: "aprovechar oferta dragon t9",
    },
  ],
  null,
  2,
);

const captureScaffoldSeed = JSON.stringify(
  [
    {
      type: "hero",
      key: "hero-captura-base",
      variant: "opportunity",
      eyebrow: "borrador de captura",
      title: "Define la promesa principal de este paso",
      description:
        "Usa este hero como base para explicar el resultado, la audiencia correcta y el CTA hacia la captura.",
      accent: "Completa headline, beneficios y prueba visible",
      primaryCtaLabel: "Quiero continuar",
      primaryCtaHref: "#public-capture-form",
      secondaryCtaLabel: "Ver detalles",
      secondaryCtaHref: "#video-vsl-base",
      metrics: [
        {
          label: "Promesa",
          value: "Pendiente",
          description: "Aterriza el beneficio central en una frase.",
        },
        {
          label: "Prueba",
          value: "Pendiente",
          description: "Agrega autoridad o resultado visible.",
        },
      ],
      proofItems: [
        "Mensaje claro desde el primer scroll",
        "CTA conectado al flujo de captura",
      ],
    },
    {
      type: "video",
      key: "video-vsl-base",
      title: "Inserta tu VSL o demo principal",
      caption: "Reemplaza este embed por el video real del funnel.",
      embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      items: [
        "Explica el mecanismo o la oportunidad",
        "Reduce objeciones antes de la captura",
        "Conecta el cierre con el modal",
      ],
    },
    {
      type: "lead_capture_config",
      key: "modal-config-base",
      modal_config: {
        title: "",
        description: "",
        default_country: "BO",
        fields: {
          name: {
            label: "",
            placeholder: "",
            error_msg: "",
          },
          phone: {
            label: "",
            placeholder: "",
            error_msg: "",
          },
        },
        cta_button: {
          text: "",
          subtext: "",
        },
      },
      success_redirect: "/confirmado",
    },
  ],
  null,
  2,
);

const confirmationScaffoldSeed = JSON.stringify(
  [
    {
      type: "conversion_page_config",
      key: "conversion-page-base",
      content: {
        headline: "Tu registro fue confirmado",
        subheadline:
          "Usa esta tarjeta centrada para validar la acción tomada y preparar el siguiente movimiento.",
        cta_text: "Abrir WhatsApp",
        whatsapp_message:
          "Hola, ya completé mi registro y quiero continuar con el siguiente paso.",
        redirect_delay: 0,
        fallback_advisor: {
          name: "Asesor asignado",
          bio: "Actualiza aquí el nombre, la bio y el CTA principal del handoff.",
          phone: "",
          photo_url: "",
        },
      },
    },
    {
      type: "whatsapp_handoff_cta",
      key: "whatsapp-handoff-base",
      headline: "Continúa ahora por WhatsApp",
      subheadline:
        "Actualiza este copy para describir qué va a pasar al abrir la conversación.",
      button_text: "Abrir WhatsApp",
      helper_text: "Mantén una instrucción clara y sin fricción.",
      variant: "handoff_primary",
    },
  ],
  null,
  2,
);

export type MediaRow = {
  key: string;
  value: string;
};

const defaultMediaRows = requiredMediaKeys.map((key) => ({
  key,
  value: "",
}));

const emptyComposerDestinations: ComposerDestination[] = [];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type ComposerBlock = Record<string, JsonValue | undefined> & {
  type?: string;
  key?: string;
  block_id?: string;
  is_hidden?: boolean;
};

const isComposerBlock = (value: unknown): value is ComposerBlock =>
  isRecord(value);

const parseComposerBlocks = (value: string): ComposerBlock[] => {
  try {
    const parsed = JSON.parse(value) as unknown;

    return Array.isArray(parsed)
      ? parsed.filter(isComposerBlock).map((block, index) => ({
          ...block,
          type: typeof block.type === "string" ? block.type : "unknown",
          block_id:
            typeof block.block_id === "string" && block.block_id.trim()
              ? block.block_id
              : `${typeof block.type === "string" ? block.type : "block"}-${index + 1}`,
        }))
      : [];
  } catch {
    return [];
  }
};

const blockIconByType: Record<string, LucideIcon> = {
  hero: Sparkles,
  hook_and_promise: MessageSquare,
  lead_capture_config: Wand2,
  lead_capture_form: FileJson,
  faq: CircleHelp,
  faq_accordion: CircleHelp,
  faq_social_proof: CircleHelp,
  cta: Link2,
  sticky_conversion_bar: Link2,
  grand_slam_offer: Sparkles,
  conversion_page_config: Check,
  whatsapp_handoff_cta: MessageSquare,
};

const getBlockIdentity = (block: ComposerBlock, index: number) =>
  block.block_id ??
  block.key ??
  `${typeof block.type === "string" ? block.type : "block"}-${index + 1}`;

const cloneJson = <T,>(value: T): T =>
  value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);

export const isAbsoluteHttpUrl = (value: string) =>
  /^https?:\/\//i.test(value.trim());

export const toMediaRows = (value: unknown) => {
  const rows = isRecord(value)
    ? Object.entries(value).map(([key, entry]) => ({
        key,
        value: typeof entry === "string" ? entry : "",
      }))
    : [];

  const existingKeys = new Set(rows.map((row) => row.key));
  for (const key of requiredMediaKeys) {
    if (!existingKeys.has(key)) {
      rows.push({ key, value: "" });
    }
  }

  return rows.length > 0 ? rows : [...defaultMediaRows];
};

type HybridJsonMediaEditorProps = {
  blocksText: string;
  onBlocksTextChange: (value: string) => void;
  parsedBlocksError: string | null;
  parsedBlocksCount: number;
  mediaRows: MediaRow[];
  mediaValidation: string | null;
  mediaMapKeys: string[];
  uploadingRowIndex: number | null;
  mediaUploadInputRef: RefObject<HTMLInputElement | null>;
  onMediaUploadChange: (
    event: ChangeEvent<HTMLInputElement>,
  ) => Promise<void> | void;
  onMediaRowChange: (index: number, patch: Partial<MediaRow>) => void;
  onAddMediaRow: (key?: string) => void;
  onUploadMediaClick: (index: number) => void;
  onRemoveMediaRow: (index: number) => void;
  previewTheme?: string;
  previewSettingsJson?: unknown;
  previewDraftKey?: string | null;
  editorContext?: {
    stepName: string;
    stepPath: string;
    stepType?: string | null;
  } | null;
  availableBlocks?: BuilderBlockDefinition[];
  routingReference?: {
    title: string;
    helperText?: string | null;
    items: Array<{
      id: string;
      label: string;
      path: string;
      badge?: string | null;
    }>;
  } | null;
  graphDestinations?: ComposerDestination[];
  stepSwitcher?: {
    activeKey: string;
    badge?: string | null;
    disabled?: boolean;
    helperText?: string | null;
    tabs: Array<{
      key: string;
      label: string;
    }>;
    warningText?: string | null;
    onChange: (key: string) => void;
  } | null;
  historyPanel?: {
    isOpen: boolean;
    isLoading: boolean;
    errorMessage?: string | null;
    title?: string;
    versions: Array<{
      id: string;
      createdAt: string;
      createdBy?: string | null;
    }>;
    onOpen: () => void;
    onClose: () => void;
    onRestore: (historyId: string) => void;
  } | null;
  stepSpecificSettingsPanel?: ReactNode;
};

export function HybridJsonMediaEditor({
  blocksText,
  onBlocksTextChange,
  parsedBlocksError,
  parsedBlocksCount,
  mediaRows,
  mediaValidation,
  mediaMapKeys,
  uploadingRowIndex,
  mediaUploadInputRef,
  onMediaUploadChange,
  onMediaRowChange,
  onAddMediaRow,
  onUploadMediaClick,
  onRemoveMediaRow,
  previewTheme = "default",
  previewSettingsJson = null,
  previewDraftKey = null,
  editorContext = null,
  availableBlocks = defaultBuilderBlockDefinitions,
  routingReference = null,
  graphDestinations = emptyComposerDestinations,
  stepSwitcher = null,
  historyPanel = null,
  stepSpecificSettingsPanel = null,
}: HybridJsonMediaEditorProps) {
  const catalogBlocks = useMemo(() => {
    const merged = new Map<string, BuilderBlockDefinition>();

    for (const definition of defaultBuilderBlockDefinitions) {
      merged.set(definition.key, definition);
    }

    for (const definition of availableBlocks) {
      merged.set(definition.key, definition);
    }

    return Array.from(merged.values());
  }, [availableBlocks]);
  const currentStepType = editorContext?.stepType ?? stepSwitcher?.badge ?? null;
  const compatibleCatalogBlocks = useMemo(
    () =>
      catalogBlocks.filter((definition) =>
        SmartWiringService.isCompatible(definition, currentStepType),
      ),
    [catalogBlocks, currentStepType],
  );
  const incompatibleCatalogBlocks = useMemo(
    () =>
      catalogBlocks.filter(
        (definition) =>
          !SmartWiringService.isCompatible(definition, currentStepType),
      ),
    [catalogBlocks, currentStepType],
  );
  const readyMadeRecipes = useMemo(
    () =>
      readyMadeFunnelRecipes.filter((recipe) =>
        SmartWiringService.isCompatible(recipe, currentStepType),
      ),
    [currentStepType],
  );

  const [selectedBlockKey, setSelectedBlockKey] = useState(
    catalogBlocks[0]?.key ?? "",
  );
  const [copiedRoutingPath, setCopiedRoutingPath] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);
  const previewDraft = useMemo<HybridJsonPreviewDraft>(
    () => ({
      blocks: blocksText,
      media: buildMediaMap(mediaRows),
      theme: previewTheme,
      settingsJson: (
        isRecord(previewSettingsJson) ? previewSettingsJson : {}
      ) as any,
    }),
    [blocksText, mediaRows, previewSettingsJson, previewTheme],
  );

  useEffect(() => {
    if (!previewDraftKey) {
      return;
    }

    writeHybridJsonPreviewDraft(
      previewDraftKey,
      previewDraft as HybridJsonPreviewDraft,
    );
  }, [previewDraft, previewDraftKey]);

  useEffect(() => {
    if (catalogBlocks.length === 0) {
      if (selectedBlockKey) {
        setSelectedBlockKey("");
      }
      return;
    }

    const activeCatalog =
      compatibleCatalogBlocks.length > 0 ? compatibleCatalogBlocks : catalogBlocks;
    const hasCurrentSelection = activeCatalog.some(
      (definition) => definition.key === selectedBlockKey,
    );

    if (!hasCurrentSelection) {
      setSelectedBlockKey(activeCatalog[0]?.key ?? "");
    }
  }, [catalogBlocks, compatibleCatalogBlocks, selectedBlockKey]);

  const isBlankCanvas = useMemo(() => {
    const trimmed = blocksText.trim();

    if (!trimmed || trimmed === '""' || trimmed === "[]") {
      return true;
    }

    if (parsedBlocksError) {
      return false;
    }

    return parsedBlocksCount === 0;
  }, [blocksText, parsedBlocksCount, parsedBlocksError]);
  const composerBlocks = useMemo(
    () => (parsedBlocksError ? [] : parseComposerBlocks(blocksText)),
    [blocksText, parsedBlocksError],
  );
  const composerBlockIds = useMemo(
    () => composerBlocks.map((block, index) => getBlockIdentity(block, index)),
    [composerBlocks],
  );
  const composerDefinitionByKey = useMemo(
    () =>
      new Map(
        catalogBlocks.map((definition) => [definition.key, definition]),
      ),
    [catalogBlocks],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const writeComposerBlocks = (blocks: ComposerBlock[]) => {
    const syncedBlocks =
      routingReference?.items[0]?.path
        ? SmartWiringService.syncSuccessRedirect({
            blocks,
            successRedirect: routingReference.items[0].path,
          })
        : blocks;

    onBlocksTextChange(SmartWiringService.serialize(syncedBlocks));
  };

  const buildComposerDestinations = useCallback((blocks: ComposerBlock[]) => {
    const routeDestinations: ComposerDestination[] =
      routingReference?.items.map((item) => ({
        value: item.path,
        label: `Ir a: ${item.label}`,
        kind: "route",
      })) ?? [];
    const blockDestinations: ComposerDestination[] = blocks
      .map((block, index) => {
        const type = typeof block.type === "string" ? block.type : "block";
        const blockId = getBlockIdentity(block, index);
        const definition = composerDefinitionByKey.get(type);
        const isModalConfig = type === "lead_capture_config";

        return {
          value: isModalConfig ? "open_lead_capture_modal" : `#${blockId}`,
          label: isModalConfig
            ? `Abrir: ${definition?.name ?? "Modal de Captura"}`
            : `Saltar a: ${definition?.name ?? type}`,
          kind: "block" as const,
        };
      });
    const actionDestinations: ComposerDestination[] = [
      {
        value: "open_lead_capture_modal",
        label: "Abrir: Modal de Captura",
        kind: "action",
      },
      {
        value: "scroll_to_capture",
        label: "Ir a: Formulario de Captura",
        kind: "action",
      },
      {
        value: "#public-capture-form",
        label: "Ir a: Formulario en Página",
        kind: "action",
      },
      {
        value: "hook_primary",
        label: "Acción: CTA Principal del Hook",
        kind: "action",
      },
    ];
    const seen = new Set<string>();

    return [
      ...actionDestinations,
      ...graphDestinations,
      ...routeDestinations,
      ...blockDestinations,
    ].filter((destination) => {
      if (seen.has(destination.value)) {
        return false;
      }

      seen.add(destination.value);
      return true;
    });
  }, [composerDefinitionByKey, graphDestinations, routingReference]);
  const composerDestinations = useMemo(
    () => buildComposerDestinations(composerBlocks),
    [buildComposerDestinations, composerBlocks],
  );

  const patchComposerBlock = (blockId: string, patch: Partial<ComposerBlock>) => {
    writeComposerBlocks(
      composerBlocks.map((block, index) =>
        getBlockIdentity(block, index) === blockId ? { ...block, ...patch } : block,
      ),
    );
  };

  const duplicateComposerBlock = (blockId: string) => {
    const sourceIndex = composerBlocks.findIndex(
      (block, index) => getBlockIdentity(block, index) === blockId,
    );

    if (sourceIndex < 0) {
      return;
    }

    const sourceBlock = composerBlocks[sourceIndex];
    const copy = {
      ...cloneJson(sourceBlock),
      key:
        typeof sourceBlock.key === "string" && sourceBlock.key.trim()
          ? `${sourceBlock.key}-copy`
          : undefined,
      block_id: SmartWiringService.stableBlockId(
        typeof sourceBlock.type === "string" ? sourceBlock.type : "block",
        `${blockId}:copy:${composerBlocks.length}`,
      ),
    };
    const nextBlocks = [...composerBlocks];
    nextBlocks.splice(sourceIndex + 1, 0, copy);
    writeComposerBlocks(nextBlocks);
  };

  const deleteComposerBlock = (blockId: string) => {
    writeComposerBlocks(
      composerBlocks.filter(
        (block, index) => getBlockIdentity(block, index) !== blockId,
      ),
    );
  };

  const toggleComposerBlockHidden = (blockId: string) => {
    writeComposerBlocks(
      composerBlocks.map((block, index) =>
        getBlockIdentity(block, index) === blockId
          ? { ...block, is_hidden: !block.is_hidden }
          : block,
      ),
    );
  };

  const handleComposerDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const reorderedBlocks = SmartWiringService.reorderBlocks({
      blocks: composerBlocks,
      activeBlockId: String(active.id),
      overBlockId: String(over.id),
    });

    writeComposerBlocks(reorderedBlocks as ComposerBlock[]);
  };

  const handleInsertBlockExample = (definition: BuilderBlockDefinition) => {
    const nextBlocks = SmartWiringService.insertBlock({
      blocks: blocksText,
      definition,
      stepType: currentStepType,
      successRedirect: routingReference?.items[0]?.path ?? null,
    });

    onBlocksTextChange(SmartWiringService.serialize(nextBlocks));
  };

  const handleApplyReadyMadeRecipe = (recipe: SmartWiringRecipe) => {
    const nextBlocks = SmartWiringService.applyRecipe({
      blocks: blocksText,
      recipe,
      catalog: catalogBlocks,
      stepType: currentStepType,
      successRedirect: routingReference?.items[0]?.path ?? recipe.successRedirect ?? null,
      replace: isBlankCanvas,
    });

    onBlocksTextChange(SmartWiringService.serialize(nextBlocks));
  };

  const handleSyncSuccessRedirect = (successRedirect: string) => {
    const nextBlocks = SmartWiringService.syncSuccessRedirect({
      blocks: blocksText,
      successRedirect,
    });

    onBlocksTextChange(SmartWiringService.serialize(nextBlocks));
  };

  const handleInjectScaffold = (value: string) => {
    const nextBlocks = SmartWiringService.syncSuccessRedirect({
      blocks: value,
      successRedirect: routingReference?.items[0]?.path ?? "/confirmado",
    });

    onBlocksTextChange(SmartWiringService.serialize(nextBlocks));
  };

  const selectedBlockDefinition =
    compatibleCatalogBlocks.find(
      (definition) => definition.key === selectedBlockKey,
    ) ??
    catalogBlocks.find((definition) => definition.key === selectedBlockKey) ??
    compatibleCatalogBlocks[0] ??
    catalogBlocks[0] ??
    null;
  const selectedBlockIsCompatible = selectedBlockDefinition
    ? SmartWiringService.isCompatible(selectedBlockDefinition, currentStepType)
    : false;
  const compatibleStepTypeLabel =
    SmartWiringService.normalizeStepType(currentStepType) ?? "global";

  const catalogHelpText = selectedBlockIsCompatible
    ? `${compatibleCatalogBlocks.length} bloque${
        compatibleCatalogBlocks.length === 1 ? "" : "s"
      } compatible${compatibleCatalogBlocks.length === 1 ? "" : "s"} con ${compatibleStepTypeLabel}.`
    : "Este bloque existe en el arsenal, pero no es ideal para el paso activo.";

  const stringifyCapabilities = (definition: BuilderBlockDefinition) =>
    definition.requiredCapabilities.length > 0
      ? definition.requiredCapabilities.join(", ")
      : "sin dependencias";

  const stringifyOutcomes = (definition: BuilderBlockDefinition) =>
    definition.emitsOutcomes.length > 0
      ? definition.emitsOutcomes.join(", ")
      : "sin eventos";

  const renderRecipeButton = (recipe: SmartWiringRecipe) => (
    <button
      key={recipe.key}
      type="button"
      onClick={() => handleApplyReadyMadeRecipe(recipe)}
      className={scaffoldButtonClassName}
    >
      <div className="space-y-2">
        <p className="text-base font-semibold">{recipe.name}</p>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          {recipe.description}
        </p>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          {recipe.blockTypes.join(" + ")}
        </p>
      </div>
      <Sparkles className="mt-1 h-5 w-5 shrink-0 text-amber-300" />
    </button>
  );

  const handleCopyRoutingPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
      setCopiedRoutingPath(path);
      window.setTimeout(() => {
        setCopiedRoutingPath((current) => (current === path ? null : current));
      }, 1800);
    } catch {
      setCopiedRoutingPath(null);
    }
  };

  const handleOpenPreview = (event: MouseEvent<HTMLButtonElement>) => {
    if (!previewDraftKey) {
      return;
    }

    event.preventDefault();
    writeHybridJsonPreviewDraft(previewDraftKey, previewDraft);
    window.open(
      `/admin/preview?draftKey=${encodeURIComponent(previewDraftKey)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(blocksText) as unknown;
      onBlocksTextChange(JSON.stringify(parsed, null, 2));
      setFormatError(null);
    } catch (error) {
      console.error("Unable to format blocks JSON", error);
      setFormatError(
        "El JSON tiene errores de sintaxis. Corrígelo antes de formatear.",
      );
    }
  };

  return (
    <>
      <input
        ref={mediaUploadInputRef}
        type="file"
        accept={FUNNEL_ASSET_IMAGE_ACCEPT}
        className="hidden"
        onChange={(event) => void onMediaUploadChange(event)}
      />

      <div className="space-y-6">
        <details className={sectionClassName}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <div className="text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Configuración de Desarrollador
              </p>
              {stepSwitcher ? (
                <div className="mt-2 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {stepSwitcher.tabs.map((tab) => {
                        const isActive = tab.key === stepSwitcher.activeKey;

                        return (
                          <button
                            key={tab.key}
                            type="button"
                            disabled={stepSwitcher.disabled}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              stepSwitcher.onChange(tab.key);
                            }}
                            className={
                              isActive
                                ? "inline-flex items-center justify-center rounded-full bg-app-text px-3 py-1.5 text-xs font-semibold text-app-bg transition disabled:cursor-not-allowed disabled:opacity-60"
                                : "inline-flex items-center justify-center rounded-full border border-app-border bg-app-card px-3 py-1.5 text-xs font-semibold text-app-text-muted transition hover:border-app-border-strong hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                            }
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    {stepSwitcher.badge ? (
                      <span className="inline-flex items-center rounded-full bg-app-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted ring-1 ring-app-border">
                        {stepSwitcher.badge}
                      </span>
                    ) : null}
                  </div>

                  {stepSwitcher.helperText ? (
                      <p className="text-xs text-app-text-muted">
                      {stepSwitcher.helperText}
                    </p>
                  ) : null}
                </div>
              ) : (
                <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  JSON engine del funnel
                </h2>
              )}
            </div>
            <ChevronDown className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          </summary>

          <div className="mt-4 space-y-4">
            {stepSwitcher?.warningText ? (
              <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                {stepSwitcher.warningText}
              </p>
            ) : null}

            {stepSpecificSettingsPanel}

            {routingReference && routingReference.items.length > 0 ? (
              <article className="rounded-xl border border-cyan-500/15 bg-cyan-500/10 p-4 text-left">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="text-left">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
                      {routingReference.title}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      URLs disponibles para redirección
                    </h3>
                    {routingReference.helperText ? (
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {routingReference.helperText}
                      </p>
                    ) : null}
                  </div>
                  <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-cyan-300 dark:ring-white/10">
                    {routingReference.items.length} paso
                    {routingReference.items.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {routingReference.items.map((item) => {
                    const isCopied = copiedRoutingPath === item.path;

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 md:flex-row md:items-center md:justify-between dark:border-white/10 dark:bg-slate-900/80"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {item.label}
                            </p>
                            {item.badge ? (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                {item.badge}
                              </span>
                            ) : null}
                          </div>
                          <code className="mt-2 block overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-900 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-100">
                            {item.path}
                          </code>
                        </div>

                        <button
                          type="button"
                          onClick={() => void handleCopyRoutingPath(item.path)}
                          className={secondaryButtonClassName}
                        >
                          {isCopied ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                          {isCopied ? "Copiado" : "Copiar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSyncSuccessRedirect(item.path)}
                          className={secondaryButtonClassName}
                        >
                          <Wand2 className="h-4 w-4" />
                          Sincronizar JSON
                        </button>
                      </div>
                    );
                  })}
                </div>
              </article>
            ) : null}

            <div className="mb-2 flex w-full items-center justify-between gap-3 border-b border-slate-200 pb-2 dark:border-white/10">
              <div className="flex min-w-0 flex-1 flex-col justify-start gap-1 text-left">
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  <FileJson className="h-3.5 w-3.5" />
                  CodeMirror JSON
                </span>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Codigo JSON
                </p>
                <span className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                  El guardado solo se habilita si el contenido es un JSON Array
                  válido.
                </span>
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={handleFormatJson}
                  className={secondaryButtonClassName}
                >
                  <Wand2 className="h-4 w-4" />
                  Formatear JSON
                </button>

                {historyPanel ? (
                  <button
                    type="button"
                    onClick={historyPanel.onOpen}
                    className={secondaryButtonClassName}
                  >
                    <History className="h-4 w-4" />
                    ⏳ Historial de Versiones
                  </button>
                ) : null}

                {previewDraftKey ? (
                  <button
                    type="button"
                    onClick={handleOpenPreview}
                    className={secondaryButtonClassName}
                  >
                    👀 Ver Vista Previa
                  </button>
                ) : null}
              </div>
            </div>

            {editorContext ? (
                <div className="sticky top-4 z-10 rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 shadow-sm backdrop-blur">
                <div className="flex w-full items-center justify-start px-4 py-3 text-left">
                  <span className="mr-3 shrink-0 text-base leading-none text-amber-300">
                    ⚠️
                  </span>
                  <p className="text-sm font-semibold text-amber-300">
                    {`EDITANDO BORRADOR: ${editorContext.stepName} | Ruta: ${editorContext.stepPath}`}
                  </p>
                </div>
              </div>
            ) : null}

            {isBlankCanvas ? (
              <div className="rounded-xl border border-dashed border-amber-500/20 bg-amber-50 p-5 text-left dark:bg-[linear-gradient(180deg,rgba(245,158,11,0.12)_0%,rgba(15,23,42,0.85)_100%)]">
                <div className="flex flex-col gap-5">
                  <div className="max-w-2xl space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">
                      Lienzo en blanco
                    </p>
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                      Arranca este paso con una estructura segura
                    </h3>
                    <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                      Evita copiar y pegar desde otro paso. Inyecta una base lista para editar y luego ajusta el JSON en CodeMirror.
                    </p>
                  </div>

                  {readyMadeRecipes.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                        Sistemas Listos
                      </p>
                      <div className="grid gap-4 lg:grid-cols-2">
                        {readyMadeRecipes.map(renderRecipeButton)}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => handleInjectScaffold(captureScaffoldSeed)}
                      className={scaffoldButtonClassName}
                    >
                      <div className="space-y-2">
                        <p className="text-base font-semibold">
                          ⚡ Inyectar Plantilla VSL / Captura
                        </p>
                        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                          Carga un arranque con <code>hero</code>, <code>video</code> y <code>lead_capture_config</code>.
                        </p>
                      </div>
                      <Sparkles className="mt-1 h-5 w-5 shrink-0 text-amber-300" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleInjectScaffold(confirmationScaffoldSeed)}
                      className={scaffoldButtonClassName}
                    >
                      <div className="space-y-2">
                        <p className="text-base font-semibold">
                          ⚡ Inyectar Plantilla Confirmación
                        </p>
                        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                          Carga una base con <code>conversion_page_config</code> y <code>whatsapp_handoff_cta</code>.
                        </p>
                      </div>
                      <Sparkles className="mt-1 h-5 w-5 shrink-0 text-emerald-300" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 text-left dark:border-white/10 dark:bg-slate-950/40">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                      Block Composer
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                      Pila visual del paso
                    </h3>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:ring-white/10">
                    {composerBlocks.length} bloque
                    {composerBlocks.length === 1 ? "" : "s"}
                  </span>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleComposerDragEnd}
                >
                  <SortableContext
                    items={composerBlockIds}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="mt-4 space-y-3">
                      {composerBlocks.map((block, index) => {
                        const blockId = getBlockIdentity(block, index);
                        const type =
                          typeof block.type === "string" ? block.type : "unknown";
                        const definition = composerDefinitionByKey.get(type) ?? null;

                        return (
                          <BlockCard
                            key={blockId}
                            block={block}
                            blockId={blockId}
                            definition={definition}
                            fallbackName={type}
                            icon={blockIconByType[type] ?? FileQuestion}
                            stepType={currentStepType}
                            destinations={composerDestinations}
                            onPatch={(patch) => patchComposerBlock(blockId, patch)}
                            onDuplicate={() => duplicateComposerBlock(blockId)}
                            onDelete={() => deleteComposerBlock(blockId)}
                            onToggleHidden={() =>
                              toggleComposerBlockHidden(blockId)
                            }
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </article>
            )}

            <details className="rounded-[1.5rem] border border-slate-200 bg-white/90 p-4 text-left dark:border-white/10 dark:bg-slate-900/80">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    Vista JSON (Dev)
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Reflejo en tiempo real del Block Composer.
                  </p>
                </div>
                <ChevronDown className="h-5 w-5 text-slate-500 dark:text-slate-400" />
              </summary>

              <div className="mt-4 space-y-3">
                <div className="leadflow-json-editor h-[520px] min-h-[520px] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-950/80">
                  <CodeMirror
                    value={blocksText}
                    height="520px"
                    extensions={[json()]}
                    basicSetup={{
                      lineNumbers: true,
                      foldGutter: true,
                      highlightActiveLine: true,
                    }}
                    onChange={(value) => {
                      setFormatError(null);
                      onBlocksTextChange(value);
                    }}
                  />
                </div>

                {formatError ? (
                  <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    {formatError}
                  </p>
                ) : null}

                {parsedBlocksError ? (
                  <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {parsedBlocksError}
                  </p>
                ) : (
                  <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                    JSON válido. El engine detectó {parsedBlocksCount} bloque
                    {parsedBlocksCount === 1 ? "" : "s"} listo
                    {parsedBlocksCount === 1 ? "" : "s"} para persistir como{" "}
                    <code>blocksJson</code>.
                  </p>
                )}
              </div>
            </details>

            {!isBlankCanvas && readyMadeRecipes.length > 0 ? (
              <article className="rounded-[1.5rem] border border-amber-500/20 bg-amber-500/10 p-5 text-left">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
                      Sistemas Listos
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Recetas de 1 clic
                    </h3>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 ring-1 ring-amber-500/20 dark:bg-slate-900 dark:text-amber-300">
                    {compatibleStepTypeLabel}
                  </span>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {readyMadeRecipes.map(renderRecipeButton)}
                </div>
              </article>
            ) : null}

            {selectedBlockDefinition ? (
              <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-6 text-left dark:border-white/10 dark:bg-slate-900/80">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="text-left">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Catálogo / {selectedBlockDefinition.category} / {compatibleStepTypeLabel}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
                      {selectedBlockDefinition.name}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {catalogHelpText}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleInsertBlockExample(selectedBlockDefinition)
                    }
                    disabled={!selectedBlockIsCompatible}
                    className={secondaryButtonClassName}
                  >
                    <Plus className="h-4 w-4" />
                    Insertar bloque
                  </button>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-start">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Selector de bloque
                    </span>
                    <select
                      value={selectedBlockDefinition.key}
                      onChange={(event) => setSelectedBlockKey(event.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 dark:border-slate-700 dark:bg-slate-950/80 dark:text-slate-100"
                    >
                      {compatibleCatalogBlocks.length > 0 ? (
                        <optgroup label="Compatibles con este paso">
                          {compatibleCatalogBlocks.map((definition) => (
                            <option key={definition.key} value={definition.key}>
                              {definition.name} ({definition.key})
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                      {incompatibleCatalogBlocks.length > 0 ? (
                        <optgroup label="No compatibles">
                          {incompatibleCatalogBlocks.map((definition) => (
                            <option
                              key={definition.key}
                              value={definition.key}
                              disabled
                            >
                              {definition.name} ({definition.key})
                            </option>
                          ))}
                        </optgroup>
                      ) : null}
                    </select>
                  </label>

                  <div className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-300">
                    <p>{selectedBlockDefinition.description}</p>
                    <div className="mt-3 grid gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400 md:grid-cols-3">
                      <p>Runtime: {selectedBlockDefinition.key}</p>
                      <p>Necesita: {stringifyCapabilities(selectedBlockDefinition)}</p>
                      <p>Emite: {stringifyOutcomes(selectedBlockDefinition)}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Schema
                    </p>
                    <pre className="mt-2 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-4 text-xs leading-6 text-slate-900 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-100">
                      {JSON.stringify(selectedBlockDefinition.schema, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Ejemplo
                    </p>
                    <pre className={codePanelClassName}>
                      {JSON.stringify(selectedBlockDefinition.example, null, 2)}
                    </pre>
                  </div>
                </div>
              </article>
            ) : null}
          </div>
        </details>

        <details className={sectionClassName}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <div className="text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                Media
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                CDN bridge y media dictionary
              </h2>
            </div>
            <ChevronDown className="h-5 w-5 text-slate-500 dark:text-slate-400" />
          </summary>

          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {requiredMediaKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (mediaRows.some((row) => row.key.trim() === key)) {
                      return;
                    }
                    onAddMediaRow(key);
                  }}
                  disabled={uploadingRowIndex !== null}
                  className="inline-flex items-center gap-2 rounded-full border border-app-border bg-app-card px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-app-text-muted transition hover:border-app-border-strong hover:bg-app-surface-muted"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {key}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto rounded-[1.5rem] border border-slate-200 dark:border-white/10">
              <table className="min-w-[56rem] table-fixed divide-y divide-slate-200 text-left dark:divide-app-border">
                <colgroup>
                  <col className="w-40" />
                  <col className="w-[28rem]" />
                  <col className="w-28" />
                  <col className="w-56" />
                </colgroup>
                <thead className="bg-slate-100 dark:bg-slate-950/70">
                  <tr className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">Key</th>
                    <th className="px-4 py-3">URL</th>
                    <th className="px-4 py-3">Preview</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white/80 dark:divide-white/10 dark:bg-slate-900/70">
                  {mediaRows.map((row, index) => (
                    <tr key={`${row.key}-${index}`}>
                      <td className="px-4 py-3 align-top">
                        <input
                          value={row.key}
                          onChange={(event) =>
                            onMediaRowChange(index, { key: event.target.value })
                          }
                          placeholder="hero"
                          disabled={uploadingRowIndex !== null}
                          className={inputClassName}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <input
                          value={row.value}
                          onChange={(event) =>
                            onMediaRowChange(index, {
                              value: event.target.value,
                            })
                          }
                          placeholder="https://cdn.kuruk.in/funnels/..."
                          disabled={uploadingRowIndex !== null}
                          className={`${inputClassName} w-full`}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        {isAbsoluteHttpUrl(row.value) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.value}
                            alt={row.key || `preview-${index}`}
                            className="h-16 w-16 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
                            <Link2 className="h-4 w-4" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onUploadMediaClick(index)}
                            disabled={uploadingRowIndex !== null}
                            className={secondaryButtonClassName}
                          >
                            <ImagePlus className="h-4 w-4" />
                            {uploadingRowIndex === index
                              ? "Subiendo..."
                              : "Subir a CDN"}
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveMediaRow(index)}
                            disabled={uploadingRowIndex !== null}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-red-500/20 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-500/10 dark:bg-slate-900 dark:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                            Quitar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs leading-6 text-slate-500 dark:text-slate-400">
                El media dictionary acepta URLs absolutas del CDN de
                Leadflow/MinIO y mantiene compatibilidad con{" "}
                <code>leadflow-media-resolver.ts</code>.
              </div>
              <button
                type="button"
                onClick={() => onAddMediaRow()}
                disabled={uploadingRowIndex !== null}
                className={secondaryButtonClassName}
              >
                <ImagePlus className="h-4 w-4" />
                Agregar fila
              </button>
            </div>

            {mediaValidation ? (
              <p className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {mediaValidation}
              </p>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-400">
                Llaves sugeridas listas:{" "}
                {mediaMapKeys.join(", ") ||
                  "todavía faltan hero, product_box, gallery_1 y seo_cover"}
                .
              </p>
            )}
          </div>
        </details>
      </div>

      <button
        type="button"
        onClick={() => setIsHelpOpen(true)}
        className="fixed bottom-5 right-20 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/25 bg-white/90 text-cyan-700 shadow-lg shadow-slate-200/50 backdrop-blur transition hover:bg-cyan-50 dark:bg-slate-900/90 dark:text-cyan-200 dark:shadow-slate-950/30 dark:hover:bg-slate-800"
        aria-label="Abrir ayuda rápida del editor"
      >
        <CircleHelp className="h-4 w-4" />
      </button>

      {isHelpOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-end bg-slate-900/20 p-4 backdrop-blur-sm md:items-start dark:bg-slate-950/40">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-200/50 dark:border-white/10 dark:bg-slate-900 dark:shadow-slate-950/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Ayuda rápida
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Tips del JSON engine
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-4 text-sm leading-6 text-slate-600 dark:text-slate-300">
              <p>
                Usa <code>lead_capture_form</code> si quieres disparar la captura
                nativa con <code>#public-capture-form</code>.
              </p>
              <p>
                El bloque <code>grand_slam_offer</code> puede abrir el formulario
                nativo sin tener que cablear un drawer extra.
              </p>
              <p>
                Para arrancar rápido, mapea primero <code>hero</code>,{" "}
                <code>product_box</code>, <code>gallery_1</code> y{" "}
                <code>seo_cover</code>.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {historyPanel?.isOpen ? (
        <ModalShell
          eyebrow="Historial del Paso"
          title={historyPanel.title ?? "Historial de versiones"}
          description="Restaura cualquier snapshot al borrador actual. No guardamos en base de datos hasta que confirmes con el botón final del editor."
          onClose={historyPanel.onClose}
        >
          {historyPanel.isLoading ? (
            <div className="rounded-[1.5rem] border border-app-border bg-app-surface-muted px-5 py-6 text-sm text-app-text-muted">
              Cargando versiones guardadas...
            </div>
          ) : historyPanel.errorMessage ? (
            <div className="rounded-[1.5rem] border border-app-danger-border bg-app-danger-bg px-5 py-6 text-sm text-app-danger-text">
              {historyPanel.errorMessage}
            </div>
          ) : historyPanel.versions.length === 0 ? (
            <div className="rounded-[1.5rem] border border-app-border bg-app-surface-muted px-5 py-6 text-sm text-app-text-muted">
              Todavía no hay versiones previas guardadas para este paso.
            </div>
          ) : (
            <div className="space-y-3">
              {historyPanel.versions.map((version, index) => {
                const createdAtLabel = new Date(version.createdAt).toLocaleString();

                return (
                  <div
                    key={version.id}
                    className="flex flex-col gap-3 rounded-[1.5rem] border border-app-border bg-app-card px-4 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-app-text">
                        {`Versión ${historyPanel.versions.length - index}`}
                      </p>
                      <p className="mt-1 text-sm text-app-text-muted">
                        {createdAtLabel}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-app-text-soft">
                        {version.createdBy?.trim()
                          ? `Autor: ${version.createdBy}`
                          : "Autor no disponible"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => historyPanel.onRestore(version.id)}
                      className={secondaryButtonClassName}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Restaurar
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </ModalShell>
      ) : null}
    </>
  );
}
