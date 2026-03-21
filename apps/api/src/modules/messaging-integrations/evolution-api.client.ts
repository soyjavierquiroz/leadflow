import { Injectable } from '@nestjs/common';
import {
  normalizeMessagingPhone,
  normalizeQrCodeData,
  sanitizeNullableText,
} from './messaging-integrations.utils';

type EvolutionResponse = {
  status: number;
  data: unknown;
};

type EvolutionConnectionState = {
  exists: boolean;
  state: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  raw: unknown;
};

type EvolutionConnectPayload = {
  qrCodeData: string | null;
  pairingCode: string | null;
  raw: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

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
  private readonly baseUrl = sanitizeNullableText(
    process.env.EVOLUTION_API_BASE_URL,
  );
  private readonly apiKey = sanitizeNullableText(process.env.EVOLUTION_API_KEY);
  private readonly instancePrefix =
    sanitizeNullableText(process.env.EVOLUTION_INSTANCE_PREFIX) ?? 'leadflow';
  private readonly automationWebhookBaseUrl = sanitizeNullableText(
    process.env.MESSAGING_AUTOMATION_WEBHOOK_BASE_URL,
  );
  private readonly webhookEvent =
    sanitizeNullableText(process.env.EVOLUTION_WEBHOOK_EVENT) ??
    'messages.upsert';

  isConfigured() {
    return Boolean(this.baseUrl && this.apiKey);
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
      return;
    }

    throw this.toError(
      'EVOLUTION_INSTANCE_CREATE_FAILED',
      response,
      'No pudimos crear la instancia de WhatsApp en Evolution.',
    );
  }

  async setWebhook(instanceId: string, webhookUrl: string | null) {
    if (!webhookUrl) {
      return;
    }

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
      return;
    }

    throw this.toError(
      'EVOLUTION_WEBHOOK_SET_FAILED',
      response,
      'No pudimos registrar el webhook operativo de la conexión.',
    );
  }

  async connectInstance(instanceId: string): Promise<EvolutionConnectPayload> {
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
        'EVOLUTION_CONNECT_FAILED',
        response,
        'No pudimos iniciar la conexión de WhatsApp.',
      );
    }

    const payload = asRecord(response.data);
    return {
      qrCodeData: normalizeQrCodeData(readString(payload?.base64)),
      pairingCode: readString(payload?.code),
      raw: response.data,
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
    const phone =
      readString(instance?.owner) ??
      readString(instance?.number) ??
      readString(instance?.ownerJid) ??
      readString(payload?.number);

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
      return;
    }

    if (response.status === 404) {
      return;
    }

    throw this.toError(
      'EVOLUTION_DISCONNECT_FAILED',
      response,
      'No pudimos desconectar la instancia en Evolution.',
    );
  }

  private async request(
    path: string,
    init: RequestInit,
  ): Promise<EvolutionResponse> {
    if (!this.baseUrl || !this.apiKey) {
      throw new EvolutionApiClientError(
        'Evolution API is not configured.',
        503,
      );
    }

    const response = await fetch(
      `${this.baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`,
      {
        ...init,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          apikey: this.apiKey,
          'x-api-key': this.apiKey,
          Authorization: `Bearer ${this.apiKey}`,
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
    };
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
      response: response.data,
    });
  }
}
