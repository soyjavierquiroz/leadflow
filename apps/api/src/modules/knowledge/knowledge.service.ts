import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Buffer } from 'node:buffer';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  normalizeBaseUrl,
  sanitizeNullableText,
} from '../shared/url.utils';

const DEFAULT_RUNTIME_CONTEXT_BASE_URL =
  'http://runtime_context_service:8080';
const DEFAULT_N8N_RAG_INGESTION_WEBHOOK_URL =
  'http://n8n_v2_webhook:5678/webhook/rag-ingestion';
const N8N_RAG_INGESTION_HOST_HEADER = 'webhooks.kuruk.in';
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_UPLOAD_TIMEOUT_MS = 30_000;
const KNOWLEDGE_RATE_PER_THOUSAND = 0.05;
const KNOWLEDGE_LIST_PATH = '/knowledge/list';
const KNOWLEDGE_DELETE_PATH = '/knowledge/delete';
const RUNTIME_CONTEXT_SERVICE_KEY = 'leadflow_api' as const;

type KnowledgeAuditOperationInput = 'upload' | 'delete';

type RuntimeContextRequestInput = {
  path: string;
  method: 'GET' | 'DELETE';
  searchParams?: Record<string, string>;
  body?: Record<string, unknown>;
  label: string;
};

export type KnowledgeUploadFile = {
  buffer: Buffer;
  filename: string;
  mimeType: string;
};

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const parseResponseBody = async (response: Response) => {
  const raw = await response.text();

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
};

const normalizeCostKredits = (value: string | null | undefined) => {
  if (!value) {
    return '0.000000';
  }

  const parsed = Number(value.replace(',', '.'));

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new BadRequestException({
      code: 'KNOWLEDGE_AUDIT_COST_INVALID',
      message: 'cost_kredits must be a positive number.',
    });
  }

  return parsed.toFixed(6);
};

const resolveTrainingCostKredits = (
  metadata: Record<string, string>,
  fallbackCost: string | null | undefined,
) => {
  const characterCountValue =
    metadata.character_count ??
    metadata.characterCount ??
    metadata.characters ??
    metadata.text_characters;
  const parsedCharacterCount = Number(characterCountValue?.replace(',', '.'));

  if (Number.isFinite(parsedCharacterCount) && parsedCharacterCount >= 0) {
    return ((parsedCharacterCount / 1_000) * KNOWLEDGE_RATE_PER_THOUSAND).toFixed(
      6,
    );
  }

  return normalizeCostKredits(fallbackCost);
};

const getObjectStringValue = (value: unknown, keys: string[]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  for (const key of keys) {
    const nextValue = record[key];

    if (typeof nextValue === 'string') {
      return nextValue;
    }

    if (typeof nextValue === 'number' && Number.isFinite(nextValue)) {
      return String(nextValue);
    }
  }

  return null;
};

const resolveDocumentIdFromPayload = (
  payload: unknown,
  metadata: Record<string, string>,
) =>
  sanitizeNullableText(
    metadata.document_id ??
      metadata.documentId ??
      metadata.file_id ??
      metadata.fileId ??
      getObjectStringValue(payload, [
        'document_id',
        'documentId',
        'file_id',
        'fileId',
        'source_id',
        'sourceId',
        'id',
      ]),
  );

@Injectable()
export class KnowledgeService {
  private readonly baseUrl =
    normalizeBaseUrl(process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL) ??
    DEFAULT_RUNTIME_CONTEXT_BASE_URL;
  private readonly apiKey = sanitizeNullableText(
    process.env.RUNTIME_CONTEXT_CENTRAL_API_KEY ??
      process.env.RUNTIME_CONTEXT_INTERNAL_KEY ??
      process.env.INTERNAL_API_KEY,
  );
  private readonly timeoutMs = parsePositiveInt(
    process.env.RUNTIME_CONTEXT_REQUEST_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );
  private readonly ragIngestionWebhookUrl =
    DEFAULT_N8N_RAG_INGESTION_WEBHOOK_URL;
  private readonly uploadTimeoutMs = parsePositiveInt(
    process.env.N8N_RAG_INGESTION_TIMEOUT_MS,
    DEFAULT_UPLOAD_TIMEOUT_MS,
  );

  constructor(private readonly prisma: PrismaService) {}

