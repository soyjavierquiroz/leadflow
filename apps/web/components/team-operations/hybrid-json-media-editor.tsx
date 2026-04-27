"use client";

import {
  useEffect,
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
  Check,
  ChevronDown,
  Copy,
  FileJson,
  History,
  ImagePlus,
  Link2,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
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

const sectionClassName =
  "rounded-[2rem] border border-app-border bg-app-card p-6 text-left text-app-text shadow-[var(--ai-panel-shadow)] md:p-8";

const secondaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full border border-app-border bg-app-card px-4 py-2.5 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-60";

const scaffoldButtonClassName =
  "inline-flex min-h-28 w-full items-start justify-between gap-4 rounded-[1.75rem] border border-app-border bg-app-card px-5 py-4 text-left text-app-text shadow-sm transition hover:-translate-y-0.5 hover:border-app-border-strong hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-60";

const inputClassName =
  "w-full rounded-xl border border-app-border bg-app-card px-3 py-2 text-sm text-app-text outline-none transition placeholder:text-app-text-soft focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft";

const codePanelClassName =
  "overflow-x-auto rounded-2xl border border-app-border bg-app-surface-muted p-4 text-xs leading-6 text-app-text";

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
      headline: "Perfila tu barba en minutos con la DRAGON VINTAGE T9®",
      subheadline:
        "Consigue una barba limpia, definida y con acabado profesional sin salir de casa.",
      primary_benefit_bullets: [
        "Define contornos con precisión profesional",
        "Reduce volumen y da forma en pocos minutos",
        "Cuchillas de alta precisión para cortes uniformes",
      ],
      price_anchor_text: "precio regular",
      price_main_text: "ver precio especial",
      primary_cta_text: "quiero mi dragon t9 ahora",
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

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

  const [selectedBlockKey, setSelectedBlockKey] = useState(
    catalogBlocks[0]?.key ?? "",
  );
  const [copiedRoutingPath, setCopiedRoutingPath] = useState<string | null>(null);
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

    const hasCurrentSelection = catalogBlocks.some(
      (definition) => definition.key === selectedBlockKey,
    );

    if (!hasCurrentSelection) {
      setSelectedBlockKey(catalogBlocks[0]?.key ?? "");
    }
  }, [catalogBlocks, selectedBlockKey]);

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

  const handleInsertBlockExample = (definition: BuilderBlockDefinition) => {
    const nextArray = (() => {
      try {
        const parsed = JSON.parse(blocksText) as unknown;
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();

    onBlocksTextChange(
      JSON.stringify([...nextArray, definition.example], null, 2),
    );
  };

  const selectedBlockDefinition =
    catalogBlocks.find((definition) => definition.key === selectedBlockKey) ??
    catalogBlocks[0] ??
    null;

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

  const handleInjectScaffold = (value: string) => {
    onBlocksTextChange(value);
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

  return (
    <>
      <input
        ref={mediaUploadInputRef}
        type="file"
        accept={FUNNEL_ASSET_IMAGE_ACCEPT}
        className="hidden"
        onChange={(event) => void onMediaUploadChange(event)}
      />

      <section className={sectionClassName}>
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-[1.5rem] border border-app-warning-border bg-app-warning-bg p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-warning-text">
              Ayuda rápida / blocksJson
            </p>
            <h2 className="mt-2 text-xl font-semibold text-app-text">
              Cómo abrir la captación nativa
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-6 text-app-text-muted">
              <p>
                Usa un bloque <code>lead_capture_form</code> si quieres que los
                CTAs comerciales salten al formulario nativo con la ancla
                <code>#public-capture-form</code>.
              </p>
              <p>
                Si prefieres un drawer lateral, el bloque{" "}
                <code>grand_slam_offer</code> ya abre{" "}
                <code>PublicCaptureForm</code> automáticamente con el CTA
                principal.
              </p>
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-app-border bg-app-accent-soft p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-accent">
              Ayuda rápida / mediaMap
            </p>
            <h2 className="mt-2 text-xl font-semibold text-app-text">
              Qué llaves conviene mapear
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-6 text-app-text-muted">
              <p>
                Sube los assets directo al CDN desde cada fila y deja{" "}
                <code>mediaMap</code> solo como diccionario final de URLs
                públicas.
              </p>
              <p>
                Para VSL híbrido recomendamos arrancar con <code>hero</code>,{" "}
                <code>product_box</code>, <code>gallery_1</code> y{" "}
                <code>seo_cover</code>.
              </p>
            </div>
          </article>
        </div>
      </section>

      <div className="space-y-6">
        <details open className={sectionClassName}>
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-text-soft">
                Bloques
              </p>
              {stepSwitcher ? (
                <div className="mt-2 space-y-3">
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
                                ? "inline-flex items-center justify-center rounded-full bg-app-text px-4 py-2.5 text-sm font-semibold text-app-bg transition disabled:cursor-not-allowed disabled:opacity-60"
                                : "inline-flex items-center justify-center rounded-full border border-app-border bg-app-card px-4 py-2.5 text-sm font-semibold text-app-text-muted transition hover:border-app-border-strong hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
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
                    <p className="text-sm text-app-text-muted">
                      {stepSwitcher.helperText}
                    </p>
                  ) : null}
                </div>
              ) : (
                <h2 className="mt-2 text-2xl font-semibold text-app-text">
                  JSON engine del funnel
                </h2>
              )}
            </div>
            <ChevronDown className="h-5 w-5 text-app-text-soft" />
          </summary>

          <div className="mt-6 space-y-4">
            {stepSwitcher?.warningText ? (
              <p className="rounded-2xl border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm text-app-warning-text">
                {stepSwitcher.warningText}
              </p>
            ) : null}

            {stepSpecificSettingsPanel}

            {routingReference && routingReference.items.length > 0 ? (
              <article className="rounded-[1.5rem] border border-app-border bg-app-accent-soft p-6 text-left">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="text-left">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-accent">
                      {routingReference.title}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-app-text">
                      URLs disponibles para redirección
                    </h3>
                    {routingReference.helperText ? (
                      <p className="mt-2 text-sm leading-6 text-app-text-muted">
                        {routingReference.helperText}
                      </p>
                    ) : null}
                  </div>
                  <span className="inline-flex items-center rounded-full bg-app-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-app-accent ring-1 ring-app-border">
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
                        className="flex flex-col gap-3 rounded-2xl border border-app-border bg-app-card px-4 py-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-app-text">
                              {item.label}
                            </p>
                            {item.badge ? (
                              <span className="inline-flex items-center rounded-full bg-app-surface-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                                {item.badge}
                              </span>
                            ) : null}
                          </div>
                          <code className="mt-2 block overflow-x-auto rounded-xl border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text">
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
                      </div>
                    );
                  })}
                </div>
              </article>
            ) : null}

            <div className="mb-2 flex w-full items-center justify-between gap-3 border-b border-app-border pb-2">
              <div className="flex min-w-0 flex-1 flex-col justify-start gap-1 text-left">
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-app-surface-muted px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-app-text-muted">
                  <FileJson className="h-3.5 w-3.5" />
                  CodeMirror JSON
                </span>
                <p className="text-sm font-semibold text-app-text">
                  Codigo JSON
                </p>
                <span className="text-xs leading-5 text-app-text-soft">
                  El guardado solo se habilita si el contenido es un JSON Array
                  válido.
                </span>
              </div>

              {historyPanel || previewDraftKey ? (
                <div className="flex flex-wrap justify-end gap-3">
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
              ) : null}
            </div>

            {editorContext ? (
              <div className="sticky top-4 z-10 rounded-[1.5rem] border border-app-warning-border bg-app-warning-bg shadow-sm backdrop-blur">
                <div className="flex w-full items-center justify-start px-4 py-3 text-left">
                  <span className="mr-3 shrink-0 text-base leading-none text-app-warning-text">
                    ⚠️
                  </span>
                  <p className="text-sm font-semibold text-app-warning-text">
                    {`EDITANDO BORRADOR: ${editorContext.stepName} | Ruta: ${editorContext.stepPath}`}
                  </p>
                </div>
              </div>
            ) : null}

            {isBlankCanvas ? (
              <div className="rounded-[1.75rem] border border-dashed border-app-warning-border bg-[linear-gradient(180deg,var(--app-warning-bg)_0%,var(--app-card)_100%)] p-6 text-left">
                <div className="flex flex-col gap-5">
                  <div className="max-w-2xl space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-warning-text">
                      Lienzo en blanco
                    </p>
                    <h3 className="text-2xl font-semibold text-app-text">
                      Arranca este paso con una estructura segura
                    </h3>
                    <p className="text-sm leading-6 text-app-text-muted">
                      Evita copiar y pegar desde otro paso. Inyecta una base lista para editar y luego ajusta el JSON en CodeMirror.
                    </p>
                  </div>

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
                        <p className="text-sm leading-6 text-app-text-muted">
                          Carga un arranque con <code>hero</code>, <code>video</code> y <code>lead_capture_config</code>.
                        </p>
                      </div>
                      <Sparkles className="mt-1 h-5 w-5 shrink-0 text-app-warning-text" />
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
                        <p className="text-sm leading-6 text-app-text-muted">
                          Carga una base con <code>conversion_page_config</code> y <code>whatsapp_handoff_cta</code>.
                        </p>
                      </div>
                      <Sparkles className="mt-1 h-5 w-5 shrink-0 text-app-success-text" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="leadflow-json-editor overflow-hidden rounded-[1.5rem] border border-app-border bg-app-bg">
                  <CodeMirror
                    value={blocksText}
                    height="420px"
                    extensions={[json()]}
                    basicSetup={{
                      lineNumbers: true,
                      foldGutter: true,
                      highlightActiveLine: true,
                    }}
                    onChange={onBlocksTextChange}
                  />
                </div>

                {parsedBlocksError ? (
                  <p className="rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text">
                    {parsedBlocksError}
                  </p>
                ) : (
                  <p className="rounded-2xl border border-app-success-border bg-app-success-bg px-4 py-3 text-sm text-app-success-text">
                    JSON válido. El engine detectó {parsedBlocksCount} bloque
                    {parsedBlocksCount === 1 ? "" : "s"} listo
                    {parsedBlocksCount === 1 ? "" : "s"} para persistir como{" "}
                    <code>blocksJson</code>.
                  </p>
                )}
              </>
            )}

            {selectedBlockDefinition ? (
              <article className="rounded-[1.5rem] border border-app-border bg-app-surface-muted p-6 text-left">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="text-left">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-app-text-soft">
                      Catálogo / {selectedBlockDefinition.category}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-app-text">
                      {selectedBlockDefinition.name}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-app-text-muted">
                      {catalogBlocks.length} bloque
                      {catalogBlocks.length === 1 ? "" : "s"} disponible
                      {catalogBlocks.length === 1 ? "" : "s"} en el arsenal
                      JSON.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleInsertBlockExample(selectedBlockDefinition)
                    }
                    className={secondaryButtonClassName}
                  >
                    <Plus className="h-4 w-4" />
                    Insertar bloque
                  </button>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,20rem)_1fr] lg:items-start">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-app-text-muted">
                      Selector de bloque
                    </span>
                    <select
                      value={selectedBlockDefinition.key}
                      onChange={(event) => setSelectedBlockKey(event.target.value)}
                      className="w-full rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm font-medium text-app-text shadow-sm outline-none transition focus:border-app-accent focus:ring-2 focus:ring-app-accent-soft"
                    >
                      {catalogBlocks.map((definition) => (
                        <option key={definition.key} value={definition.key}>
                          {definition.name} ({definition.key})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-2xl border border-app-border bg-app-card px-4 py-3 text-sm leading-6 text-app-text-muted">
                    <p>{selectedBlockDefinition.description}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-app-text-soft">
                      Clave runtime: {selectedBlockDefinition.key}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-app-text-soft">
                      Schema
                    </p>
                    <pre className="mt-2 overflow-x-auto rounded-2xl border border-app-border bg-app-bg p-4 text-xs leading-6 text-app-text">
                      {JSON.stringify(selectedBlockDefinition.schema, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-app-text-soft">
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

        <details open className={sectionClassName}>
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-text-soft">
                Media
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-app-text">
                CDN bridge y media dictionary
              </h2>
            </div>
            <ChevronDown className="h-5 w-5 text-app-text-soft" />
          </summary>

          <div className="mt-6 space-y-4">
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

            <div className="overflow-x-auto rounded-[1.5rem] border border-app-border">
              <table className="min-w-full divide-y divide-app-border text-left">
                <thead className="bg-app-surface-muted">
                  <tr className="text-xs font-semibold uppercase tracking-[0.22em] text-app-text-soft">
                    <th className="px-4 py-3">Key</th>
                    <th className="px-4 py-3">URL</th>
                    <th className="px-4 py-3">Preview</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border bg-app-card">
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
                          className={`${inputClassName} min-w-72`}
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
                          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-app-border text-xs text-app-text-soft">
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
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-app-danger-border bg-app-card px-4 py-2.5 text-sm font-semibold text-app-danger-text transition hover:bg-app-danger-bg"
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
              <div className="text-xs leading-6 text-app-text-soft">
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
              <p className="rounded-2xl border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm text-app-danger-text">
                {mediaValidation}
              </p>
            ) : (
              <p className="rounded-2xl border border-app-border bg-app-surface-muted px-4 py-3 text-sm text-app-text-muted">
                Llaves sugeridas listas:{" "}
                {mediaMapKeys.join(", ") ||
                  "todavía faltan hero, product_box, gallery_1 y seo_cover"}
                .
              </p>
            )}
          </div>
        </details>
      </div>

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
