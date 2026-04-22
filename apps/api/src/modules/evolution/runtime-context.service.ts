import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  joinUrlPath,
  normalizeBaseUrl,
  sanitizeNullableText,
} from '../shared/url.utils';

type RegisterBindingInput = {
  instanceName: string;
  tenantId: string;
  verticalKey: string;
};

type RuntimeContextUpsertPayload = {
  provider: 'evolution';
  channel: 'whatsapp';
  instance_name: string;
  tenant_id: string;
  service_owner_key: 'lead-handler';
  status: 'active';
  source_system: 'leadflow';
  vertical_key: string;
};

type RuntimeContextResponse = {
  status: number;
  data: unknown;
};

const DEFAULT_TIMEOUT_MS = 5_000;
const UPSERT_PATH = '/v1/admin/channel-bindings/upsert';
const SERVICE_KEY = 'leadflow-api';

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

@Injectable()
export class RuntimeContextService {
  private readonly baseUrl = normalizeBaseUrl(
    process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL ?? process.env.RUNTIME_CONTEXT_URL,
  );
  private readonly apiKey = sanitizeNullableText(
    process.env.RUNTIME_CONTEXT_CENTRAL_API_KEY ??
      process.env.RUNTIME_CONTEXT_INTERNAL_KEY,
  );
  private readonly timeoutMs = parsePositiveInt(
    process.env.RUNTIME_CONTEXT_REQUEST_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );

  async registerBinding(input: RegisterBindingInput): Promise<{ success: true }> {
    const payload = this.buildPayload(input);
    const response = await this.request({
      method: 'POST',
      path: UPSERT_PATH,
      body: payload,
    });

    if (response.status >= 200 && response.status < 300) {
      return { success: true };
    }

    throw new InternalServerErrorException({
      code: 'RUNTIME_CONTEXT_UPSERT_FAILED',
      message: `Runtime Context upsert failed with HTTP ${response.status}.`,
      details: response.data,
    });
  }

  async deleteBinding(instanceName: string): Promise<{ success: true }> {
    const normalizedInstanceName = this.requireText(instanceName, 'instanceName');
    const response = await this.request({
      method: 'DELETE',
      path: `/v1/admin/channel-bindings/${encodeURIComponent(normalizedInstanceName)}`,
    });

    if (
      (response.status >= 200 && response.status < 300) ||
      response.status === 404
    ) {
      return { success: true };
    }

    throw new InternalServerErrorException({
      code: 'RUNTIME_CONTEXT_DELETE_FAILED',
      message: `Runtime Context delete failed with HTTP ${response.status}.`,
      details: response.data,
    });
  }

  private buildPayload(input: RegisterBindingInput): RuntimeContextUpsertPayload {
    return {
      provider: 'evolution',
      channel: 'whatsapp',
      instance_name: this.requireText(input.instanceName, 'instanceName'),
      tenant_id: this.requireText(input.tenantId, 'tenantId'),
      service_owner_key: 'lead-handler',
      status: 'active',
      source_system: 'leadflow',
      vertical_key: this.requireText(input.verticalKey, 'verticalKey'),
    };
  }

  private async request(input: {
    method: 'POST' | 'DELETE';
    path: string;
    body?: RuntimeContextUpsertPayload;
  }): Promise<RuntimeContextResponse> {
    this.ensureConfigured();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(joinUrlPath(this.baseUrl!, input.path), {
        method: input.method,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'x-internal-api-key': this.apiKey!,
          'x-service-key': SERVICE_KEY,
        },
        ...(input.body ? { body: JSON.stringify(input.body) } : {}),
      });

      const raw = await response.text();
      let data: unknown = null;

      if (raw) {
        try {
          data = JSON.parse(raw) as unknown;
        } catch {
          data = raw;
        }
      }

      return {
        status: response.status,
        data,
      };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError'
      ) {
        throw new GatewayTimeoutException({
          code: 'RUNTIME_CONTEXT_TIMEOUT',
          message: 'Runtime Context admin API timed out.',
        });
      }

      throw new BadGatewayException({
        code: 'RUNTIME_CONTEXT_UNREACHABLE',
        message: 'Runtime Context admin API request failed.',
        details: error instanceof Error ? error.message : 'Unknown upstream error.',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private ensureConfigured() {
    if (this.baseUrl && this.apiKey) {
      return;
    }

    throw new ServiceUnavailableException({
      code: 'RUNTIME_CONTEXT_NOT_CONFIGURED',
      message:
        'Runtime Context admin API is not configured. Set RUNTIME_CONTEXT_CENTRAL_BASE_URL and RUNTIME_CONTEXT_CENTRAL_API_KEY.',
    });
  }

  private requireText(value: string | null | undefined, field: string) {
    const normalized = sanitizeNullableText(value);

    if (normalized) {
      return normalized;
    }

    throw new InternalServerErrorException({
      code: 'RUNTIME_CONTEXT_FIELD_REQUIRED',
      message: `${field} is required.`,
    });
  }
}
