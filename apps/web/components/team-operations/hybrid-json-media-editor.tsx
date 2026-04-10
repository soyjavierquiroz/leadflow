"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import Link from "next/link";
import {
  ChevronDown,
  FileJson,
  ImagePlus,
  Link2,
  Plus,
  Trash2,
} from "lucide-react";
import {
  buildMediaMap,
  writeHybridJsonPreviewDraft,
} from "@/components/team-operations/hybrid-json-preview-state";
import {
  defaultBuilderBlockDefinitions,
  type BuilderBlockDefinition,
} from "@/lib/blocks/registry";
import { FUNNEL_ASSET_IMAGE_ACCEPT } from "@/lib/media-optimizer";

const sectionClassName =
  "rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-6";

const secondaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

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
  previewHref?: string | null;
  availableBlocks?: BuilderBlockDefinition[];
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
  previewHref = null,
  availableBlocks = defaultBuilderBlockDefinitions,
  stepSwitcher = null,
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

  useEffect(() => {
    writeHybridJsonPreviewDraft({
      blocks: blocksText,
      media: buildMediaMap(mediaRows),
    });
  }, [blocksText, mediaRows]);

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
          <article className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
              Ayuda rápida / blocksJson
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Cómo abrir la captación nativa
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
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

          <article className="rounded-[1.5rem] border border-sky-200 bg-sky-50 px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
              Ayuda rápida / mediaMap
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              Qué llaves conviene mapear
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
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
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
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
                                ? "inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                                : "inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            }
                          >
                            {tab.label}
                          </button>
                        );
                      })}
                    </div>

                    {stepSwitcher.badge ? (
                      <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 ring-1 ring-slate-200">
                        {stepSwitcher.badge}
                      </span>
                    ) : null}
                  </div>

                  {stepSwitcher.helperText ? (
                    <p className="text-sm text-slate-600">
                      {stepSwitcher.helperText}
                    </p>
                  ) : null}
                </div>
              ) : (
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  JSON engine del funnel
                </h2>
              )}
            </div>
            <ChevronDown className="h-5 w-5 text-slate-400" />
          </summary>

          <div className="mt-6 space-y-4">
            {stepSwitcher?.warningText ? (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {stepSwitcher.warningText}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-700">
                  <FileJson className="h-3.5 w-3.5" />
                  CodeMirror JSON
                </span>
                <span className="text-xs leading-5 text-slate-500">
                  El guardado solo se habilita si el contenido es un JSON Array
                  válido.
                </span>
              </div>

              {previewHref ? (
                <Link
                  href={previewHref}
                  target="_blank"
                  rel="noreferrer"
                  className={secondaryButtonClassName}
                >
                  👀 Ver Vista Previa
                </Link>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-[1.5rem] border border-slate-200">
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
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {parsedBlocksError}
              </p>
            ) : (
              <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                JSON válido. El engine detectó {parsedBlocksCount} bloque
                {parsedBlocksCount === 1 ? "" : "s"} listo
                {parsedBlocksCount === 1 ? "" : "s"} para persistir como{" "}
                <code>blocksJson</code>.
              </p>
            )}

            {selectedBlockDefinition ? (
              <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Catálogo / {selectedBlockDefinition.category}
                    </p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-950">
                      {selectedBlockDefinition.name}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
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
                    <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Selector de bloque
                    </span>
                    <select
                      value={selectedBlockDefinition.key}
                      onChange={(event) => setSelectedBlockKey(event.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 shadow-sm outline-none transition focus:border-slate-400"
                    >
                      {catalogBlocks.map((definition) => (
                        <option key={definition.key} value={definition.key}>
                          {definition.name} ({definition.key})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
                    <p>{selectedBlockDefinition.description}</p>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Clave runtime: {selectedBlockDefinition.key}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Schema
                    </p>
                    <pre className="mt-2 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                      {JSON.stringify(selectedBlockDefinition.schema, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                      Ejemplo
                    </p>
                    <pre className="mt-2 overflow-x-auto rounded-2xl bg-white p-4 text-xs leading-6 text-slate-700 ring-1 ring-slate-200">
                      {JSON.stringify(selectedBlockDefinition.example, null, 2)}
                    </pre>
                  </div>
                </div>
              </article>
            ) : null}
          </div>
        </details>

        <details open className={sectionClassName}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Media
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                CDN bridge y media dictionary
              </h2>
            </div>
            <ChevronDown className="h-5 w-5 text-slate-400" />
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
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-700 transition hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {key}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto rounded-[1.5rem] border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left">
                <thead className="bg-slate-50">
                  <tr className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    <th className="px-4 py-3">Key</th>
                    <th className="px-4 py-3">URL</th>
                    <th className="px-4 py-3">Preview</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
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
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-slate-950"
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
                          className="w-full min-w-72 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-slate-950"
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
                          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400">
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
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
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
              <div className="text-xs leading-6 text-slate-500">
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
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {mediaValidation}
              </p>
            ) : (
              <p className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Llaves sugeridas listas:{" "}
                {mediaMapKeys.join(", ") ||
                  "todavía faltan hero, product_box, gallery_1 y seo_cover"}
                .
              </p>
            )}
          </div>
        </details>
      </div>
    </>
  );
}
