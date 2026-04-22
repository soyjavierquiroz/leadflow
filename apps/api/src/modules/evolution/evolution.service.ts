import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  joinUrlPath,
  normalizeBaseUrl,
  sanitizeNullableText,
} from '../shared/url.utils';

const DEFAULT_TIMEOUT_MS = 5_000;
const CREATE_INSTANCE_TIMEOUT_MS = 20_000;
const EVOLUTION_WEBHOOK_EVENT = 'MESSAGES_UPSERT' as const;

type EvolutionConnectionStateResponse = {
  instance?: {
    instanceName?: string;
    state?: string;
  };
};

type EvolutionCreateInstanceResponse = {
  instance?: {
    instanceName?: string;
    instanceId?: string;
    status?: string;
  };
  hash?: {
    apikey?: string;
  };
  settings?: Record<string, unknown>;
};

type EvolutionWebhookResponse = {
  webhook?: {
    instanceName?: string;
    webhook?: {
      url?: string;
      events?: string[];
      enabled?: boolean;
    };
  };
};

type EvolutionCreateInstancePayload = {
  instanceName: string;
  integration: 'WHATSAPP-BAILEYS';
  qrcode: true;
};

type EvolutionWebhookSettings = {
  enabled: true;
  url: string;
  webhookByEvents: false;
  events: [typeof EVOLUTION_WEBHOOK_EVENT];
  webhookBase64: true;
  webhook_base64: true;
  webhook_by_base64: true;
};

type EvolutionSetWebhookPayload = {
  webhook: EvolutionWebhookSettings;
};

export type EvolutionQrCodeResponse = {
  pairingCode?: string;
  code?: string;
  base64?: string;
  qrcode?: string;
  qr?: string;
  count?: number;
};

type EvolutionSendTextResponse = {
  key?: {
    remoteJid?: string;
    fromMe?: boolean;
    id?: string;
  };
  message?: Record<string, unknown>;
  messageTimestamp?: string;
  status?: string;
};

type EvolutionRequestInput = {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  data?: unknown;
  timeoutMs?: number;
  expectedStatusCodes: Set<number>;
};

/**
 * Parses an environment-backed integer and falls back when the input is absent
 * or invalid.
 */
const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

/**
 * Extracts the phone number portion from a WhatsApp JID.
 */
const normalizeRecipientNumber = (remoteJid: string): string => {
  const withoutDomain = remoteJid.split('@')[0]?.trim() ?? '';
  const digitsOnly = withoutDomain.replace(/[^\d]/g, '');

  if (digitsOnly.length > 0) {
    return digitsOnly;
  }

  return withoutDomain;
};

