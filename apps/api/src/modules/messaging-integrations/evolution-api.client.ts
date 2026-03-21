import { Injectable } from '@nestjs/common';
import {
  normalizeMessagingPhone,
  normalizeQrCodeData,
  sanitizeNullableText,
} from './messaging-integrations.utils';

type EvolutionResponse = {
  status: number;
  data: unknown;
  baseUrl: string;
};

type EvolutionConnectionState = {
  exists: boolean;
  state: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  raw: unknown;
};

type EvolutionQrPayload = {
  qrCodeData: string | null;
  pairingCode: string | null;
  raw: unknown;
};

type EvolutionRequestCandidate = {
  label: 'internal' | 'public';
  baseUrl: string;
};

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const normalizeWebhookEvent = (value: string | null) => {
  if (!value) {
    return 'MESSAGES_UPSERT';
  }

  return value
    .trim()
    .replace(/[\s.-]+/g, '_')
    .toUpperCase();
};

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const delay = async (ms: number) =>
  await new Promise((resolve) => setTimeout(resolve, ms));

export class EvolutionApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

@Injectable()
export class EvolutionApiClient {
  private readonly internalBaseUrl =
    sanitizeNullableText(process.env.EVOLUTION_API_INTERNAL_BASE_URL) ??
    sanitizeNullableText(process.env.EVOLUTION_API_BASE_URL);
  private readonly publicBaseUrl = sanitizeNullableText(
    process.env.EVOLUTION_API_PUBLIC_BASE_URL,
  );
  private readonly apiKey = sanitizeNullableText(process.env.EVOLUTION_API_KEY);
  private readonly instancePrefix =
    sanitizeNullableText(process.env.EVOLUTION_INSTANCE_PREFIX) ?? 'leadflow';
  private readonly automationWebhookBaseUrl = sanitizeNullableText(
    process.env.MESSAGING_AUTOMATION_WEBHOOK_BASE_URL,
  );
  private readonly webhookEvent = normalizeWebhookEvent(
    sanitizeNullableText(process.env.EVOLUTION_WEBHOOK_EVENT),
  );
  private readonly requestTimeoutMs = parsePositiveInt(
    process.env.EVOLUTION_REQUEST_TIMEOUT_MS,
    15_000,
  );
  private readonly requestRetries = parsePositiveInt(
    process.env.EVOLUTION_REQUEST_RETRIES,
    2,
  );
  private readonly qrPollAttempts = parsePositiveInt(
    process.env.EVOLUTION_QR_POLL_ATTEMPTS,
    5,
  );
  private readonly qrPollDelayMs = parsePositiveInt(
    process.env.EVOLUTION_QR_POLL_DELAY_MS,
    1_000,
  );

  isConfigured() {
    return Boolean(this.apiKey && (this.internalBaseUrl || this.publicBaseUrl));
  }

  hasInternalBaseUrl() {
    return Boolean(this.internalBaseUrl);
  }

  hasPublicFallbackBaseUrl() {
    return Boolean(
      this.publicBaseUrl && this.publicBaseUrl !== this.internalBaseUrl,
    );
  }

  getRoutingMode(): 'internal' | 'public' | 'unconfigured' {
    if (this.internalBaseUrl) {
      return 'internal';
    }

    if (this.publicBaseUrl) {
      return 'public';
    }

    return 'unconfigured';
  }

  getInstancePrefix() {
    return this.instancePrefix;
  }

  hasAutomationWebhookBaseUrl() {
    return Boolean(this.automationWebhookBaseUrl);
  }

  getAutomationWebhookBaseUrl() {
    return this.automationWebhookBaseUrl;
  }

  getWebhookEvent() {
    return this.webhookEvent;
  }

  async ensureInstanceExists(instanceId: string) {
    const state = await this.getConnectionState(instanceId);

    if (state.exists) {
      return state;
    }

    await this.createInstance(instanceId);
    return await this.waitForInstanceExists(instanceId);
  }

