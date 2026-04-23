import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
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

type RuntimeContextRequestInput =
  | {
      method: 'POST';
      path: string;
      body: RuntimeContextUpsertPayload;
    }
  | {
      method: 'DELETE';
      path: string;
      body?: undefined;
    };

const DEFAULT_TIMEOUT_MS = 5_000;
const ADMIN_BINDINGS_PATH = '/admin/channel-bindings';

class RuntimeContextError extends BadGatewayException {
  constructor(status: number, errorBody: string) {
    super({
      code: 'RUNTIME_CONTEXT_UPSTREAM_ERROR',
      message: `RuntimeContextError: ${status} - ${errorBody}`,
      details: errorBody,
      upstreamStatus: status,
    });
  }
}

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
    process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL,
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
    await this.request({
      method: 'POST',
      path: `${ADMIN_BINDINGS_PATH}/upsert`,
      body: payload,
    });

    return { success: true };
  }

  async deleteBinding(instanceName: string): Promise<{ success: true }> {
    const normalizedInstanceName = this.requireText(instanceName, 'instanceName');
    await this.request({
      method: 'DELETE',
      path: `${ADMIN_BINDINGS_PATH}/${encodeURIComponent(normalizedInstanceName)}`,
    });

    return { success: true };
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

  private validateUpsertPayload(payload: RuntimeContextUpsertPayload | undefined) {
    if (payload === undefined) {
      throw new InternalServerErrorException({
        code: 'RUNTIME_CONTEXT_UPSERT_PAYLOAD_REQUIRED',
        message: 'Runtime Context upsert payload is required.',
      });
    }

    this.requireText(payload.provider, 'provider');
    this.requireText(payload.channel, 'channel');
    this.requireText(payload.instance_name, 'instance_name');
    this.requireText(payload.tenant_id, 'tenant_id');
    this.requireText(payload.service_owner_key, 'service_owner_key');
  }

  private async request(
    input: RuntimeContextRequestInput,
  ): Promise<RuntimeContextResponse> {
    this.ensureConfigured();

    if (input.method === 'POST') {
      this.validateUpsertPayload(input.body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const hasBody = input.method === 'POST';
      const apiBasePath = this.baseUrl.endsWith('/v1')
        ? this.baseUrl
        : `${this.baseUrl}/v1`;
      const finalUrl = `${apiBasePath}${
        input.method === 'POST' ? `${ADMIN_BINDINGS_PATH}/upsert` : input.path
      }`.replace(/([^:]\/)\/+/g, '$1');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-internal-api-key': this.apiKey ?? '',
        'x-service-key': 'leadflow_api',
      };

      const response = await fetch(finalUrl, {
        method: input.method,
        signal: controller.signal,
        headers,
        ...(hasBody ? { body: JSON.stringify(input.body) } : {}),
      });

      const errorBody = await response.text();
      let data: unknown = null;

      if (errorBody) {
        try {
          data = JSON.parse(errorBody) as unknown;
        } catch {
          data = errorBody;
        }
      }

      if (response.status < 200 || response.status >= 300) {
        throw new RuntimeContextError(
          response.status,
          errorBody || 'Empty response body',
        );
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

      if (error instanceof RuntimeContextError) {
        throw error;
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
