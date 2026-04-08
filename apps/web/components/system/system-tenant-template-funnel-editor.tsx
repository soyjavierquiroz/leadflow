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
import { uploadFileWithPresignedUrl } from "@/lib/storage";
import type { JsonValue, SystemTenantDetailRecord, SystemTenantFunnelRecord } from "@/lib/system-tenants";
import { authenticatedOperationRequest } from "@/lib/team-operations";

const primaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";

const secondaryButtonClassName =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

const sectionClassName =
  "rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-6";

const isRecord = (value: JsonValue | undefined): value is Record<string, JsonValue> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

type SystemTenantTemplateFunnelEditorProps = {
  tenant: SystemTenantDetailRecord;
  funnel: SystemTenantFunnelRecord;
};

export function SystemTenantTemplateFunnelEditor({
  tenant,
  funnel,
}: SystemTenantTemplateFunnelEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [uploadingRowIndex, setUploadingRowIndex] = useState<number | null>(null);
  const [name, setName] = useState(funnel.name);
  const [description, setDescription] = useState(funnel.description ?? "");
  const [blocksText, setBlocksText] = useState(() => {
    const config = isRecord(funnel.config) ? funnel.config : null;
    const blocks = config?.blocks;
    return Array.isArray(blocks)
      ? JSON.stringify(blocks, null, 2)
      : defaultBlocksSeed;
  });
  const [mediaRows, setMediaRows] = useState<MediaRow[]>(() => {
    const config = isRecord(funnel.config) ? funnel.config : null;
    return toMediaRows(config?.mediaMap);
  });
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
      const publicUrl = await uploadFileWithPresignedUrl(file, "funnels", {
        teamId: tenant.id,
      });
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
        const currentConfig = isRecord(funnel.config) ? funnel.config : {};
        const payload = {
          name: name.trim(),
          description: description.trim() || null,
          config: {
            ...currentConfig,
            blocks: parsedBlocks.value,
            mediaMap,
          },
        };

        await authenticatedOperationRequest<SystemTenantFunnelRecord>(
          `/system/tenants/${encodeURIComponent(tenant.id)}/funnels/${encodeURIComponent(funnel.id)}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );

        setSuccessMessage("Funnel del tenant actualizado.");
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "No pudimos guardar el funnel del tenant.",
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={`Super Admin / Tenant / ${tenant.code} / Template Funnel`}
        title={`Editor de ${funnel.name}`}
        description="Este funnel nació desde el Template Engine global y se edita con el mismo núcleo JSON/media del builder híbrido."
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
              Guardar cambios
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
                Funnel asignado
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                {tenant.name}
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
                Código interno
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                {funnel.code}
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
              Identidad del funnel
            </h2>
          </div>
        </summary>

        <div className="mt-6 grid gap-5">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-900">
              Nombre del funnel
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
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
              rows={4}
              className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
            />
          </label>
        </div>
      </details>

      <HybridJsonMediaEditor
        blocksText={blocksText}
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
    </div>
  );
}
