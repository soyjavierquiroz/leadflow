"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  Bot,
  Braces,
  ChevronDown,
  Cpu,
  Database,
  FileText,
  Loader2,
  Sparkles,
  Target,
  Trash2,
  Upload,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import { SectionHeader } from "@/components/app-shell/section-header";
import { OperationBanner } from "@/components/team-operations/operation-banner";
import { ModalShell } from "@/components/team-operations/modal-shell";
import { formatDateTime } from "@/lib/app-shell/utils";
import { memberOperationRequest } from "@/lib/member-operations";
import { webPublicConfig } from "@/lib/public-env";
import type { AiSettingsSnapshot } from "@/lib/ai-settings";

type AiSettingsFormProps = {
  initialSettings: AiSettingsSnapshot;
};

type FeedbackState = {
  tone: "success" | "error";
  message: string;
} | null;

type FormState = {
  basePrompt: string;
  routeContexts: AiSettingsSnapshot["routeContexts"];
  defaultCta: string;
};

type KnowledgeDocument = {
  id: string;
  name: string;
  uploadedAt: string | null;
};

type KnowledgeAuditOperation = "upload" | "delete";

type KnowledgeAuditEntry = {
  id: string;
  operation: KnowledgeAuditOperation;
  fileName: string;
  costKredits: string;
  userName: string;
  createdAt: string;
};

type KnowledgeDocumentsPayload =
  | unknown[]
  | {
      documents?: unknown[];
      files?: unknown[];
      items?: unknown[];
      data?: unknown[];
      results?: unknown[];
    };

type KnowledgeAuditPayload =
  | unknown[]
  | {
      items?: unknown[];
      logs?: unknown[];
      data?: unknown[];
      results?: unknown[];
    };

type KreditBalanceValue = string | number;

type TeamKreditsResponse = {
  balance: KreditBalanceValue;
};

type PdfTrainingEstimate = {
  file: File;
  characterCount: number;
  costKredits: number;
  pageCount: number | null;
};

type PdfTextExtractionResult = {
  text: string;
  pageCount: number | null;
};

type PdfJsTextItem = {
  str?: unknown;
};

type PdfJsPage = {
  getTextContent: () => Promise<{ items: PdfJsTextItem[] }>;
  cleanup?: () => void;
};

type PdfJsDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
  cleanup?: () => void;
  destroy?: () => Promise<void> | void;
};

type PdfJsLoadingTask = {
  promise: Promise<PdfJsDocument>;
  destroy?: () => Promise<void> | void;
};

type PdfJsModule = {
  GlobalWorkerOptions?: {
    workerSrc?: string;
  };
  getDocument: (parameters: {
    data: Uint8Array;
    disableFontFace?: boolean;
    disableWorker?: boolean;
    useSystemFonts?: boolean;
  }) => PdfJsLoadingTask;
};

const inputClassName =
  "w-full rounded-[1.35rem] border border-app-border bg-app-card px-4 py-3 text-sm text-app-text shadow-sm outline-none transition placeholder:text-app-text-soft focus:border-app-accent focus:ring-4 focus:ring-app-accent-soft";
const labelClassName =
  "text-xs font-semibold uppercase tracking-[0.22em] text-app-text-soft";
const primaryButtonClassName =
  "inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60";
const secondaryPanelClassName =
  "rounded-[1.5rem] border border-app-border bg-app-surface p-4 shadow-sm";
const maxTrainingCharacters = 500_000;
const trainingCharactersUnit = 1_000;
const ratePerThousand = 0.05;
const minNeuralTrainingDurationMs = 8_000;
const maxNeuralTrainingDurationMs = 12_000;
const minimumNeuralScannerVisibleMs = 15_000;
const neuralTrainingMessages = [
  "Analizando topología semántica...",
  "Codificando sinapsis vectoriales...",
  "Sincronizando matriz con el núcleo del Agente...",
  "¡OPTIMIZACIÓN COGNITIVA COMPLETA!",
] as const;
const neuralBrainNodes = [
  [124, 98],
  [178, 122],
  [219, 97],
  [269, 101],
  [318, 146],
  [289, 211],
  [203, 190],
  [140, 191],
] as const;
const pdfJsVersion = "5.6.205";
const pdfJsModuleUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfJsVersion}/build/pdf.mjs`;
const pdfJsWorkerUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfJsVersion}/build/pdf.worker.mjs`;
const integerFormatter = new Intl.NumberFormat("es-CO");
const kreditsFormatter = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 6,
  maximumFractionDigits: 6,
});
const knowledgeUploadUrl = `${webPublicConfig.urls.api}/v1/knowledge/upload`;

const wait = (ms: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const ctaOptions = [
  {
    value: "book_call",
    label: "Agendar llamada",
    description: "Cierre orientado a cita directa con el lead.",
  },
  {
    value: "send_whatsapp",
    label: "Enviar a WhatsApp",
    description: "Empuja la conversación al canal personal del sponsor.",
  },
  {
    value: "view_offer",
    label: "Ver oferta",
    description: "Lleva al lead a la propuesta o siguiente detalle comercial.",
  },
  {
    value: "learn_more",
    label: "Solicitar más info",
    description: "Mantiene el cierre suave cuando aún falta contexto.",
  },
] as const;

const resolutionLabel: Record<
  AiSettingsSnapshot["resolution"]["strategy"],
  string
> = {
  member_override: "Override personal activo",
  tenant_default: "Usando base del equipo",
  empty: "Sin base configurada",
};

const metricTone: Record<AiSettingsSnapshot["resolution"]["strategy"], string> = {
  member_override: "border-app-accent bg-app-accent-soft text-app-accent",
  tenant_default: "border-app-warning-border bg-app-warning-bg text-app-warning-text",
  empty: "border-app-border bg-app-surface-muted text-app-text-muted",
};

const knowledgeAuditOperationLabel: Record<KnowledgeAuditOperation, string> = {
  upload: "Carga",
  delete: "Eliminación",
};

const createFormState = (settings: AiSettingsSnapshot): FormState => ({
  basePrompt: settings.basePrompt,
  routeContexts: { ...settings.routeContexts },
  defaultCta: settings.ctaPolicy.defaultCta ?? "",
});

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getFirstStringValue = (
  record: Record<string, unknown>,
  keys: string[],
) => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
};

const getKnowledgeItems = (payload: KnowledgeDocumentsPayload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isObjectRecord(payload)) {
    return [];
  }

  return (
    payload.documents ??
    payload.files ??
    payload.items ??
    payload.data ??
    payload.results ??
    []
  );
};

const getKnowledgeAuditItems = (payload: KnowledgeAuditPayload) => {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isObjectRecord(payload)) {
    return [];
  }

  return payload.items ?? payload.logs ?? payload.data ?? payload.results ?? [];
};

