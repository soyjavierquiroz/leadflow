"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import CodeMirror from "@uiw/react-codemirror";
import { json } from "@codemirror/lang-json";
import {
  Check,
  ChevronDown,
  FileJson,
  Globe,
  ImagePlus,
  Link2,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";

import { SectionHeader } from "@/components/app-shell/section-header";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import type {
  DomainRecord,
  FunnelTemplateRecord,
} from "@/lib/app-shell/types";
import { uploadFileWithPresignedUrl } from "@/lib/storage";
import { teamOperationRequest } from "@/lib/team-operations";

const primaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const sectionClassName =
  "rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-6";

const requiredMediaKeys = ["hero", "product_box", "gallery_1", "seo_cover"] as const;

const defaultBlocksSeed = JSON.stringify(
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
          step_text: "Marca contornos de mejilla, cuello y patillas con máxima visibilidad.",
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
          item_description: "La herramienta principal para perfilar y detallar.",
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

const defaultMediaRows = requiredMediaKeys.map((key) => ({
  key,
  value: "",
}));

type MediaRow = {
  key: string;
  value: string;
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
  seo: {
    title: string;
    metaDescription: string;
  };
};

type TeamVslPublicationEditorProps = {
  domains: DomainRecord[];
  templates: FunnelTemplateRecord[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isAbsoluteHttpUrl = (value: string) => /^https?:\/\//i.test(value.trim());

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildTemplateOptions = (templates: FunnelTemplateRecord[]) => {
  return [...templates].sort((left, right) => {
    const leftPriority =
      left.name === "VexerCore Pro (Split 50/50)" || left.code === "vexercore-pro-split-50-50"
        ? 0
        : 1;
    const rightPriority =
      right.name === "VexerCore Pro (Split 50/50)" || right.code === "vexercore-pro-split-50-50"
        ? 0
        : 1;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.name.localeCompare(right.name);
  });
};

const toMediaRows = (value: unknown) => {
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

export function TeamVslPublicationEditor({
  domains,
  templates,
}: TeamVslPublicationEditorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const publicationId = searchParams.get("publicationId");
  const templateOptions = useMemo(() => buildTemplateOptions(templates), [templates]);
  const activeDomains = useMemo(
    () => domains.filter((domain) => domain.status === "active"),
    [domains],
  );
  const [isPending, startTransition] = useTransition();
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploadingRowIndex, setUploadingRowIndex] = useState<number | null>(null);
  const [currentPublicationId, setCurrentPublicationId] = useState<string | null>(
    publicationId,
  );
  const [funnelName, setFunnelName] = useState("");
  const [selectedDomainId, setSelectedDomainId] = useState(activeDomains[0]?.id ?? "");
  const [pathPrefix, setPathPrefix] = useState("/");
  const [selectedTemplateId, setSelectedTemplateId] = useState(
    templateOptions[0]?.id ?? "",
  );
  const [seoTitle, setSeoTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [blocksText, setBlocksText] = useState(defaultBlocksSeed);
  const [mediaRows, setMediaRows] = useState<MediaRow[]>([...defaultMediaRows]);
  const mediaUploadInputRef = useRef<HTMLInputElement | null>(null);
  const pendingMediaUploadIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (!publicationId) {
      setCurrentPublicationId(null);
      return;
    }

    setIsLoadingExisting(true);
    setErrorMessage(null);

    void teamOperationRequest<HybridPublicationDetail>(
      `/hybrid-funnel-publications/${publicationId}`,
      { method: "GET" },
    )
      .then((payload) => {
        setCurrentPublicationId(payload.publication.id);
        setFunnelName(payload.funnelInstance.name);
        setSelectedDomainId(payload.publication.domainId);
        setPathPrefix(payload.publication.pathPrefix);
        setSelectedTemplateId(payload.funnelInstance.templateId);
        setSeoTitle(payload.seo.title);
        setMetaDescription(payload.seo.metaDescription);
        setBlocksText(JSON.stringify(payload.step.blocksJson, null, 2));
        setMediaRows(toMediaRows(payload.step.mediaMap));
      })
      .catch((error) => {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "No pudimos cargar la publicación híbrida.",
        );
      })
      .finally(() => setIsLoadingExisting(false));
  }, [publicationId]);

  const parsedBlocks = useMemo(() => {
    try {
      const value = JSON.parse(blocksText) as unknown;
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
    isLoadingExisting ||
    uploadingRowIndex !== null ||
    !funnelName.trim() ||
    !selectedDomainId ||
    !selectedTemplateId ||
    !pathPrefix.trim() ||
    Boolean(parsedBlocks.error) ||
    Boolean(mediaValidation);

  const selectedDomain = activeDomains.find((domain) => domain.id === selectedDomainId);
  const selectedTemplate = templateOptions.find(
    (template) => template.id === selectedTemplateId,
  );

  const handleMediaRowChange = (
    index: number,
    patch: Partial<MediaRow>,
  ) => {
    setMediaRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              ...patch,
            }
          : row,
      ),
    );
  };

  const handleAddMediaRow = (key = "") => {
    setMediaRows((current) => [...current, { key, value: "" }]);
  };

  const handleUploadMediaClick = (index: number) => {
    pendingMediaUploadIndexRef.current = index;
    mediaUploadInputRef.current?.click();
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
      const publicUrl = await uploadFileWithPresignedUrl(file, "funnels");
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
          seoTitle: seoTitle.trim(),
          metaDescription: metaDescription.trim(),
          blocksJson: parsedBlocks.value,
          mediaMap,
        };

        const response = currentPublicationId
          ? await teamOperationRequest<HybridPublicationDetail>(
              `/hybrid-funnel-publications/${currentPublicationId}`,
              {
                method: "PATCH",
                body: JSON.stringify(payload),
              },
            )
          : await teamOperationRequest<HybridPublicationDetail>(
              "/hybrid-funnel-publications",
              {
                method: "POST",
                body: JSON.stringify(payload),
              },
            );

        setCurrentPublicationId(response.publication.id);
        setSuccessMessage(
          currentPublicationId
            ? "Funnel híbrido actualizado y publicado."
            : "Funnel híbrido creado, publicado y listo para edición.",
        );
        router.replace(
          `/team/publications/new-vsl?publicationId=${response.publication.id}`,
        );
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
      <input
        ref={mediaUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleMediaUploadChange(event)}
      />

      <SectionHeader
        eyebrow="Team Admin / Publicaciones híbridas"
        title="Crear o editar funnel VSL/Landing"
        description="Gestiona el blocksJson y el mediaMap como dos capas separadas del assembly engine. Guardamos la instancia, el landing step y la publicación activa en una sola transacción."
        actions={
          <>
            <Link href="/team/publications" className={secondaryButtonClassName}>
              Volver a publicaciones
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

      {errorMessage ? <OperationBanner tone="error" message={errorMessage} /> : null}
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
                {parsedBlocks.value ? `${parsedBlocks.value.length} bloques listos` : "Corrige el JSON"}
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
                Publicación
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                {selectedDomain ? `${selectedDomain.host}${pathPrefix}` : "Selecciona dominio y ruta"}
              </p>
            </div>
          </div>
        </article>
      </section>

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
                Para VSL híbrido recomendamos arrancar con{" "}
                <code>hero</code>, <code>product_box</code>,{" "}
                <code>gallery_1</code> y <code>seo_cover</code>.
              </p>
            </div>
          </article>
        </div>
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
              Código interno sugerido: {slugify(funnelName || "nuevo-funnel") || "nuevo-funnel"}
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
              {templateOptions.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
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

      <details open className={sectionClassName}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Bloques
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              JSON engine del funnel
            </h2>
          </div>
          <ChevronDown className="h-5 w-5 text-slate-400" />
        </summary>

        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-700">
              <FileJson className="h-3.5 w-3.5" />
              CodeMirror JSON
            </span>
            <span className="text-xs leading-5 text-slate-500">
              El guardado solo se habilita si el contenido es un JSON Array válido.
            </span>
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
              onChange={(value) => setBlocksText(value)}
            />
          </div>

          {parsedBlocks.error ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {parsedBlocks.error}
            </p>
          ) : (
            <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              JSON válido. El engine detectó un array listo para persistir como `blocksJson`.
            </p>
          )}
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
                  handleAddMediaRow(key);
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
                          handleMediaRowChange(index, { key: event.target.value })
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
                          handleMediaRowChange(index, { value: event.target.value })
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
                          onClick={() => handleUploadMediaClick(index)}
                          disabled={uploadingRowIndex !== null}
                          className={secondaryButtonClassName}
                        >
                          <ImagePlus className="h-4 w-4" />
                          {uploadingRowIndex === index ? "Subiendo..." : "Subir a CDN"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMediaRows((current) =>
                              current.filter((_, rowIndex) => rowIndex !== index),
                            )
                          }
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
              El media dictionary acepta URLs absolutas del CDN de Leadflow/MinIO y
              mantiene compatibilidad con `leadflow-media-resolver.ts`.
            </div>
            <button
              type="button"
              onClick={() => handleAddMediaRow()}
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
              {requiredMediaKeys
                .filter((key) => Object.prototype.hasOwnProperty.call(mediaMap, key))
                .join(", ") || "todavía faltan hero, product_box, gallery_1 y seo_cover"}.
            </p>
          )}
        </div>
      </details>

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
              El submit crea o actualiza la FunnelInstance, el landing step y la
              FunnelPublication en una transacción, dejando todos los estados en
              `active`.
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
