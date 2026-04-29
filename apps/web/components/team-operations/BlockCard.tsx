"use client";

import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import {
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import type { BuilderBlockDefinition } from "@/lib/blocks/registry";
import type { JsonValue } from "@/lib/public-funnel-runtime.types";
import { SmartWiringService } from "../../../../packages/shared/funnel-orchestrator/src";

type BlockRecord = Record<string, JsonValue | undefined> & {
  type?: string;
  key?: string;
  block_id?: string;
  is_hidden?: boolean;
};

export type ComposerDestination = {
  value: string;
  label: string;
  kind: "route" | "block" | "action";
};

type BlockCardProps = {
  block: BlockRecord;
  blockId: string;
  definition: BuilderBlockDefinition | null;
  fallbackName: string;
  icon: LucideIcon;
  stepType?: string | null;
  destinations: ComposerDestination[];
  onPatch: (patch: Partial<BlockRecord>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleHidden: () => void;
};

type NestedFieldConfig = {
  path: string[];
  label: string;
  fallbackKeys: string[];
};

type EditableScalarField = {
  path: string[];
  label: string;
  placeholder: string;
  value: string | number | boolean;
  kind: "scalar";
};

type EditableJsonField = {
  path: string[];
  label: string;
  value: JsonValue;
  kind: "json";
};

type EditableField = EditableScalarField | EditableJsonField;

const fieldLabel = (key: string) =>
  key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const fieldLabelFromPath = (path: string[]) => path.map(fieldLabel).join(" / ");

const isRecord = (value: unknown): value is Record<string, JsonValue> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isEditableScalar = (value: unknown) =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

const isSmartDestinationField = (key: string) => {
  const normalized = key.toLowerCase();

  return (
    normalized === "action" ||
    normalized.includes("href") ||
    normalized.includes("redirect") ||
    normalized.includes("url") ||
    normalized.includes("target")
  );
};

const blockTitleFromDefinition = (
  definition: BuilderBlockDefinition | null,
  fallbackName: string,
) => definition?.name ?? fallbackName;

const hookAndPromiseContentFields: NestedFieldConfig[] = [
  {
    path: ["content", "top_bar"],
    label: "TOP BAR",
    fallbackKeys: ["top_bar", "eyebrow_text", "eyebrow"],
  },
  {
    path: ["content", "headline"],
    label: "HEADLINE",
    fallbackKeys: ["headline", "title", "hook"],
  },
  {
    path: ["content", "hook_text"],
    label: "HOOK TEXT",
    fallbackKeys: ["hook_text", "hookText"],
  },
  {
    path: ["content", "subheadline"],
    label: "SUBHEADLINE",
    fallbackKeys: ["subheadline", "description", "promise"],
  },
  {
    path: ["content", "proof_header"],
    label: "PROOF HEADER",
    fallbackKeys: ["proof_header", "proofHeader"],
  },
  {
    path: ["content", "urgency_box", "text"],
    label: "URGENCY TEXT",
    fallbackKeys: ["urgency_text", "urgencyText", "note"],
  },
  {
    path: ["content", "urgency_box", "mechanism"],
    label: "URGENCY MECHANISM",
    fallbackKeys: [],
  },
  {
    path: ["content", "cta_button_text"],
    label: "PRIMARY CTA TEXT",
    fallbackKeys: ["label", "cta_text", "primary_cta_text"],
  },
  {
    path: ["content", "cta_lead_in"],
    label: "CTA LEAD IN",
    fallbackKeys: ["cta_lead_in", "ctaLeadIn"],
  },
  {
    path: ["content", "cta_footer"],
    label: "HELPER TEXT",
    fallbackKeys: ["cta_microcopy", "helper_text", "footer_note"],
  },
];

const omittedRootKeys = new Set(["type", "block_id", "is_boxed"]);
const omittedHookAndPromisePaths = new Set(
  hookAndPromiseContentFields.map((field) => field.path.join(".")),
);

const getValueAtPath = (value: unknown, path: string[]) => {
  let current: unknown = value;

  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[segment];
  }

  return current;
};

const setValueAtPath = (
  record: Record<string, JsonValue | undefined>,
  path: string[],
  nextValue: JsonValue,
): Record<string, JsonValue | undefined> => {
  const [head, ...tail] = path;

  if (!head) {
    return record;
  }

  if (tail.length === 0) {
    return {
      ...record,
      [head]: nextValue,
    };
  }

  const currentChild = isRecord(record[head]) ? record[head] : {};

  return {
    ...record,
    [head]: setValueAtPath(currentChild, tail, nextValue),
  } as Record<string, JsonValue | undefined>;
};

const buildEditableFields = ({
  schemaValue,
  exampleValue,
  currentValue,
  path = [],
  skipPaths,
}: {
  schemaValue?: JsonValue;
  exampleValue?: JsonValue;
  currentValue?: unknown;
  path?: string[];
  skipPaths?: Set<string>;
}): EditableField[] => {
  const pathKey = path.join(".");

  if (skipPaths?.has(pathKey)) {
    return [];
  }

  if (path.length > 0) {
    if (
      Array.isArray(schemaValue) ||
      Array.isArray(exampleValue) ||
      Array.isArray(currentValue)
    ) {
      return [
        {
          path,
          label: fieldLabelFromPath(path),
          value:
            (currentValue ??
              exampleValue ??
              schemaValue ??
              ([] as JsonValue[])) as JsonValue,
          kind: "json",
        },
      ];
    }

    const resolvedScalar = currentValue ?? exampleValue ?? schemaValue;

    if (
      isEditableScalar(resolvedScalar) ||
      isSmartDestinationField(path[path.length - 1] ?? "")
    ) {
      return [
        {
          path,
          label: fieldLabelFromPath(path),
          placeholder:
            typeof schemaValue === "string"
              ? schemaValue
              : typeof exampleValue === "string"
                ? exampleValue
                : "",
          value:
            typeof resolvedScalar === "boolean" ||
            typeof resolvedScalar === "number" ||
            typeof resolvedScalar === "string"
              ? resolvedScalar
              : "",
          kind: "scalar",
        },
      ];
    }
  }

  const schemaRecord = isRecord(schemaValue) ? schemaValue : null;
  const exampleRecord = isRecord(exampleValue) ? exampleValue : null;
  const currentRecord = isRecord(currentValue) ? currentValue : null;
  const keys = new Set<string>([
    ...Object.keys(schemaRecord ?? {}),
    ...Object.keys(exampleRecord ?? {}),
    ...Object.keys(currentRecord ?? {}),
  ]);

  return [...keys]
    .filter((key) => (path.length === 0 ? !omittedRootKeys.has(key) : true))
    .flatMap((key) =>
      buildEditableFields({
        schemaValue: schemaRecord?.[key],
        exampleValue: exampleRecord?.[key],
        currentValue: currentRecord?.[key],
        path: [...path, key],
        skipPaths,
      }),
    );
};

export function BlockCard({
  block,
  blockId,
  definition,
  fallbackName,
  icon: Icon,
  stepType,
  destinations,
  onPatch,
  onDuplicate,
  onDelete,
  onToggleHidden,
}: BlockCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: blockId });
  const isCompatible = definition
    ? SmartWiringService.isCompatible(definition, stepType)
    : false;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const definitionSchema = definition?.schema;
  const definitionExample = definition?.example;
  const genericEditableFields = buildEditableFields({
    schemaValue: definitionSchema,
    exampleValue: definitionExample,
    currentValue: block,
    skipPaths:
      block.type === "hook_and_promise" ? omittedHookAndPromisePaths : undefined,
  });
  const nestedEditableEntries =
    block.type === "hook_and_promise" ? hookAndPromiseContentFields : [];

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border bg-white p-4 text-left shadow-sm transition dark:bg-slate-900 ${
        isDragging
          ? "border-cyan-400 shadow-lg shadow-cyan-500/10"
          : "border-slate-200 dark:border-white/10"
      } ${block.is_hidden ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Reordenar bloque"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-700 dark:text-cyan-200">
                <Icon className="h-4 w-4" />
              </span>
              <h3 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                {blockTitleFromDefinition(definition, fallbackName)}
              </h3>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                  isCompatible
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }`}
              >
                {isCompatible ? "Compatible" : "Revisar"}
              </span>
              {block.is_hidden ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  Oculto
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              {block.type ?? "block"} · {block.block_id ?? block.key ?? blockId}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDuplicate}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Duplicar bloque"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggleHidden}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label={block.is_hidden ? "Mostrar bloque" : "Ocultar bloque"}
          >
            {block.is_hidden ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/20 text-red-600 transition hover:bg-red-500/10 dark:text-red-300"
            aria-label="Eliminar bloque"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {genericEditableFields.map((field) => {
          if (field.kind === "json") {
            const textValue = JSON.stringify(field.value ?? null, null, 2);

            return (
              <label key={field.path.join(".")} className="grid gap-1.5 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {field.label}
                </span>
                <textarea
                  key={`${field.path.join(".")}-${textValue}`}
                  defaultValue={textValue}
                  onBlur={(event) => {
                    try {
                      const parsed = JSON.parse(event.target.value) as JsonValue;

                      onPatch(setValueAtPath({}, field.path, parsed));
                    } catch {
                      // Keep the previous value if the edited JSON is invalid.
                    }
                  }}
                  rows={Math.min(Math.max(textValue.split("\n").length, 4), 12)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            );
          }

          const key = field.path[field.path.length - 1] ?? "";
          const value = field.value;

          if (isSmartDestinationField(key)) {
            const currentValue =
              typeof value === "string" ? value : "";
            const hasCurrentDestination = destinations.some(
              (destination) => destination.value === currentValue,
            );

            return (
              <label key={field.path.join(".")} className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {field.label}
                </span>
                <select
                  value={currentValue}
                  onChange={(event) =>
                    onPatch(setValueAtPath({}, field.path, event.target.value))
                  }
                  className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">Seleccionar destino</option>
                  {currentValue && !hasCurrentDestination ? (
                    <option value={currentValue}>
                      Destino actual: {currentValue}
                    </option>
                  ) : null}
                  {destinations.map((destination) => (
                    <option
                      key={`${field.path.join(".")}-${destination.kind}-${destination.value}`}
                      value={destination.value}
                    >
                      {destination.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          if (typeof value === "boolean") {
            return (
              <label
                key={field.path.join(".")}
                className="flex min-h-10 items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 dark:border-white/10"
              >
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {field.label}
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) =>
                    onPatch(setValueAtPath({}, field.path, event.target.checked))
                  }
                  className="h-4 w-4 accent-cyan-500"
                />
              </label>
            );
          }

          const inputValue = typeof value === "string" || typeof value === "number"
            ? String(value)
            : "";

          return (
            <label key={field.path.join(".")} className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {field.label}
              </span>
              <input
                type={typeof value === "number" ? "number" : "text"}
                value={inputValue}
                placeholder={field.placeholder}
                onChange={(event) =>
                  onPatch(
                    setValueAtPath(
                      {},
                      field.path,
                      typeof value === "number"
                        ? Number(event.target.value)
                        : event.target.value,
                    ),
                  )
                }
                className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
              />
            </label>
          );
        })}
      </div>

      {nestedEditableEntries.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {nestedEditableEntries.map((field) => {
            const fallbackValue = field.fallbackKeys.reduce<string>(
              (resolved, key) =>
                resolved || (typeof block[key] === "string" ? String(block[key]) : ""),
              "",
            );
            const nestedValue = getValueAtPath(block, field.path);
            const inputValue =
              typeof nestedValue === "string"
                ? String(nestedValue)
                : fallbackValue;

            return (
              <label key={field.path.join(".")} className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                  {field.label}
                </span>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(event) => onPatch(setValueAtPath({}, field.path, event.target.value))}
                  className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}