const normalizeKnowledgeDocuments = (
  payload: KnowledgeDocumentsPayload,
): KnowledgeDocument[] =>
  getKnowledgeItems(payload).flatMap((item, index) => {
    if (!isObjectRecord(item)) {
      return [];
    }

    const name =
      getFirstStringValue(item, [
        "name",
        "fileName",
        "filename",
        "file_name",
        "pdfName",
        "pdf_name",
        "title",
      ]) ?? `Documento ${index + 1}`;
    const uploadedAt = getFirstStringValue(item, [
      "uploadedAt",
      "uploaded_at",
      "createdAt",
      "created_at",
      "date",
      "fecha_carga",
    ]);
    const id =
      getFirstStringValue(item, [
        "id",
        "documentId",
        "document_id",
        "fileId",
        "file_id",
      ]) ?? `${name}-${uploadedAt ?? index}`;

    return [
      {
        id,
        name,
        uploadedAt,
      },
    ];
  });

const normalizeKnowledgeAuditEntries = (
  payload: KnowledgeAuditPayload,
): KnowledgeAuditEntry[] =>
  getKnowledgeAuditItems(payload).flatMap((item, index) => {
    if (!isObjectRecord(item)) {
      return [];
    }

    const operation = getFirstStringValue(item, ["operation", "action"]);

    if (operation !== "upload" && operation !== "delete") {
      return [];
    }

    const fileName =
      getFirstStringValue(item, ["fileName", "file_name", "name", "pdfName"]) ??
      `Matriz ${index + 1}`;
    const createdAt =
      getFirstStringValue(item, ["createdAt", "created_at", "date"]) ??
      new Date().toISOString();
    const costKredits =
      getFirstStringValue(item, [
        "costKredits",
        "cost_kredits",
        "trainingCostKredits",
        "training_cost_kredits",
      ]) ?? "0";
    const userName =
      getFirstStringValue(item, ["userName", "user_name", "actorName", "actor_name"]) ??
      "Sistema Leadflow";
    const id =
      getFirstStringValue(item, ["id", "auditId", "audit_id"]) ??
      `${operation}-${fileName}-${createdAt}`;

    return [
      {
        id,
        operation,
        fileName,
        costKredits,
        userName,
        createdAt,
      },
    ];
  });

const isPdfFile = (file: File) =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

const formatInteger = (value: number) => integerFormatter.format(value);
const formatKredits = (value: number) => kreditsFormatter.format(value);

const calculateTrainingCost = (characterCount: number) =>
  (characterCount / trainingCharactersUnit) * ratePerThousand;

const calculateNeuralTrainingDuration = (characterCount: number) => {
  const characterRatio =
    Math.min(characterCount, maxTrainingCharacters) / maxTrainingCharacters;

  return Math.round(
    minNeuralTrainingDurationMs +
      (maxNeuralTrainingDurationMs - minNeuralTrainingDurationMs) *
        characterRatio,
  );
};

const getNeuralTrainingMessageIndex = (elapsedMs: number, durationMs: number) => {
  const progress = durationMs > 0 ? elapsedMs / durationMs : 1;

  if (progress < 0.3) {
    return 0;
  }

  if (progress < 0.7) {
    return 1;
  }

  if (progress < 1) {
    return 2;
  }

  return 3;
};

const parseKreditBalance = (value: KreditBalanceValue | null) => {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const decodePdfString = (value: string) =>
  value.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, escaped: string) => {
    if (/^[0-7]+$/.test(escaped)) {
      return String.fromCharCode(Number.parseInt(escaped, 8));
    }

    const replacements: Record<string, string> = {
      n: "\n",
      r: "\r",
      t: "\t",
      b: "\b",
      f: "\f",
      "(": "(",
      ")": ")",
      "\\": "\\",
    };

    return replacements[escaped] ?? escaped;
  });

const decodePdfHexString = (value: string) => {
  const normalized = value.replace(/\s+/g, "");
  const bytes: number[] = [];

  for (let index = 0; index < normalized.length; index += 2) {
    const pair = normalized.slice(index, index + 2).padEnd(2, "0");
    const byte = Number.parseInt(pair, 16);

    if (Number.isFinite(byte)) {
      bytes.push(byte);
    }
  }

  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    let decoded = "";

    for (let index = 2; index < bytes.length; index += 2) {
      decoded += String.fromCharCode(((bytes[index] ?? 0) << 8) + (bytes[index + 1] ?? 0));
    }

    return decoded;
  }

  return bytes.map((byte) => String.fromCharCode(byte)).join("");
};

const extractPdfTextFromContent = (content: string) => {
  const chunks: string[] = [];
  const literalTextPattern = /\(((?:\\.|[^\\)])*)\)\s*(?:Tj|'|")/g;
  const textArrayPattern = /\[((?:.|\n|\r)*?)\]\s*TJ/g;
  const hexTextPattern = /<([0-9a-fA-F\s]+)>\s*(?:Tj|'|")/g;
  let match: RegExpExecArray | null;

  while ((match = literalTextPattern.exec(content)) !== null) {
    chunks.push(decodePdfString(match[1] ?? ""));
  }

  while ((match = textArrayPattern.exec(content)) !== null) {
    const arrayContent = match[1] ?? "";
    const arrayLiteralPattern = /\(((?:\\.|[^\\)])*)\)/g;
    const arrayHexPattern = /<([0-9a-fA-F\s]+)>/g;
    let arrayMatch: RegExpExecArray | null;

    while ((arrayMatch = arrayLiteralPattern.exec(arrayContent)) !== null) {
      chunks.push(decodePdfString(arrayMatch[1] ?? ""));
    }

    while ((arrayMatch = arrayHexPattern.exec(arrayContent)) !== null) {
      chunks.push(decodePdfHexString(arrayMatch[1] ?? ""));
    }
  }

  while ((match = hexTextPattern.exec(content)) !== null) {
    chunks.push(decodePdfHexString(match[1] ?? ""));
  }

  return chunks.join(" ");
};

const decompressPdfStream = async (content: string) => {
  if (typeof DecompressionStream === "undefined") {
    return null;
  }

  const trimmed = content.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
  const bytes = Uint8Array.from(trimmed, (character) => character.charCodeAt(0) & 255);

  try {
    const decompressedStream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream("deflate"));

    return await new Response(decompressedStream).text();
  } catch {
    return null;
  }
};

const loadPdfJs = async () => {
  const pdfjs = (await import(
    /* webpackIgnore: true */ pdfJsModuleUrl
  )) as PdfJsModule;

  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfJsWorkerUrl;
  }

  return pdfjs;
};

const extractPdfTextWithPdfJs = async (
  buffer: ArrayBuffer,
): Promise<PdfTextExtractionResult> => {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableFontFace: true,
    disableWorker: true,
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  const pageChunks: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => (typeof item.str === "string" ? item.str : ""))
        .filter(Boolean)
        .join(" ");

      if (pageText.trim()) {
        pageChunks.push(pageText);
      }

      page.cleanup?.();
    }

    return {
      text: pageChunks.join("\n"),
      pageCount: document.numPages,
    };
  } finally {
    document.cleanup?.();
    await document.destroy?.();
  }
};