  async listDocuments(input: { tenantId: string }) {
    const tenantId = sanitizeNullableText(input.tenantId);

    if (!tenantId) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_TENANT_ID_REQUIRED',
        message: 'tenant_id is required.',
      });
    }

    return this.requestRuntimeContext({
      path: KNOWLEDGE_LIST_PATH,
      method: 'GET',
      searchParams: { tenant_id: tenantId },
      label: 'knowledge list',
    });
  }

  async listAudit(input: { tenantId: string }) {
    const tenantId = sanitizeNullableText(input.tenantId);

    if (!tenantId) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_TENANT_ID_REQUIRED',
        message: 'tenant_id is required.',
      });
    }

    const audits = await this.prisma.knowledgeAudit.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return {
      items: audits.map((audit) => ({
        id: audit.id,
        tenantId: audit.tenantId,
        operation: audit.operation,
        documentId: audit.documentId,
        fileName: audit.fileName,
        costKredits: audit.costKredits.toString(),
        userId: audit.userId,
        userName: audit.userName,
        createdAt: audit.createdAt.toISOString(),
      })),
    };
  }

  async recordAudit(input: {
    tenantId: string;
    user: AuthenticatedUser;
    operation: KnowledgeAuditOperationInput;
    fileName: string;
    documentId?: string | null;
    costKredits?: string | null;
  }) {
    const tenantId = sanitizeNullableText(input.tenantId);
    const fileName = sanitizeNullableText(input.fileName);

    if (!tenantId) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_TENANT_ID_REQUIRED',
        message: 'tenant_id is required.',
      });
    }

    if (!fileName) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_AUDIT_FILE_NAME_REQUIRED',
        message: 'file_name is required.',
      });
    }

    const audit = await this.prisma.knowledgeAudit.create({
      data: {
        tenantId,
        userId: input.user.id,
        userName: input.user.fullName,
        operation: input.operation,
        documentId: sanitizeNullableText(input.documentId),
        fileName,
        costKredits: normalizeCostKredits(input.costKredits),
      },
    });

    return {
      id: audit.id,
      tenantId: audit.tenantId,
      operation: audit.operation,
      documentId: audit.documentId,
      fileName: audit.fileName,
      costKredits: audit.costKredits.toString(),
      userId: audit.userId,
      userName: audit.userName,
      createdAt: audit.createdAt.toISOString(),
    };
  }

  async uploadDocument(input: {
    tenantId: string;
    user: AuthenticatedUser;
    file: KnowledgeUploadFile;
    metadata: Record<string, string>;
    costKredits?: string | null;
  }) {
    const tenantId = sanitizeNullableText(input.tenantId);
    const fileName = sanitizeNullableText(input.file.filename);

    if (!tenantId) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_TENANT_ID_REQUIRED',
        message: 'tenant_id is required.',
      });
    }

    if (!fileName) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_UPLOAD_FILE_NAME_REQUIRED',
        message: 'A PDF file name is required.',
      });
    }

    if (!fileName.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_UPLOAD_PDF_REQUIRED',
        message: 'Only PDF files can be uploaded.',
      });
    }

    const costKredits = resolveTrainingCostKredits(
      input.metadata,
      input.costKredits,
    );
    const data = await this.forwardUploadToN8n({
      tenantId,
      file: input.file,
      metadata: input.metadata,
      costKredits,
    });
    const documentId = resolveDocumentIdFromPayload(data, input.metadata);
    const audit = await this.recordAudit({
      tenantId,
      user: input.user,
      operation: 'upload',
      fileName,
      documentId,
      costKredits,
    });

    return {
      ok: true,
      documentId,
      audit,
      upstream: data,
    };
  }

  async deleteDocument(input: {
    tenantId: string;
    user: AuthenticatedUser;
    fileName: string;
    documentId?: string | null;
  }) {
    const tenantId = sanitizeNullableText(input.tenantId);
    const fileName = sanitizeNullableText(input.fileName);
    const documentId = sanitizeNullableText(input.documentId);

    if (!tenantId) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_TENANT_ID_REQUIRED',
        message: 'tenant_id is required.',
      });
    }

    if (!fileName) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_DELETE_FILE_NAME_REQUIRED',
        message: 'file_name is required.',
      });
    }

    if (documentId) {
      return this.deleteDocumentById({
        tenantId,
        user: input.user,
        documentId,
        fileName,
      });
    }

    const data = await this.requestRuntimeContext({
      path: KNOWLEDGE_DELETE_PATH,
      method: 'DELETE',
      body: {
        tenant_id: tenantId,
        document_id: documentId,
        file_name: fileName,
      },
      label: 'knowledge delete',
    });

    await this.recordAudit({
      tenantId,
      user: input.user,
      operation: 'delete',
      fileName,
      documentId,
      costKredits: '0',
    });

    return data;
  }

  async deleteDocumentById(input: {
    tenantId: string;
    user: AuthenticatedUser;
    documentId: string;
    fileName: string;
  }) {
    const tenantId = sanitizeNullableText(input.tenantId);
    const documentId = sanitizeNullableText(input.documentId);

    if (!tenantId) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_TENANT_ID_REQUIRED',
        message: 'tenant_id is required.',
      });
    }

    if (!documentId) {
      throw new BadRequestException({
        code: 'KNOWLEDGE_DOCUMENT_ID_REQUIRED',
        message: 'Knowledge document id is required.',
      });
    }

    const fileName = sanitizeNullableText(input.fileName) ?? documentId;

    // Runtime Context hard delete expects document id in the path and tenant
    // scope in the query string; sending a JSON body reintroduces legacy
    // soft-delete behavior in older workflow variants.
    const data = await this.requestRuntimeContext({
      path: '/v1/knowledge/' + documentId + '?tenant_id=' + tenantId,
      method: 'DELETE',
      label: 'knowledge hard delete',
    });

    await this.recordAudit({
      tenantId,
      user: input.user,
      operation: 'delete',
      fileName,
      documentId,
      costKredits: '0.000000',
    });

    return data;
  }

  private async forwardUploadToN8n(input: {
    tenantId: string;
    file: KnowledgeUploadFile;
    metadata: Record<string, string>;
    costKredits: string;
  }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.uploadTimeoutMs);
    const formData = new FormData();
    const fileName = sanitizeNullableText(input.file.filename) ?? 'knowledge.pdf';

    formData.append(
      'file',
      new Blob([new Uint8Array(input.file.buffer)], {
        type: input.file.mimeType || 'application/pdf',
      }),
      fileName,
    );
    formData.append('tenant_id', input.tenantId);
    formData.append('file_name', fileName);
    formData.append('cost_kredits', input.costKredits);
    formData.append('training_cost_kredits', input.costKredits);

    // The n8n RAG ingestion webhook is multi-stack. Client-provided routing
    // fields such as platform_key and product_key must pass through untouched.
    for (const [key, value] of Object.entries(input.metadata)) {
      if (
        key === 'tenant_id' ||
        key === 'tenantId' ||
        key === 'file_name' ||
        key === 'fileName' ||
        key === 'cost' ||
        key === 'cost_kredits' ||
        key === 'costKredits' ||
        key === 'training_cost_kredits' ||
        key === 'trainingCostKredits'
      ) {
        continue;
      }

      formData.append(key, value);
    }

    try {
      const response = await fetch(this.ragIngestionWebhookUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Host: N8N_RAG_INGESTION_HOST_HEADER,
        },
        body: formData,
      });
      const data = await parseResponseBody(response);

      if (response.status < 200 || response.status >= 300) {
        throw new BadGatewayException({
          code: 'KNOWLEDGE_UPLOAD_UPSTREAM_ERROR',
          message: `n8n RAG ingestion failed with HTTP ${response.status}.`,
          details: data,
          upstreamStatus: response.status,
        });
      }

      return data;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError'
      ) {
        throw new GatewayTimeoutException({
          code: 'KNOWLEDGE_UPLOAD_UPSTREAM_TIMEOUT',
          message: 'n8n RAG ingestion timed out.',
        });
      }

      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException({
        code: 'KNOWLEDGE_UPLOAD_UPSTREAM_UNREACHABLE',
        message: 'n8n RAG ingestion request failed.',
        details: error instanceof Error ? error.message : 'Unknown upstream error.',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private ensureConfigured() {
    if (this.apiKey) {
      return;
    }

    throw new ServiceUnavailableException({
      code: 'KNOWLEDGE_INTERNAL_API_KEY_MISSING',
      message:
        'Runtime Context internal API key is not configured. Set RUNTIME_CONTEXT_CENTRAL_API_KEY.',
    });
  }

  private async requestRuntimeContext(input: RuntimeContextRequestInput) {
    this.ensureConfigured();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = this.buildRuntimeContextUrl(input.path, input.searchParams);
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'x-internal-api-key': this.apiKey ?? '',
      'x-service-key': RUNTIME_CONTEXT_SERVICE_KEY,
    };

    if (input.body) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, {
        method: input.method,
        signal: controller.signal,
        headers,
        body: input.body ? JSON.stringify(input.body) : undefined,
      });
      const data = await parseResponseBody(response);

      if (response.status < 200 || response.status >= 300) {
        throw new BadGatewayException({
          code: 'KNOWLEDGE_UPSTREAM_ERROR',
          message: `Runtime Context ${input.label} failed with HTTP ${response.status}.`,
          details: data,
          upstreamStatus: response.status,
        });
      }

      return data;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError'
      ) {
        throw new GatewayTimeoutException({
          code: 'KNOWLEDGE_UPSTREAM_TIMEOUT',
          message: `Runtime Context ${input.label} timed out.`,
        });
      }

      if (error instanceof BadGatewayException) {
        throw error;
      }

      throw new BadGatewayException({
        code: 'KNOWLEDGE_UPSTREAM_UNREACHABLE',
        message: `Runtime Context ${input.label} request failed.`,
        details: error instanceof Error ? error.message : 'Unknown upstream error.',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildRuntimeContextUrl(
    path: string,
    searchParams?: Record<string, string>,
  ) {
    const normalizedBaseUrl = this.baseUrl.replace(/\/+$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const baseUrl = normalizedPath.startsWith('/v1/')
      ? normalizedBaseUrl.replace(/\/v1$/, '')
      : normalizedBaseUrl;
    const apiBasePath = normalizedBaseUrl.endsWith('/v1')
      ? baseUrl
      : `${baseUrl}/v1`;
    const url = new URL(
      normalizedPath.startsWith('/v1/')
        ? `${baseUrl}${normalizedPath}`
        : `${apiBasePath}${normalizedPath}`,
    );

    for (const [key, value] of Object.entries(searchParams ?? {})) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }
}