@Injectable()
export class EvolutionService {
  private readonly apiUrl: string | null;
  private readonly globalKey: string | null;
  private readonly webhookBaseUrl: string | null;
  private readonly webhookId: string | null;
  private readonly timeoutMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiUrl = normalizeBaseUrl(
      this.configService.get<string>('EVOLUTION_API_URL'),
    );
    this.globalKey = sanitizeNullableText(
      this.configService.get<string>('EVOLUTION_GLOBAL_KEY'),
    );
    this.webhookBaseUrl = normalizeBaseUrl(
      this.configService.get<string>('N8N_WEBHOOK_BASE_URL'),
    );
    this.webhookId = sanitizeNullableText(
      this.configService.get<string>('N8N_EVOLUTION_WEBHOOK_ID'),
    );
    this.timeoutMs = parsePositiveInt(
      this.configService.get<string>('EVOLUTION_REQUEST_TIMEOUT_MS'),
      DEFAULT_TIMEOUT_MS,
    );
  }

  /**
   * Reads the current connection state for an Evolution instance.
   * Returns `null` when the instance does not exist upstream.
   */
  async getConnectionState(
    instanceName: string,
  ): Promise<EvolutionConnectionStateResponse | null> {
    const normalizedInstanceName = this.requireText(instanceName, 'instanceName');
    const response = await this.request<EvolutionConnectionStateResponse>({
      method: 'GET',
      path: `/instance/connectionState/${encodeURIComponent(normalizedInstanceName)}`,
      expectedStatusCodes: new Set([200, 404]),
    });

    if (response.status === 404) {
      return null;
    }

    return response.data;
  }

  /**
   * Creates an Evolution instance using the exact payload accepted by the
   * current cluster version. If Evolution times out while bootstrapping Baileys,
   * the method verifies whether the instance was actually created before failing.
   */
  async createInstance(
    instanceName: string,
  ): Promise<EvolutionCreateInstanceResponse> {
    const normalizedInstanceName = this.requireText(instanceName, 'instanceName');
    const payload: EvolutionCreateInstancePayload = {
      instanceName: normalizedInstanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
    };

    try {
      const response = await this.request<EvolutionCreateInstanceResponse>({
        method: 'POST',
        path: '/instance/create',
        data: payload,
        timeoutMs: CREATE_INSTANCE_TIMEOUT_MS,
        expectedStatusCodes: new Set([200, 201, 409]),
      });

      return response.data;
    } catch (error) {
      if (!this.isTimeoutException(error)) {
        throw error;
      }

      const connectionState =
        await this.getConnectionState(normalizedInstanceName);

      if (connectionState) {
        return {
          instance: {
            instanceName: normalizedInstanceName,
            status: connectionState.instance?.state,
          },
        };
      }

      throw error;
    }
  }

  /**
   * Configures the inbound webhook contract required by n8n for a specific
   * Evolution instance.
   */
  async setWebhook(instanceName: string): Promise<EvolutionWebhookResponse> {
    const normalizedInstanceName = this.requireText(instanceName, 'instanceName');
    const response = await this.request<EvolutionWebhookResponse>({
      method: 'POST',
      path: `/webhook/set/${encodeURIComponent(normalizedInstanceName)}`,
      data: this.buildWebhookConfig(normalizedInstanceName),
      expectedStatusCodes: new Set([200, 201]),
    });

    return response.data;
  }

  /**
   * Requests the QR payload required to bind the instance with WhatsApp.
   */
  async getQrCode(instanceName: string): Promise<EvolutionQrCodeResponse> {
    const normalizedInstanceName = this.requireText(instanceName, 'instanceName');
    const response = await this.request<EvolutionQrCodeResponse>({
      method: 'GET',
      path: `/instance/connect/${encodeURIComponent(normalizedInstanceName)}`,
      expectedStatusCodes: new Set([200]),
    });

    return response.data;
  }

  /**
   * Sends the first advisor-originated handoff message after assignment.
   * Evolution expects the phone number without the WhatsApp domain suffix.
   */
  async sendHandoffMessage(
    instanceName: string,
    remoteJid: string,
    text: string,
  ): Promise<EvolutionSendTextResponse> {
    const normalizedInstanceName = this.requireText(instanceName, 'instanceName');
    const normalizedRemoteJid = this.requireText(remoteJid, 'remoteJid');
    const normalizedText = this.requireText(text, 'text');
    const number = normalizeRecipientNumber(normalizedRemoteJid);

    if (!number) {
      throw new InternalServerErrorException({
        code: 'EVOLUTION_REMOTE_JID_INVALID',
        message: 'The remoteJid could not be normalized into a WhatsApp number.',
      });
    }

    const response = await this.request<EvolutionSendTextResponse>({
      method: 'POST',
      path: `/message/sendText/${encodeURIComponent(normalizedInstanceName)}`,
      data: {
        number,
        text: normalizedText,
      },
      expectedStatusCodes: new Set([200, 201]),
    });

    return response.data;
  }

  /**
   * Closes the current WhatsApp session without treating a missing instance as
   * a blocking error.
   */
  async logoutInstance(instanceName: string): Promise<{ success: true }> {
    const normalizedInstanceName = this.requireText(instanceName, 'instanceName');
    const response = await this.request<unknown>({
      method: 'DELETE',
      path: `/instance/logout/${encodeURIComponent(normalizedInstanceName)}`,
      expectedStatusCodes: new Set([200, 201, 204, 404]),
    });

    if (response.status === 404) {
      return {
        success: true,
      };
    }

    return {
      success: true,
    };
  }

  /**
   * Executes a typed HTTP request against Evolution with shared authentication
   * headers and centralized error mapping.
   */
  private async request<T>(
    input: EvolutionRequestInput,
  ): Promise<AxiosResponse<T>> {
    this.ensureConfigured();

    const url = joinUrlPath(this.apiUrl!, input.path);
    const requestConfig: AxiosRequestConfig = {
      url,
      method: input.method,
      headers: this.buildHeaders(),
      timeout: input.timeoutMs ?? this.timeoutMs,
      data: input.data,
      validateStatus: () => true,
    };

    try {
      const response = await firstValueFrom(
        this.httpService.request<T>(requestConfig),
      );

      if (input.expectedStatusCodes.has(response.status)) {
        return response;
      }

      throw this.toUpstreamException(response.status, response.data, url);
    } catch (error) {
      throw this.toTransportException(error, url);
    }
  }

  /**
   * Ensures the minimum Evolution configuration is available before any call.
   */
  private ensureConfigured(): void {
    if (this.apiUrl && this.globalKey) {
      return;
    }

    throw new ServiceUnavailableException({
      code: 'EVOLUTION_NOT_CONFIGURED',
      message:
        'Evolution API is not configured. Set EVOLUTION_API_URL and EVOLUTION_GLOBAL_KEY before using this module.',
    });
  }

  /**
   * Builds the authentication header set known to work against Evolution v2.3.7
   * in this cluster.
   */
  private buildHeaders(): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      apikey: this.globalKey!,
      'x-api-key': this.globalKey!,
      Authorization: `Bearer ${this.globalKey!}`,
    };
  }

  /**
   * Produces the per-instance inbound webhook URL expected by n8n.
   */
  private buildWebhookUrl(instanceName: string): string {
    const webhookBaseUrl = this.webhookBaseUrl;
    const webhookId = this.webhookId;

    if (!webhookBaseUrl || !webhookId) {
      throw new ServiceUnavailableException({
        code: 'EVOLUTION_WEBHOOK_NOT_CONFIGURED',
        message:
          'The Evolution webhook target is not configured. Set N8N_WEBHOOK_BASE_URL and N8N_EVOLUTION_WEBHOOK_ID.',
      });
    }

    const normalizedBaseUrl = webhookBaseUrl.replace(/\/+$/, '');
    const webhookRoot = normalizedBaseUrl.endsWith('/webhook')
      ? normalizedBaseUrl
      : joinUrlPath(normalizedBaseUrl, 'webhook');

    return joinUrlPath(
      webhookRoot,
      `${webhookId}/channels/evolution/${encodeURIComponent(
        instanceName,
      )}/inbound`,
    );
  }

  /**
   * Builds the exact webhook payload accepted by the running Evolution cluster.
   */
  private buildWebhookConfig(instanceName: string): EvolutionSetWebhookPayload {
    return {
      webhook: {
        enabled: true,
        url: this.buildWebhookUrl(instanceName),
        webhookByEvents: false,
        events: [EVOLUTION_WEBHOOK_EVENT],
        webhookBase64: true,
        webhook_base64: true,
        webhook_by_base64: true,
      },
    };
  }

  /**
   * Normalizes a text input and raises a stable application error when empty.
   */
  private requireText(value: string | null | undefined, field: string): string {
    const normalized = sanitizeNullableText(value);

    if (normalized) {
      return normalized;
    }

    throw new InternalServerErrorException({
      code: 'EVOLUTION_FIELD_REQUIRED',
      message: `${field} is required.`,
    });
  }

  /**
   * Converts transport failures and thrown HTTP exceptions into the public
   * exception contract used by the module.
   */
  private toTransportException(error: unknown, url: string) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'getStatus' in error &&
      typeof error.getStatus === 'function'
    ) {
      return error;
    }

    const axiosError = error as AxiosError;

    if (axiosError.code === 'ECONNABORTED') {
      return new GatewayTimeoutException({
        code: 'EVOLUTION_TIMEOUT',
        message: `Evolution API timed out while requesting ${url}.`,
      });
    }

    if (axiosError.response) {
      return this.toUpstreamException(
        axiosError.response.status,
        axiosError.response.data,
        url,
      );
    }

    return new BadGatewayException({
      code: 'EVOLUTION_UNREACHABLE',
      message: `Evolution API request failed for ${url}.`,
      details:
        axiosError instanceof Error ? axiosError.message : 'Unknown upstream error.',
    });
  }

  /**
   * Detects timeout failures from either axios or previously mapped NestJS
   * exceptions.
   */
  private isTimeoutException(error: unknown): boolean {
    if (
      typeof error === 'object' &&
      error !== null &&
      'getStatus' in error &&
      typeof error.getStatus === 'function'
    ) {
      return error.getStatus() === 504;
    }

    const axiosError = error as AxiosError;
    return axiosError.code === 'ECONNABORTED';
  }

  /**
   * Maps unexpected upstream HTTP responses into application exceptions with
   * operator-friendly context.
   */
  private toUpstreamException(status: number, data: unknown, url: string) {
    const message = this.readUpstreamMessage(data);

    if (status === 404) {
      return new NotFoundException({
        code: 'EVOLUTION_INSTANCE_NOT_FOUND',
        message:
          message ?? `Evolution API could not find the requested resource at ${url}.`,
      });
    }

    if (status === 401 || status === 403) {
      return new ServiceUnavailableException({
        code: 'EVOLUTION_AUTH_FAILED',
        message:
          message ??
          'Evolution API rejected the configured credentials. Check EVOLUTION_GLOBAL_KEY.',
      });
    }

    return new BadGatewayException({
      code: 'EVOLUTION_UPSTREAM_ERROR',
      message:
        message ?? `Evolution API responded with HTTP ${status} for ${url}.`,
      upstreamStatus: status,
      details: data,
    });
  }

  /**
   * Extracts the most actionable message available from a heterogeneous
   * Evolution error payload.
   */
  private readUpstreamMessage(data: unknown): string | null {
    if (typeof data === 'string' && data.trim().length > 0) {
      return data.trim();
    }

    if (typeof data !== 'object' || data === null) {
      return null;
    }

    const record = data as Record<string, unknown>;
    const candidates = [
      record.message,
      record.error,
      (record.response as Record<string, unknown> | undefined)?.message,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return null;
  }
}