const extractPdfTextFallback = async (
  buffer: ArrayBuffer,
): Promise<PdfTextExtractionResult> => {
  const binary = new TextDecoder("latin1").decode(buffer);
  const contentParts = [binary];
  const streamPattern = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let streamMatch: RegExpExecArray | null;

  while ((streamMatch = streamPattern.exec(binary)) !== null) {
    const streamHeader = binary.slice(Math.max(0, streamMatch.index - 500), streamMatch.index);

    if (!streamHeader.includes("/FlateDecode")) {
      continue;
    }

    const decompressed = await decompressPdfStream(streamMatch[1] ?? "");

    if (decompressed) {
      contentParts.push(decompressed);
    }
  }

  return {
    text: extractPdfTextFromContent(contentParts.join("\n")),
    pageCount: null,
  };
};

const extractPdfText = async (file: File): Promise<PdfTextExtractionResult> => {
  const buffer = await file.arrayBuffer();

  try {
    return await extractPdfTextWithPdfJs(buffer);
  } catch {
    return extractPdfTextFallback(buffer);
  }
};

const getKnowledgeErrorMessage = async (
  response: Response,
  fallback: string,
) => {
  const payload = (await response.json().catch(() => null)) as unknown;

  if (
    isObjectRecord(payload) &&
    typeof payload.message === "string" &&
    payload.message.trim()
  ) {
    return payload.message;
  }

  if (
    isObjectRecord(payload) &&
    typeof payload.error === "string" &&
    payload.error.trim()
  ) {
    return payload.error;
  }

  return fallback;
};