  async createInstance(instanceId: string) {
    const response = await this.request('instance/create', {
      method: 'POST',
      body: JSON.stringify({
        instanceName: instanceId,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      }),
    });

    if (
      response.status === 200 ||
      response.status === 201 ||
      response.status === 409
    ) {
      return response;
    }

    throw this.toError(
      'EVOLUTION_INSTANCE_CREATE_FAILED',
      response,
      'No pudimos crear la instancia de WhatsApp en Evolution.',
    );
  }

  async setWebhook(instanceId: string, webhookUrl: string | null) {
    if (!webhookUrl) {
      return null;
    }

    for (let attempt = 1; attempt <= this.qrPollAttempts; attempt += 1) {
      const response = await this.request(`webhook/set/${instanceId}`, {
        method: 'POST',
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            events: [this.webhookEvent],
            webhookBase64: true,
            webhook_base64: true,
          },
        }),
      });

      if (response.status >= 200 && response.status < 300) {
        return response;
      }

      if (response.status === 404 && attempt < this.qrPollAttempts) {
        await delay(this.qrPollDelayMs);
        continue;
      }

      throw this.toError(
        'EVOLUTION_WEBHOOK_SET_FAILED',
        response,
        'No pudimos registrar el webhook operativo de la conexión.',
      );
    }
  }

  async fetchQr(instanceId: string): Promise<EvolutionQrPayload> {
    for (let attempt = 1; attempt <= this.qrPollAttempts; attempt += 1) {
      const response = await this.request(`instance/connect/${instanceId}`, {
        method: 'GET',
      });

      if (response.status === 404) {
        throw this.toError(
          'EVOLUTION_INSTANCE_NOT_FOUND',
          response,
          'La instancia solicitada no existe en Evolution.',
        );
      }

      if (response.status < 200 || response.status >= 300) {
        throw this.toError(
          'EVOLUTION_QR_FETCH_FAILED',
          response,
          'No pudimos pedir el QR actual de WhatsApp.',
        );
      }

      const payload = asRecord(response.data);
      const qrCodeData = normalizeQrCodeData(
        readString(payload?.base64) ??
          readString(payload?.qrcode) ??
          readString(asRecord(payload?.qrcode)?.base64),
      );
      const pairingCode =
        readString(payload?.code) ??
        readString(payload?.pairingCode) ??
        readString(payload?.pairing_code);

      if (qrCodeData || pairingCode) {
        return {
          qrCodeData,
          pairingCode,
          raw: response.data,
        };
      }

      if (attempt < this.qrPollAttempts) {
        await delay(this.qrPollDelayMs);
      }
    }

    return {
      qrCodeData: null,
      pairingCode: null,
      raw: null,
    };
  }

  async getConnectionState(
    instanceId: string,
  ): Promise<EvolutionConnectionState> {
    const response = await this.request(
      `instance/connectionState/${instanceId}`,
      {
        method: 'GET',
      },
    );

    if (response.status === 404) {
      return {
        exists: false,
        state: null,
        phone: null,
        normalizedPhone: null,
        raw: response.data,
      };
    }

    if (response.status < 200 || response.status >= 300) {
      throw this.toError(
        'EVOLUTION_STATUS_FAILED',
        response,
        'No pudimos leer el estado actual de la conexión.',
      );
    }

    const payload = asRecord(response.data);
    const instance = asRecord(payload?.instance) ?? payload;
    const rawPhone =
      readString(instance?.owner) ??
      readString(instance?.number) ??
      readString(instance?.ownerJid) ??
      readString(payload?.number);
    const phone = rawPhone?.split('@')[0] ?? null;

    return {
      exists: true,
      state: readString(instance?.state) ?? readString(payload?.state),
      phone,
      normalizedPhone: normalizeMessagingPhone(phone),
      raw: response.data,
    };
  }

  async deleteInstance(instanceId: string) {
    const response = await this.request(`instance/delete/${instanceId}`, {
      method: 'DELETE',
    });

    if (response.status >= 200 && response.status < 300) {
      return response;
    }

    if (response.status === 404) {
      return response;
    }

    throw this.toError(
      'EVOLUTION_INSTANCE_DELETE_FAILED',
      response,
      'No pudimos eliminar la instancia en Evolution.',
    );
  }

  private async waitForInstanceExists(
    instanceId: string,
  ): Promise<EvolutionConnectionState> {
    for (let attempt = 1; attempt <= this.qrPollAttempts; attempt += 1) {
      const state = await this.getConnectionState(instanceId);

      if (state.exists) {
        return state;
      }

      if (attempt < this.qrPollAttempts) {
        await delay(this.qrPollDelayMs);
      }
    }

    throw new EvolutionApiClientError(
      `EVOLUTION_INSTANCE_NOT_READY: La instancia ${instanceId} todavia no esta disponible en Evolution.`,
      404,
      {
        instanceId,
      },
    );
  }

  private async request(
    path: string,
    init: RequestInit,
  ): Promise<EvolutionResponse> {
    const candidates = this.getCandidates();

    if (!this.apiKey || candidates.length === 0) {
      throw new EvolutionApiClientError(
        'Evolution API is not configured.',
        503,
      );
    }

    let lastError: EvolutionApiClientError | null = null;

    for (const candidate of candidates) {
      for (let attempt = 1; attempt <= this.requestRetries + 1; attempt += 1) {
        try {
          const response = await this.requestOnce(candidate, path, init);

          if (
            RETRYABLE_STATUS_CODES.has(response.status) &&
            attempt <= this.requestRetries
          ) {
            await delay(250 * attempt);
            continue;
          }

          return response;
        } catch (error) {
          const clientError = this.toClientError(error, candidate);
          lastError = clientError;

          if (
            (clientError.status === 408 || clientError.status === 504) &&
            attempt <= this.requestRetries
          ) {
            await delay(250 * attempt);
            continue;
          }

          break;
        }
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new EvolutionApiClientError(
      'Evolution API request failed unexpectedly.',
      502,
    );
  }

  private async requestOnce(
    candidate: EvolutionRequestCandidate,
    path: string,
    init: RequestInit,
  ): Promise<EvolutionResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.requestTimeoutMs,
    );

    try {
      const response = await fetch(
        `${candidate.baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`,
        {
          ...init,
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            apikey: this.apiKey!,
            'x-api-key': this.apiKey!,
            Authorization: `Bearer ${this.apiKey!}`,
            ...(init.headers ?? {}),
          },
        },
      );

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
        baseUrl: candidate.baseUrl,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private getCandidates(): EvolutionRequestCandidate[] {
    const candidates: EvolutionRequestCandidate[] = [];

    if (this.internalBaseUrl) {
      candidates.push({
        label: 'internal',
        baseUrl: this.internalBaseUrl,
      });
    }

    if (this.publicBaseUrl && this.publicBaseUrl !== this.internalBaseUrl) {
      candidates.push({
        label: 'public',
        baseUrl: this.publicBaseUrl,
      });
    }

    return candidates;
  }

  private toClientError(error: unknown, candidate: EvolutionRequestCandidate) {
    if (error instanceof EvolutionApiClientError) {
      return error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      return new EvolutionApiClientError(
        `Evolution request timed out via ${candidate.label} route.`,
        408,
        {
          route: candidate.label,
          baseUrl: candidate.baseUrl,
        },
      );
    }

    if (error instanceof Error) {
      return new EvolutionApiClientError(
        `Evolution request failed via ${candidate.label} route: ${error.message}`,
        504,
        {
          route: candidate.label,
          baseUrl: candidate.baseUrl,
        },
      );
    }

    return new EvolutionApiClientError(
      `Evolution request failed via ${candidate.label} route.`,
      504,
      {
        route: candidate.label,
        baseUrl: candidate.baseUrl,
      },
    );
  }

  private toError(
    code: string,
    response: EvolutionResponse,
    fallbackMessage: string,
  ) {
    const payload = asRecord(response.data);
    const nestedResponse = asRecord(payload?.response);
    const message =
      readString(payload?.message) ??
      readString(nestedResponse?.message) ??
      fallbackMessage;

    return new EvolutionApiClientError(`${code}: ${message}`, response.status, {
      code,
      baseUrl: response.baseUrl,
      response: response.data,
    });
  }
}
