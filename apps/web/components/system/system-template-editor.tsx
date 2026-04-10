"use client";

import { type ChangeEvent, useMemo, useRef, useState, useTransition } from "react";
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
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { optimizeFunnelAssetImage } from "@/lib/media-optimizer";
import { uploadFileWithPresignedUrl } from "@/lib/storage";
import type { SystemTemplateRecord } from "@/lib/system-tenants";
import { authenticatedOperationRequest } from "@/lib/team-operations";

const primaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const sectionClassName =
  "rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-6";

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

type SystemTemplateEditorProps = {
  initialTemplate?: SystemTemplateRecord | null;
};

export function SystemTemplateEditor({
  initialTemplate = null,
}: SystemTemplateEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploadingRowIndex, setUploadingRowIndex] = useState<number | null>(null);
  const [name, setName] = useState(initialTemplate?.name ?? "");
  const [description, setDescription] = useState(initialTemplate?.description ?? "");
  const [blocksText, setBlocksText] = useState(
    initialTemplate ? JSON.stringify(initialTemplate.blocks, null, 2) : defaultBlocksSeed,
  );
  const [mediaRows, setMediaRows] = useState<MediaRow[]>(
    toMediaRows(initialTemplate?.mediaMap),
  );
  const mediaUploadInputRef = useRef<HTMLInputElement | null>(null);
  const pendingMediaUploadIndexRef = useRef<number | null>(null);

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
    Boolean(mediaValidation);

  const handleMediaRowChange = (index: number, patch: Partial<MediaRow>) => {
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
      const optimizedFile = await optimizeFunnelAssetImage(file);
      const publicUrl = await uploadFileWithPresignedUrl(
        optimizedFile,
        "funnels",
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
    if (!parsedBlocks.value) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const payload = {
          name: name.trim(),
          description: description.trim() || null,
          blocks: parsedBlocks.value,
          mediaMap,
        };

        const record = await authenticatedOperationRequest<SystemTemplateRecord>(
          initialTemplate
            ? `/system/templates/${encodeURIComponent(initialTemplate.id)}`
            : "/system/templates",
          {
            method: initialTemplate ? "PATCH" : "POST",
            body: JSON.stringify(payload),
          },
        );

        setSuccessMessage(
          initialTemplate
            ? "Template global actualizado."
            : "Template global creado y listo para despliegue.",
        );

        if (!initialTemplate) {
          router.replace(`/admin/templates/${encodeURIComponent(record.id)}/edit`);
          router.refresh();
          return;
        }

        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "No pudimos guardar el template.",
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={
          initialTemplate
            ? `Super Admin / Templates / ${initialTemplate.code}`
            : "Super Admin / Templates / Nuevo"
        }
        title={initialTemplate ? "Editar template global" : "Nuevo template global"}
        description="Esta vista reutiliza el editor híbrido real para que el catálogo de templates comparta exactamente el mismo lenguaje de blocks JSON y CDN bridge que los funnels operativos."
        actions={
          <>
            <Link href="/admin/templates" className={secondaryButtonClassName}>
              Volver al catálogo
            </Link>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaveDisabled}
              className={primaryButtonClassName}
            >
              <Save className="h-4 w-4" />
              {initialTemplate ? "Guardar cambios" : "Crear template"}
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
                Estado del builder
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                {initialTemplate ? "Template persistido" : "Borrador local"}
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
              <Check className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Código sugerido
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                {slugify(name || "nuevo-template") || "nuevo-template"}
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
              Identidad del template
            </h2>
          </div>
        </summary>

        <div className="mt-6 grid gap-5">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-900">
              Nombre del template
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Plantilla Global Captación VSL"
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-900">
              Descripción
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe el tipo de oferta, vertical o caso de uso para este template."
              rows={4}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
            />
          </label>
        </div>
      </details>

      <HybridJsonMediaEditor
        blocksText={blocksText}
        previewHref="/admin/preview"
        onBlocksTextChange={setBlocksText}
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
          setMediaRows((current) =>
            current.filter((_, rowIndex) => rowIndex !== index),
          )
        }
      />

      <section className={sectionClassName}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Persistencia
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Catálogo global listo
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              El guardado persiste nombre, descripción, blocks y mediaMap para que
              luego puedas desplegar el template directamente a cualquier tenant.
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
                {initialTemplate ? "Guardar cambios" : "Crear template"}
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
