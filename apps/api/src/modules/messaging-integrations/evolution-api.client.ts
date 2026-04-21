import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { joinUrlPath } from '../shared/url.utils';
import {
  isDisconnectedEvolutionState,
  normalizeMessagingPhone,
  normalizeQrCodeData,
  resolveQrExpiresAt,
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
  expiresAt: Date | null;
  raw: unknown;
};

type EvolutionRequestCandidate = {
  label: 'internal' | 'public';
  baseUrl: string;
};

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const EVOLUTION_WEBHOOK_EVENTS = [
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'SEND_MESSAGE',
  'CONNECTION_UPDATE',
] as const;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

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
  private readonly internalBaseUrl: string | null;
  private readonly publicBaseUrl: string | null;
  private readonly apiKey: string | null;
  private readonly apiInternalBaseUrl: string;
  private readonly incomingMessagingWebhookSecret: string | null;
  private readonly instancePrefix: string;
  private readonly automationWebhookBaseUrl: string | null;
  private readonly requestTimeoutMs: number;
  private readonly requestRetries: number;
  private readonly qrPollAttempts: number;
  private readonly qrPollDelayMs: number;

  constructor(private readonly configService: ConfigService) {
    this.internalBaseUrl =
      sanitizeNullableText(
        this.configService.get<string>('EVOLUTION_API_INTERNAL_BASE_URL'),
      ) ??
      sanitizeNullableText(
        this.configService.get<string>('EVOLUTION_API_BASE_URL'),
      );
    this.publicBaseUrl = sanitizeNullableText(
      this.configService.get<string>('EVOLUTION_API_PUBLIC_BASE_URL'),
    );
    this.apiKey = sanitizeNullableText(
      this.configService.get<string>('EVOLUTION_API_KEY'),
    );
    this.apiInternalBaseUrl =
      sanitizeNullableText(
        this.configService.get<string>('API_INTERNAL_BASE_URL'),
      ) ??
      sanitizeNullableText(process.env.API_INTERNAL_BASE_URL) ??
      'http://leadflow_api:3001';
    this.incomingMessagingWebhookSecret = sanitizeNullableText(
      this.configService.get<string>('INCOMING_MESSAGING_WEBHOOK_SECRET'),
    );
    this.instancePrefix =
      sanitizeNullableText(
        this.configService.get<string>('EVOLUTION_INSTANCE_PREFIX'),
      ) ?? 'leadflow';
    this.automationWebhookBaseUrl = sanitizeNullableText(
      this.configService.get<string>('N8N_AUTOMATION_WEBHOOK_BASE_URL'),
    );
    this.requestTimeoutMs = parsePositiveInt(
      this.configService.get<string>('EVOLUTION_REQUEST_TIMEOUT_MS'),
      15_000,
    );
    this.requestRetries = parsePositiveInt(
      this.configService.get<string>('EVOLUTION_REQUEST_RETRIES'),
      2,
    );
    this.qrPollAttempts = parsePositiveInt(
      this.configService.get<string>('EVOLUTION_QR_POLL_ATTEMPTS'),
      5,
    );
    this.qrPollDelayMs = parsePositiveInt(
      this.configService.get<string>('EVOLUTION_QR_POLL_DELAY_MS'),
      1_000,
    );
  }

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
    return EVOLUTION_WEBHOOK_EVENTS.join(', ');
  }

  getWebhookEvents() {
    return [...EVOLUTION_WEBHOOK_EVENTS];
  }

  buildInboundWebhookUrl(_instanceId: string) {
    const finalWebhookUrl = new URL(
      joinUrlPath(
        this.apiInternalBaseUrl,
        '/v1/incoming-webhooks/messaging',
      ),
    );

    if (this.incomingMessagingWebhookSecret) {
      finalWebhookUrl.searchParams.set(
        'secret',
        this.incomingMessagingWebhookSecret,
      );
    }

    console.log('EVOLUTION_WEBHOOK_REGISTRATION:', {
      targetUrl: finalWebhookUrl.toString(),
    });

    return finalWebhookUrl.toString();
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
        rejectCall: true,
        groupsIgnore: true,
        alwaysOnline: true,
        readMessages: true,
        readStatus: true,
        syncFullHistory: true,
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
    try {
      if (!webhookUrl) {
        console.warn('EVOLUTION_WEBHOOK_SET_SKIPPED:', {
          instanceId,
          reason: 'Inbound webhook URL is not configured.',
        });
        return false;
      }

      let response = await this.request(`webhook/set/${instanceId}`, {
        method: 'POST',
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: true,
            events: this.getWebhookEvents(),
            webhookBase64: true,
          },
        }),
      });

      if (response.status >= 200 && response.status < 300) {
        return true;
      }

      if (response.status === 404) {
        await this.createInstance(instanceId);
        await delay(2_000);

        response = await this.request(`webhook/set/${instanceId}`, {
          method: 'POST',
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: webhookUrl,
              webhookByEvents: true,
              events: this.getWebhookEvents(),
              webhookBase64: true,
            },
          }),
        });

        if (response.status >= 200 && response.status < 300) {
          return true;
        }
      }

      console.warn('EVOLUTION_WEBHOOK_SET_FAILED:', {
        instanceId,
        webhookUrl,
        error: {
          message: 'Webhook registration returned a non-success response.',
          status: response.status,
          details: response.data ?? null,
        },
      });
    } catch (error) {
      console.warn('EVOLUTION_WEBHOOK_SET_FAILED:', {
        instanceId,
        webhookUrl,
        error:
          error instanceof EvolutionApiClientError
            ? {
                message: error.message,
                status: error.status,
                details: error.details ?? null,
              }
            : error instanceof Error
              ? {
                  message: error.message,
                }
              : {
                  message: 'Unknown Evolution webhook registration error.',
                },
      });
    }

    return false;
  }

  async fetchQr(instanceId: string): Promise<EvolutionQrPayload> {
    for (let attempt = 1; attempt <= this.qrPollAttempts; attempt += 1) {
      const response = await this.request(`instance/connect/${instanceId}`, {
        method: 'GET',
      });

      if (response.status === 404) {
        if (attempt === 1) {
          await this.createInstance(instanceId);
          await delay(2_000);
          continue;
        }

        if (attempt < this.qrPollAttempts) {
          await delay(this.qrPollDelayMs);
          continue;
        }

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
      const expiresAt = resolveQrExpiresAt({
        payload: response.data,
      });

      if (qrCodeData || pairingCode) {
        return {
          qrCodeData,
          pairingCode,
          expiresAt,
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
      expiresAt: null,
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

  async restartInstance(instanceId: string) {
    const response = await this.request(`instance/restart/${instanceId}`, {
      method: 'PUT',
    });

    if (response.status >= 200 && response.status < 300) {
      return response;
    }

    if (response.status === 404) {
      return response;
    }

    throw this.toError(
      'EVOLUTION_INSTANCE_RESTART_FAILED',
      response,
      'No pudimos reiniciar la instancia en Evolution.',
    );
  }

  async recreateInstance(instanceId: string) {
    await this.deleteInstance(instanceId);
    await this.createInstance(instanceId);
    return await this.waitForInstanceExists(instanceId);
  }

  shouldRegenerateQrSession(input: {
    state: string | null;
    qrExpiresAt?: Date | null;
  }) {
    const normalizedState = input.state?.trim().toLowerCase() ?? null;

    if (normalizedState === 'open' || normalizedState === 'connected') {
      return false;
    }

    return (
      isDisconnectedEvolutionState(input.state) ||
      Boolean(
        input.qrExpiresAt && input.qrExpiresAt.getTime() <= Date.now(),
      )
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
      const requestUrl = joinUrlPath(candidate.baseUrl, path);
      const response = await fetch(requestUrl, {
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