function NeuralTrainingExperience({
  progress,
  message,
  isComplete,
  onClose,
}: {
  progress: number;
  message: string;
  isComplete: boolean;
  onClose: () => void;
}) {
  const safeProgress = Math.max(0, Math.min(100, progress));

  return (
    <section
      aria-live="polite"
      className="relative mt-6 min-h-[34rem] w-full overflow-hidden rounded-[1.8rem] border border-app-border bg-[var(--ai-training-bg)] px-5 py-8 shadow-[var(--ai-panel-shadow)] sm:px-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--ai-training-grid)_1px,transparent_1px),linear-gradient(90deg,var(--ai-training-grid)_1px,transparent_1px)] bg-[size:34px_34px]" />
      <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(67,198,172,0.9),transparent)]" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-36 w-3/4 -translate-x-1/2 rounded-full bg-app-accent-soft blur-3xl" />

      <div className="relative mx-auto flex max-w-5xl flex-col items-center text-center">
        <div className="relative flex w-full max-w-[32rem] items-center justify-center">
          <div className="absolute h-[18rem] w-[18rem] rounded-full border border-app-accent/20 bg-app-accent-soft blur-2xl" />
          <div className="absolute h-[16rem] w-[16rem] animate-ping rounded-full border border-app-accent/20" />
          <svg
            viewBox="0 0 420 320"
            role="img"
            aria-label="Cerebro neural psicotrónico procesando conexiones"
            className="relative h-auto w-full max-w-[28rem] drop-shadow-[0_0_28px_rgba(67,198,172,0.34)]"
          >
            <defs>
              <linearGradient id="neuralBrainGlow" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#7DF7D4" />
                <stop offset="52%" stopColor="#43C6AC" />
                <stop offset="100%" stopColor="#8FA7FF" />
              </linearGradient>
              <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <path
              d="M137 220c-42-9-68-39-68-78 0-29 18-53 44-64 9-32 38-52 73-48 22-22 58-24 83-4 31-7 63 10 75 39 31 8 53 35 53 68 0 43-34 78-77 78H137Z"
              fill="rgba(67,198,172,0.07)"
              stroke="url(#neuralBrainGlow)"
              strokeWidth="3"
              filter="url(#softGlow)"
            />
            <path
              d="M144 91c17 4 29 15 35 31m-38 69c26-3 43-17 52-42m-4-116c-1 30 10 51 31 64m-1 0c-24 20-31 45-21 74m71-142c-16 24-16 48 0 72m-4 0c26 5 43 20 51 46m-42 64c-11-26-6-51 15-74m-160 10h66m47-50h77m-115 93h100"
              fill="none"
              stroke="rgba(125,247,212,0.52)"
              strokeLinecap="round"
              strokeWidth="2"
            />
            {neuralBrainNodes.map(([cx, cy], index) => (
              <g key={`${cx}-${cy}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r="15"
                  fill="rgba(67,198,172,0.12)"
                  className="animate-pulse"
                  style={{ animationDelay: `${index * 180}ms` }}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r="4.5"
                  fill="#7DF7D4"
                  filter="url(#softGlow)"
                  className="animate-pulse"
                  style={{ animationDelay: `${index * 180}ms` }}
                />
              </g>
            ))}
            <path
              d="M50 254h79l28-28 54 47 48-46 34 27h77"
              fill="none"
              stroke="rgba(143,167,255,0.62)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              className="animate-pulse"
            />
          </svg>
        </div>

        {isComplete ? (
          <div className="mt-4 max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-app-accent">
              ¡OPTIMIZACIÓN COGNITIVA COMPLETA!
            </p>
            <h3 className="mt-4 text-3xl font-semibold tracking-tight text-app-text sm:text-5xl">
              INTELIGENCIA AMPLIADA:
            </h3>
            <p className="mt-5 text-base leading-7 text-app-text-muted sm:text-lg">
              Tu agente ahora domina este nuevo conocimiento.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-8 inline-flex items-center justify-center rounded-full border border-app-accent/40 bg-app-accent-soft px-5 py-2.5 text-sm font-semibold text-app-accent transition hover:brightness-110"
            >
              Volver al centro neuronal
            </button>
          </div>
        ) : (
          <div className="mt-4 w-full max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-app-accent">
              Leadflow OS Training Core
            </p>
            <h3 className="mt-4 text-2xl font-semibold tracking-tight text-app-text sm:text-4xl">
              Entrenamiento neuronal en curso
            </h3>
            <p className="mt-4 min-h-7 text-base font-medium text-app-text-muted">
              {message}
            </p>

            <div className="mt-8 rounded-full border border-app-accent/30 bg-app-bg/70 p-1 shadow-[0_0_28px_rgba(67,198,172,0.16)]">
              <div className="relative h-4 overflow-hidden rounded-full bg-app-surface">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#43C6AC,#7DF7D4,#8FA7FF)] shadow-[0_0_22px_rgba(67,198,172,0.72)] transition-[width] duration-150 ease-linear"
                  style={{ width: `${safeProgress}%` }}
                />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.32),transparent)] opacity-60" />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.18em] text-app-text-soft">
              <span>Sinapsis vectorial</span>
              <span className="text-app-accent">{Math.round(safeProgress)}%</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function KnowledgeBaseCard({ tenantId }: { tenantId: string | null }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [auditEntries, setAuditEntries] = useState<KnowledgeAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAudit, setIsLoadingAudit] = useState(true);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] =
    useState<KnowledgeDocument | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [isTrainingComplete, setIsTrainingComplete] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [trainingMessageIndex, setTrainingMessageIndex] = useState(0);
  const [trainingDurationMs, setTrainingDurationMs] = useState(
    minNeuralTrainingDurationMs,
  );
  const [isAnalyzingFile, setIsAnalyzingFile] = useState(false);
  const [trainingEstimate, setTrainingEstimate] =
    useState<PdfTrainingEstimate | null>(null);
  const [acceptedTrainingCharge, setAcceptedTrainingCharge] = useState(false);
  const [kreditsBalance, setKreditsBalance] = useState<KreditBalanceValue | null>(
    null,
  );
  const [isLoadingKredits, setIsLoadingKredits] = useState(false);
  const [kreditsError, setKreditsError] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(
    null,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const normalizedTenantId = tenantId?.trim() || null;
  const knowledgeListPath = useMemo(
    () =>
      normalizedTenantId
        ? `/knowledge/list?tenant_id=${encodeURIComponent(normalizedTenantId)}`
        : null,
    [normalizedTenantId],
  );
  const knowledgeAuditPath = useMemo(
    () =>
      normalizedTenantId
        ? `/knowledge/audit?tenant_id=${encodeURIComponent(normalizedTenantId)}`
        : null,
    [normalizedTenantId],
  );
  const numericKreditsBalance = parseKreditBalance(kreditsBalance);
  const hasSufficientKredits =
    trainingEstimate && numericKreditsBalance !== null
      ? numericKreditsBalance >= trainingEstimate.costKredits
      : false;
  const isUploadBlockedBySize =
    (trainingEstimate?.characterCount ?? 0) > maxTrainingCharacters;
  const canUploadTraining =
    Boolean(trainingEstimate) &&
    Boolean(normalizedTenantId) &&
    acceptedTrainingCharge &&
    hasSufficientKredits &&
    !isUploadBlockedBySize &&
    !isUploading &&
    !isTraining &&
    !isAnalyzingFile;
  const shouldShowRechargeKredits =
    Boolean(trainingEstimate) &&
    !isLoadingKredits &&
    !isUploadBlockedBySize &&
    (Boolean(kreditsError) ||
      numericKreditsBalance === null ||
      !hasSufficientKredits);

  const loadDocuments = useCallback(async () => {
    if (!knowledgeListPath) {
      setDocuments([]);
      setFeedback({
        tone: "error",
        message: "No pudimos resolver el tenant para cargar la base de conocimiento.",
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const payload = await memberOperationRequest<KnowledgeDocumentsPayload>(
        knowledgeListPath,
        { method: "GET" },
      );

      setDocuments(normalizeKnowledgeDocuments(payload));
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos cargar la base de conocimiento.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [knowledgeListPath]);

  const loadAudit = useCallback(async () => {
    if (!knowledgeAuditPath) {
      setAuditEntries([]);
      setIsLoadingAudit(false);
      return;
    }

    setIsLoadingAudit(true);

    try {
      const payload = await memberOperationRequest<KnowledgeAuditPayload>(
        knowledgeAuditPath,
        { method: "GET" },
      );

      setAuditEntries(normalizeKnowledgeAuditEntries(payload));
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos cargar los logs neuronales.",
      });
    } finally {
      setIsLoadingAudit(false);
    }
  }, [knowledgeAuditPath]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  const loadKreditsBalance = useCallback(async () => {
    if (!normalizedTenantId) {
      setKreditsBalance(null);
      setKreditsError("No pudimos resolver el tenant para validar la billetera.");
      return null;
    }

    setIsLoadingKredits(true);
    setKreditsError(null);

    try {
      const response = await memberOperationRequest<TeamKreditsResponse>(
        `/team/settings/kredits?teamId=${encodeURIComponent(normalizedTenantId)}`,
        { method: "GET" },
      );

      setKreditsBalance(response.balance);
      return response.balance;
    } catch (error) {
      setKreditsBalance(null);
      setKreditsError(
        error instanceof Error
          ? error.message
          : "No pudimos validar tu saldo de Kredits.",
      );
      return null;
    } finally {
      setIsLoadingKredits(false);
    }
  }, [normalizedTenantId]);

  useEffect(() => {
    if (normalizedTenantId) {
      void loadKreditsBalance();
    }
  }, [loadKreditsBalance, normalizedTenantId]);

  useEffect(() => {
    if (!isTraining || isTrainingComplete) {
      return undefined;
    }

    const startedAt = Date.now();

    setTrainingProgress(0);
    setTrainingMessageIndex(0);

    const progressInterval = window.setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      const nextProgress = Math.min(
        100,
        (elapsedMs / trainingDurationMs) * 100,
      );

      setTrainingProgress(nextProgress);
      setTrainingMessageIndex(
        getNeuralTrainingMessageIndex(elapsedMs, trainingDurationMs),
      );
    }, 100);

    return () => {
      window.clearInterval(progressInterval);
    };
  }, [isTraining, isTrainingComplete, trainingDurationMs]);

  const resetScan = useCallback((options?: { clearFeedback?: boolean }) => {
    setTrainingEstimate(null);
    setAcceptedTrainingCharge(false);
    setKreditsError(null);

    if (options?.clearFeedback ?? true) {
      setFeedback(null);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const closeTrainingExperience = useCallback(() => {
    setIsTraining(false);
    setIsTrainingComplete(false);
    setTrainingProgress(0);
    setTrainingMessageIndex(0);
    setTrainingDurationMs(minNeuralTrainingDurationMs);
    setFeedback(null);
  }, []);

  const prepareFile = async (file: File) => {
    setFeedback(null);
    setTrainingEstimate(null);
    setAcceptedTrainingCharge(false);

    if (!normalizedTenantId) {
      setFeedback({
        tone: "error",
        message: "No pudimos resolver el tenant para analizar este PDF.",
      });
      return;
    }

    if (!isPdfFile(file)) {
      setFeedback({
        tone: "error",
        message: "Solo puedes subir archivos PDF.",
      });
      return;
    }

    setIsAnalyzingFile(true);

    try {
      const extraction = await extractPdfText(file);
      const characterCount = extraction.text.replace(/\s+/g, " ").trim().length;

      if (characterCount <= 0) {
        setFeedback({
          tone: "error",
          message:
            "No pudimos leer texto útil en este PDF. Intenta con un PDF seleccionable o exportado con texto.",
        });
        return;
      }

      setTrainingEstimate({
        file,
        characterCount,
        costKredits: calculateTrainingCost(characterCount),
        pageCount: extraction.pageCount,
      });

      if (characterCount > maxTrainingCharacters) {
        setFeedback({
          tone: "error",
          message: "Archivo demasiado grande. El límite es de 500,000 caracteres.",
        });
        return;
      }

      await loadKreditsBalance();
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos analizar este PDF antes de subirlo.",
      });
    } finally {
      setIsAnalyzingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const uploadPreparedFile = async () => {
    setFeedback(null);

    if (!trainingEstimate) {
      setFeedback({
        tone: "error",
        message: "Selecciona y analiza un PDF antes de subirlo.",
      });
      return;
    }

    if (isUploadBlockedBySize) {
      setFeedback({
        tone: "error",
        message: "Archivo demasiado grande. El límite es de 500,000 caracteres.",
      });
      return;
    }

    if (!acceptedTrainingCharge) {
      setFeedback({
        tone: "error",
        message: "Debes aceptar el cargo de Kredits antes de entrenar este documento.",
      });
      return;
    }

    if (!normalizedTenantId) {
      setFeedback({
        tone: "error",
        message: "No pudimos resolver el tenant para subir este PDF.",
      });
      return;
    }

    const selectedTrainingDurationMs = Math.max(
      minimumNeuralScannerVisibleMs,
      calculateNeuralTrainingDuration(trainingEstimate.characterCount),
    );

    setTrainingDurationMs(selectedTrainingDurationMs);
    setIsTraining(true);
    setIsTrainingComplete(false);
    setTrainingProgress(0);
    setTrainingMessageIndex(0);
    setIsUploading(true);
    const trainingStartedAt = Date.now();

    const latestKreditsBalance = await loadKreditsBalance();

    const latestBalance = parseKreditBalance(latestKreditsBalance);

    if (latestBalance === null || latestBalance < trainingEstimate.costKredits) {
      setIsTraining(false);
      setIsTrainingComplete(false);
      setTrainingProgress(0);
      setTrainingMessageIndex(0);
      setTrainingDurationMs(minNeuralTrainingDurationMs);
      setIsUploading(false);
      setFeedback({
        tone: "error",
        message:
          latestBalance === null
            ? "No pudimos validar tu saldo de Kredits."
            : "No tienes saldo suficiente para entrenar este documento.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", trainingEstimate.file);

    formData.append("tenant_id", normalizedTenantId);
    formData.append("file_name", trainingEstimate.file.name);
    formData.append("platform_key", webPublicConfig.runtime.platformKey);
    formData.append("product_key", webPublicConfig.runtime.productKey);
    formData.append("character_count", String(trainingEstimate.characterCount));
    formData.append(
      "training_cost_kredits",
      trainingEstimate.costKredits.toFixed(6),
    );

    try {
      const response = await fetch(knowledgeUploadUrl, {
        method: "POST",
        credentials: knowledgeUploadUrl.startsWith(webPublicConfig.urls.api)
          ? "include"
          : "omit",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          await getKnowledgeErrorMessage(
            response,
            "No pudimos subir el PDF al webhook de conocimiento.",
          ),
        );
      }

      const remainingTrainingMs = Math.max(
        0,
        selectedTrainingDurationMs - (Date.now() - trainingStartedAt),
      );

      if (remainingTrainingMs > 0) {
        await wait(remainingTrainingMs);
      }

      await loadAudit();
      await loadDocuments();

      setTrainingProgress(100);
      setTrainingMessageIndex(neuralTrainingMessages.length - 1);
      setIsTrainingComplete(true);
      setFeedback(null);
      resetScan({ clearFeedback: false });
    } catch (error) {
      setIsTraining(false);
      setIsTrainingComplete(false);
      setTrainingProgress(0);
      setTrainingMessageIndex(0);
      setTrainingDurationMs(minNeuralTrainingDurationMs);
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos subir el PDF al webhook de conocimiento.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      void prepareFile(file);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    if (isUploading || isAnalyzingFile) {
      return;
    }

    const file = event.dataTransfer.files?.[0];

    if (file) {
      void prepareFile(file);
    }
  };

  const closeDeleteConfirmation = () => {
    if (!deletingDocumentId) {
      setDeleteCandidate(null);
    }
  };

  const handleDelete = async (document: KnowledgeDocument) => {
    setFeedback(null);

    if (!normalizedTenantId) {
      setFeedback({
        tone: "error",
        message: "No pudimos resolver el tenant para eliminar este documento.",
      });
      return;
    }

    setDeletingDocumentId(document.id);

    try {
      await memberOperationRequest<unknown>(
        `/knowledge/${encodeURIComponent(document.id)}?tenant_id=${encodeURIComponent(
          normalizedTenantId,
        )}`,
        {
          method: "DELETE",
          body: JSON.stringify({
            tenant_id: normalizedTenantId,
            document_id: document.id,
            file_name: document.name,
          }),
        },
      );

      setDeleteCandidate(null);
      await Promise.all([loadDocuments(), loadAudit()]);
      setFeedback({
        tone: "success",
        message: "Documento eliminado de la base de conocimiento.",
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos eliminar el documento.",
      });
    } finally {
      setDeletingDocumentId(null);
    }
  };

  return (
    <article className="relative w-full overflow-hidden rounded-[2rem] border border-app-border bg-[radial-gradient(circle_at_16%_14%,var(--app-accent-soft),transparent_30%),linear-gradient(135deg,var(--app-surface)_0%,var(--app-card)_58%,var(--app-bg-elevated)_100%)] p-6 shadow-[var(--ai-panel-shadow)]">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(67,198,172,0.7),transparent)]" />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-app-accent">
            <Cpu className="h-4 w-4" />
            Base de Conocimiento
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-app-text">
            CENTRO DE ENTRENAMIENTO NEURONAL
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-app-text-muted">
            Administra las matrices de datos que alimentan la lógica cognitiva de tus agentes.
          </p>
        </div>

        <div className="flex min-w-0 flex-wrap items-stretch justify-end gap-3">
          <div className="min-w-[16rem] max-w-full rounded-[1.35rem] border border-sky-200 bg-[linear-gradient(135deg,#e0f2fe_0%,#ccfbf1_48%,#ffffff_100%)] px-4 py-3 text-slate-900 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-700">
              <Database className="h-4 w-4" />
              BILLETERA DEL EQUIPO
            </div>
            <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
              {isLoadingKredits
                ? "Sincronizando..."
                : numericKreditsBalance !== null
                  ? `${formatKredits(numericKreditsBalance)} Kredits`
                  : "No disponible"}
            </p>
            <p
              title={normalizedTenantId ?? undefined}
              className="mt-1 max-w-[18rem] truncate text-[11px] font-medium uppercase tracking-[0.16em] text-slate-600"
            >
              Tenant: {normalizedTenantId ?? "resolviendo"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={
              isUploading || isTraining || isAnalyzingFile || !normalizedTenantId
            }
            className={`${primaryButtonClassName} self-center whitespace-nowrap`}
          >
            {isUploading || isTraining || isAnalyzingFile ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="mr-2 h-4 w-4" />
            )}
            {isTraining
              ? "Entrenando..."
              : isUploading
                ? "Subiendo..."
                : isAnalyzingFile
                  ? "Analizando..."
                  : "Seleccionar PDF"}
          </button>
        </div>
      </div>

      {feedback && !isTraining ? (
        <div
          className={`mt-6 rounded-[1.25rem] border px-4 py-3 text-sm font-medium ${
            feedback.tone === "success"
              ? "border-app-success-border bg-app-success-bg text-app-success-text"
              : "border-app-danger-border bg-app-danger-bg text-app-danger-text"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {isTraining ? (
        <NeuralTrainingExperience
          progress={trainingProgress}
          message={
            neuralTrainingMessages[trainingMessageIndex] ??
            neuralTrainingMessages[0]
          }
          isComplete={isTrainingComplete}
          onClose={closeTrainingExperience}
        />
      ) : (
        <div className="relative mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]">
        <div className="space-y-4">
          <div
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDrop={handleDrop}
            className={`relative min-h-[24rem] overflow-hidden rounded-[1.6rem] border p-5 text-center transition ${
              isDragging
                ? "border-app-accent bg-app-accent-soft shadow-[0_0_42px_rgba(67,198,172,0.24)]"
                : "border-app-border bg-[var(--ai-scanner-bg)] shadow-[var(--ai-card-shadow)]"
            }`}
          >
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(var(--ai-scanner-grid)_1px,transparent_1px),linear-gradient(90deg,var(--ai-scanner-grid)_1px,transparent_1px)] bg-[size:28px_28px]" />
            <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px bg-[var(--ai-scanner-scanline)] shadow-[var(--ai-scanner-line-shadow)]" />
            <div className="pointer-events-none absolute left-6 right-6 top-8 h-16 rounded-full bg-[var(--ai-scanner-glow)] blur-2xl" />

            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={handleFileInputChange}
              disabled={isUploading || isAnalyzingFile || !normalizedTenantId}
            />

            <div className="relative flex h-full min-h-[20rem] flex-col items-center justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-app-accent/30 bg-[var(--ai-scanner-icon-bg)] text-app-accent shadow-[var(--ai-scanner-icon-shadow)]">
                {isAnalyzingFile ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <Cpu className="h-8 w-8" />
                )}
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-app-accent">
                Neural Scanner
              </p>
              <p className="mt-3 text-lg font-semibold tracking-tight text-app-text">
                Arrastra una matriz PDF
              </p>
              <p className="mt-2 max-w-xs text-sm leading-6 text-app-text-muted">
                El escáner validará caracteres, costo y saldo antes de abrir el canal de entrenamiento.
              </p>
              <p
                title="Leadflow no almacena el PDF físico en esta etapa; solo conserva la codificación neuronal generada como vectores."
                className="mt-3 max-w-xs text-xs leading-5 text-app-text-soft"
              >
                Almacenamiento vectorial: solo se conserva la codificación neuronal.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isAnalyzingFile || !normalizedTenantId}
                className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isUploading || isAnalyzingFile ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {isUploading
                  ? "Sincronizando..."
                  : isAnalyzingFile
                    ? "Escaneando..."
                    : "Iniciar escaneo"}
              </button>
              {!normalizedTenantId ? (
                <p className="mt-4 text-sm font-medium text-app-danger-text">
                  Tenant no disponible para conectar esta base.
                </p>
              ) : (
                <p className="mt-4 max-w-xs truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-soft">
                  Tenant activo: {normalizedTenantId}
                </p>
              )}
            </div>
          </div>

          {trainingEstimate ? (
            <div className="rounded-[1.5rem] border border-app-border bg-app-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-app-text">
                    <Zap className="h-4 w-4 text-app-accent" />
                    Validación de entrenamiento
                  </div>
                  <p className="mt-3 text-sm leading-6 text-app-text-muted">
                    Este documento tiene{" "}
                    <span className="font-semibold text-app-text">
                      {formatInteger(trainingEstimate.characterCount)}
                    </span>{" "}
                    caracteres. El costo de entrenamiento será de{" "}
                    <span className="font-semibold text-app-text">
                      {formatKredits(trainingEstimate.costKredits)} Kredits
                    </span>
                    .
                  </p>
                  <p className="mt-1 text-xs text-app-text-soft">
                    {trainingEstimate.pageCount
                      ? `${formatInteger(trainingEstimate.pageCount)} páginas procesadas por el scanner.`
                      : "Scanner local en modo de compatibilidad."}
                  </p>
                  <p
                    title={trainingEstimate.file.name}
                    className="mt-1 max-w-full truncate text-xs text-app-text-soft"
                  >
                    Archivo: {trainingEstimate.file.name}
                  </p>
                </div>

                <div className="shrink-0 rounded-[1.2rem] border border-app-border bg-app-card px-4 py-3 text-right shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-soft">
                    Costo exacto
                  </p>
                  <p className="mt-1 text-sm font-semibold text-app-text">
                    {formatKredits(trainingEstimate.costKredits)} Kredits
                  </p>
                </div>
              </div>

              {isUploadBlockedBySize ? (
                <div className="mt-4 rounded-[1.2rem] border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm font-medium text-app-danger-text">
                  Archivo demasiado grande. El límite es de 500,000 caracteres.
                </div>
              ) : null}

              {kreditsError ? (
                <div className="mt-4 rounded-[1.2rem] border border-app-danger-border bg-app-danger-bg px-4 py-3 text-sm font-medium text-app-danger-text">
                  {kreditsError}
                </div>
              ) : null}

              {trainingEstimate &&
              !isUploadBlockedBySize &&
              !isLoadingKredits &&
              !kreditsError &&
              numericKreditsBalance !== null &&
              !hasSufficientKredits ? (
                <div className="mt-4 rounded-[1.2rem] border border-app-warning-border bg-app-warning-bg px-4 py-3 text-sm font-medium text-app-warning-text">
                  No tienes saldo suficiente para entrenar este documento.
                </div>
              ) : null}

              <label className="mt-4 flex items-start gap-3 rounded-[1.2rem] border border-app-border bg-app-card px-4 py-3 text-sm text-app-text-muted shadow-sm">
                <input
                  type="checkbox"
                  checked={acceptedTrainingCharge}
                  onChange={(event) => setAcceptedTrainingCharge(event.target.checked)}
                  disabled={
                    isUploadBlockedBySize ||
                    isLoadingKredits ||
                    !hasSufficientKredits ||
                    isUploading
                  }
                  className="mt-0.5 h-4 w-4 rounded border-app-border bg-app-surface text-app-accent focus:ring-app-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
                />
                <span>
                  Acepto el cargo de{" "}
                  <span className="font-semibold text-app-text">
                    {formatKredits(trainingEstimate.costKredits)} Kredits
                  </span>{" "}
                  por este entrenamiento
                </span>
              </label>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                {shouldShowRechargeKredits ? (
                  <button
                    type="button"
                    onClick={() =>
                      setFeedback({
                        tone: "error",
                        message:
                          "Recarga Kredits desde la billetera del equipo o contacta al administrador.",
                      })
                    }
                    className="inline-flex items-center justify-center rounded-full border border-app-warning-border bg-app-warning-bg px-4 py-2 text-sm font-semibold text-app-warning-text transition hover:brightness-95"
                  >
                    Recargar Kredits
                  </button>
                ) : (
                  <span className="text-sm text-app-text-soft">
                    La subida se habilita al aceptar el cargo.
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => resetScan()}
                  disabled={isUploading || isAnalyzingFile}
                  className="inline-flex items-center justify-center rounded-full border border-app-border bg-app-card px-4 py-2.5 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="mr-2 h-4 w-4" />
                  CANCELAR ESCANEO
                </button>

                <button
                  type="button"
                  onClick={() => void uploadPreparedFile()}
                  disabled={!canUploadTraining}
                  className={primaryButtonClassName}
                >
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-4 w-4" />
                  )}
                  Subir
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-[1.5rem] border border-app-border bg-[linear-gradient(180deg,var(--app-surface)_0%,var(--app-card)_100%)] shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-app-border px-5 py-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-app-text-soft">
                <Database className="h-4 w-4 text-app-accent" />
                Matrices cargadas
              </p>
              <p className="mt-1 text-sm text-app-text-muted">
                Archivos disponibles para la lógica cognitiva.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-app-accent/30 bg-app-accent-soft px-3 py-1 text-xs font-semibold text-app-accent">
              {documents.length} activos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
              <thead className="bg-app-card text-xs font-semibold uppercase tracking-[0.18em] text-app-text-soft">
                <tr>
                  <th className="px-4 py-3">Nombre del PDF</th>
                  <th className="px-4 py-3">Fecha de carga</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-app-text-muted">
                      Sincronizando matrices...
                    </td>
                  </tr>
                ) : documents.length > 0 ? (
                  documents.map((document) => (
                    <tr key={document.id} className="transition hover:bg-app-accent-soft/40">
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[1rem] border border-app-border bg-app-surface text-app-accent">
                            <FileText className="h-4 w-4" />
                          </span>
                          <span title={document.name} className="max-w-[16rem] truncate font-medium text-app-text">
                            {document.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-app-text-muted">
                        {document.uploadedAt
                          ? formatDateTime(document.uploadedAt)
                          : "Sin fecha"}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteCandidate(document)}
                          disabled={
                            deletingDocumentId === document.id || !normalizedTenantId
                          }
                          className="inline-flex items-center justify-center rounded-full border border-app-border bg-app-surface px-3 py-2 text-xs font-semibold text-app-text transition hover:border-app-danger-border hover:text-app-danger-text disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingDocumentId === document.id ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                          )}
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-14 text-center">
                      <div className="mx-auto flex max-w-md flex-col items-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] border border-app-border bg-app-surface text-app-accent">
                          <Database className="h-5 w-5" />
                        </div>
                        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-app-text">
                          SISTEMA EN BLANCO: Esperando carga de conocimiento...
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t border-app-border">
            <button
              type="button"
              onClick={() => setIsAuditOpen((current) => !current)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-app-accent-soft/30"
              aria-expanded={isAuditOpen}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-app-accent">
                  <Zap className="h-4 w-4" />
                  LOGS DE ACTIVIDAD NEURONAL
                </p>
                <p className="mt-1 truncate text-sm text-app-text-muted">
                  Últimas 10 operaciones de carga o eliminación.
                </p>
              </div>
              <ChevronDown
                className={`h-5 w-5 shrink-0 text-app-text-soft transition ${
                  isAuditOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isAuditOpen ? (
              <div className="space-y-3 px-5 pb-5">
                {isLoadingAudit ? (
                  <div className="rounded-[1.2rem] border border-app-border bg-app-surface px-4 py-5 text-center text-sm text-app-text-muted">
                    Sincronizando logs neuronales...
                  </div>
                ) : auditEntries.length > 0 ? (
                  auditEntries.map((entry) => {
                    const parsedCost = parseKreditBalance(entry.costKredits);

                    return (
                      <div
                        key={entry.id}
                        className="grid gap-3 rounded-[1.2rem] border border-app-border bg-app-surface px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_minmax(8rem,0.32fr)_minmax(8rem,0.32fr)]"
                      >
                        <div className="min-w-0">
                          <p className="flex min-w-0 items-center gap-2 font-semibold text-app-text">
                            <span
                              className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-[0.14em] ${
                                entry.operation === "upload"
                                  ? "border-app-accent/30 bg-app-accent-soft text-app-accent"
                                  : "border-app-danger-border bg-app-danger-bg text-app-danger-text"
                              }`}
                            >
                              {knowledgeAuditOperationLabel[entry.operation]}
                            </span>
                            <span title={entry.fileName} className="truncate">
                              {entry.fileName}
                            </span>
                          </p>
                          <p className="mt-1 truncate text-xs text-app-text-soft">
                            {formatDateTime(entry.createdAt)}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-app-text-soft">
                            Costo
                          </p>
                          <p className="mt-1 truncate font-semibold text-app-text">
                            {parsedCost !== null
                              ? `${formatKredits(parsedCost)} Kredits`
                              : "No disponible"}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-app-text-soft">
                            Usuario
                          </p>
                          <p title={entry.userName} className="mt-1 truncate font-semibold text-app-text">
                            {entry.userName}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-[1.2rem] border border-app-border bg-app-surface px-4 py-5 text-center text-sm font-medium text-app-text-muted">
                    Sin actividad neuronal registrada todavía.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
      )}

      {deleteCandidate ? (
        <ModalShell
          eyebrow="Centro de Entrenamiento"
          title="Desvincular matriz"
          description="¿Deseas desvincular esta matriz? El Agente IA olvidará este conocimiento inmediatamente."
          onClose={closeDeleteConfirmation}
        >
          <div className="space-y-5">
            <div className="rounded-[1.25rem] border border-app-danger-border bg-app-danger-bg px-4 py-3">
              <p className="text-sm font-semibold text-app-danger-text">
                Eliminación definitiva sin costo
              </p>
              <p
                title={deleteCandidate.name}
                className="mt-2 truncate text-sm text-app-text"
              >
                {deleteCandidate.name}
              </p>
              <p className="mt-2 text-xs leading-5 text-app-text-muted">
                Esta acción desvincula la fuente y borra sus fragmentos de conocimiento asociados.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteConfirmation}
                disabled={Boolean(deletingDocumentId)}
                className="inline-flex items-center justify-center rounded-full border border-app-border bg-app-card px-4 py-2.5 text-sm font-semibold text-app-text transition hover:border-app-border-strong hover:bg-app-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDelete(deleteCandidate)}
                disabled={Boolean(deletingDocumentId)}
                className="inline-flex items-center justify-center rounded-full border border-app-danger-border bg-app-danger-bg px-4 py-2.5 text-sm font-semibold text-app-danger-text transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingDocumentId ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Desvincular matriz
              </button>
            </div>
          </div>
        </ModalShell>
      ) : null}
    </article>
  );
}

export function AiSettingsForm({ initialSettings }: AiSettingsFormProps) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [form, setForm] = useState<FormState>(() => createFormState(initialSettings));
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isSaving, startSaving] = useTransition();

  const selectedCta = ctaOptions.find((option) => option.value === form.defaultCta);
  const promptLength = form.basePrompt.trim().length;

  const handleContextChange =
    (key: keyof FormState["routeContexts"]) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;

      setForm((current) => ({
        ...current,
        routeContexts: {
          ...current.routeContexts,
          [key]: value,
        },
      }));
    };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (!form.basePrompt.trim()) {
      setFeedback({
        tone: "error",
        message: "El prompt base es obligatorio para guardar la configuración.",
      });
      return;
    }

    startSaving(async () => {
      try {
        const nextSettings = await memberOperationRequest<AiSettingsSnapshot>(
          "/ai-config/me",
          {
            method: "PATCH",
            body: JSON.stringify({
              basePrompt: form.basePrompt,
              routeContexts: form.routeContexts,
              defaultCta: form.defaultCta || null,
            }),
          },
        );

        setSettings(nextSettings);
        setForm(createFormState(nextSettings));
        setFeedback({
          tone: "success",
          message: "La configuración de IA quedó guardada para tu sponsor.",
        });
        router.refresh();
      } catch (error) {
        setFeedback({
          tone: "error",
          message:
            error instanceof Error
              ? error.message
              : "No pudimos guardar la configuración de IA.",
        });
      }
    });
  };

  return (
    <div className="w-full max-w-none space-y-8">
      <SectionHeader
        eyebrow="Member / IA"
        title="Configuración de IA"
        description="Ajusta el prompt maestro, los contextos de ruta y la CTA por defecto que usarán tus automatizaciones sin salir del dashboard."
      />

      {feedback ? <OperationBanner tone={feedback.tone} message={feedback.message} /> : null}

      <section className="grid w-full gap-6 xl:grid-cols-[0.84fr_1.16fr]">
        <article className="overflow-hidden rounded-[2rem] border border-app-border bg-[radial-gradient(circle_at_top_left,var(--app-accent-soft),_transparent_38%),linear-gradient(180deg,var(--app-surface)_0%,var(--app-card)_100%)] p-6 shadow-[var(--ai-panel-shadow)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-accent">
                Runtime personal
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-app-text">
                Cabina de prompting
              </h2>
              <p className="mt-3 text-sm leading-6 text-app-text-muted">
                Este override se aplica sobre la base del team y alimenta el contexto que n8n resuelve por instancia.
              </p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${metricTone[settings.resolution.strategy]}`}
            >
              {resolutionLabel[settings.resolution.strategy]}
            </span>
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-app-border bg-app-card p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] border border-app-border bg-app-surface text-app-accent">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-semibold text-app-text">{settings.memberName}</p>
                <p className="mt-1 text-sm text-app-text-muted">
                  Override conectado al tenant <span className="font-medium text-app-text">{settings.tenantName}</span>.
                </p>
                <p className="mt-3 text-xs text-app-text-soft">
                  Última actualización:{" "}
                  {settings.updatedAt ? formatDateTime(settings.updatedAt) : "Aún no guardada"}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className={secondaryPanelClassName}>
              <div className="flex items-center gap-2 text-sm font-semibold text-app-text">
                <Sparkles className="h-4 w-4 text-app-accent" />
                Prompt activo
              </div>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-app-text">
                {promptLength}
              </p>
              <p className="mt-1 text-sm text-app-text-muted">
                Caracteres listos para orientar tono, objeciones y cierre.
              </p>
            </div>

            <div className={secondaryPanelClassName}>
              <div className="flex items-center gap-2 text-sm font-semibold text-app-text">
                <Target className="h-4 w-4 text-app-accent" />
                CTA por defecto
              </div>
              <p className="mt-2 text-lg font-semibold text-app-text">
                {selectedCta?.label ?? "Sin definir"}
              </p>
              <p className="mt-1 text-sm text-app-text-muted">
                {selectedCta?.description ??
                  "Todavía no elegiste una CTA principal para el runtime."}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-[1.75rem] border border-app-border bg-app-surface p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-app-text">
              <Braces className="h-4 w-4 text-app-accent" />
              Placeholders disponibles
            </div>
            <p className="mt-2 text-sm leading-6 text-app-text-muted">
              Puedes usarlos dentro del prompt base para personalizar el runtime sin editar n8n.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {settings.availablePlaceholders.map((placeholder) => (
                <span
                  key={placeholder}
                  className="rounded-full border border-app-border bg-app-card px-3 py-1.5 text-xs font-semibold text-app-text"
                >
                  {placeholder}
                </span>
              ))}
            </div>
          </div>
        </article>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-[2rem] border border-app-border bg-app-card p-6 shadow-[var(--ai-panel-shadow)]"
        >
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-app-text-soft">
              Editor del sponsor
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-app-text">
              Prompt, rutas y cierre
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-app-text-muted">
              Guarda aquí la capa específica de Freddy. Si no existe override, la UI parte de la base heredada del team.
            </p>
          </div>

            <div className="space-y-2">
              <label htmlFor="ai-base-prompt" className={labelClassName}>
                Prompt Base
              </label>
              <textarea
                id="ai-base-prompt"
                value={form.basePrompt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    basePrompt: event.target.value,
                  }))
                }
                rows={10}
                className={`${inputClassName} min-h-[15rem] resize-y leading-7`}
                placeholder="Ejemplo: Habla como {{name}} del equipo {{team_name}} y usa {{whatsapp_link}} solo cuando la conversación ya pidió contacto directo."
              />
              <p className="text-sm text-app-text-muted">
                Puedes combinar instrucciones maestras, tono comercial y placeholders del runtime.
              </p>
            </div>

            <section className="space-y-4">
              <div>
                <p className={labelClassName}>Contextos de Ruta</p>
                <p className="mt-2 text-sm text-app-text-muted">
                  Define una frase corta por escenario para que el runtime sepa qué enfoque priorizar.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="route-risk" className={labelClassName}>
                    Risk
                  </label>
                  <input
                    id="route-risk"
                    value={form.routeContexts.risk}
                    onChange={handleContextChange("risk")}
                    className={inputClassName}
                    placeholder="Objeciones, miedo o percepción de riesgo."
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="route-offer" className={labelClassName}>
                    Offer
                  </label>
                  <input
                    id="route-offer"
                    value={form.routeContexts.offer}
                    onChange={handleContextChange("offer")}
                    className={inputClassName}
                    placeholder="Oferta principal y disparador comercial."
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="route-product" className={labelClassName}>
                    Product
                  </label>
                  <input
                    id="route-product"
                    value={form.routeContexts.product}
                    onChange={handleContextChange("product")}
                    className={inputClassName}
                    placeholder="Producto estrella o línea recomendada."
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="route-service" className={labelClassName}>
                    Service
                  </label>
                  <input
                    id="route-service"
                    value={form.routeContexts.service}
                    onChange={handleContextChange("service")}
                    className={inputClassName}
                    placeholder="Acompañamiento, onboarding o servicio asociado."
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label htmlFor="route-business" className={labelClassName}>
                    Business
                  </label>
                  <input
                    id="route-business"
                    value={form.routeContexts.business}
                    onChange={handleContextChange("business")}
                    className={inputClassName}
                    placeholder="Narrativa de oportunidad, negocio o crecimiento."
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <p className={labelClassName}>Política de CTA</p>
                <p className="mt-2 text-sm text-app-text-muted">
                  Elige la salida principal cuando el runtime detecte intención clara de avanzar.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="default-cta" className={labelClassName}>
                  Default CTA
                </label>
                <select
                  id="default-cta"
                  value={form.defaultCta}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      defaultCta: event.target.value,
                    }))
                  }
                  className={inputClassName}
                >
                  <option value="">Sin definir</option>
                  {ctaOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-app-border pt-2">
              <p className="text-sm text-app-text-muted">
                El guardado persiste tu override personal en <code>AiAgentConfig</code>.
              </p>
              <button type="submit" disabled={isSaving} className={primaryButtonClassName}>
                {isSaving ? "Guardando..." : "Guardar configuración"}
              </button>
            </div>
        </form>
      </section>

      <KnowledgeBaseCard tenantId={settings.tenantId} />
    </div>
  );
}
