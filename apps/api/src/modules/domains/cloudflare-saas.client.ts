import { Injectable } from '@nestjs/common';
import {
  normalizeCloudflareCustomHostnameSnapshot,
  toCloudflareSslMethod,
  type CloudflareCustomHostnameSnapshot,
} from './domain-onboarding.utils';
import type {
  DomainType,
  DomainVerificationMethod,
  JsonValue,
} from '../shared/domain.types';

type CloudflareEnvelope = {
  success: boolean;
  result?: unknown;
  errors?: unknown[];
  messages?: unknown[];
};

type CloudflareResponse = {
  status: number;
  data: unknown;
  url: string;
};

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const sanitizeEnv = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export class CloudflareSaasClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

@Injectable()
export class CloudflareSaasClient {
  private readonly baseDomain = sanitizeEnv(process.env.APP_BASE_DOMAIN);
  private readonly apiBaseUrl =
    sanitizeEnv(process.env.CLOUDFLARE_API_BASE_URL) ??
    'https://api.cloudflare.com/client/v4';
  private readonly apiToken = sanitizeEnv(process.env.CLOUDFLARE_API_TOKEN);
  private readonly zoneId = sanitizeEnv(process.env.CLOUDFLARE_ZONE_ID);
  private readonly fallbackOrigin =
    sanitizeEnv(process.env.CLOUDFLARE_SAAS_FALLBACK_ORIGIN) ??
    (this.baseDomain ? `proxy-fallback.${this.baseDomain}` : null);
  private readonly customerCnameTarget =
    sanitizeEnv(process.env.CLOUDFLARE_SAAS_CUSTOMER_CNAME_TARGET) ??
    (this.baseDomain ? `customers.${this.baseDomain}` : null);
  private readonly timeoutMs = parsePositiveInt(
    process.env.CLOUDFLARE_REQUEST_TIMEOUT_MS,
    10_000,
  );

  isConfigured() {
    return Boolean(this.apiToken && this.zoneId);
  }

  getFallbackOrigin() {
    return this.fallbackOrigin;
  }

  getCustomerCnameTarget() {
    return this.customerCnameTarget;
  }

  async createCustomHostname(input: {
    hostname: string;
    domainType: DomainType;
    verificationMethod: DomainVerificationMethod;
  }): Promise<CloudflareCustomHostnameSnapshot> {
    const response = await this.request('/custom_hostnames', {
      method: 'POST',
      body: JSON.stringify(this.buildPayload(input)),
    });

    return this.toSnapshot(
      response,
      'No pudimos crear el custom hostname en Cloudflare.',
    );
  }

  async getCustomHostname(
    customHostnameId: string,
  ): Promise<CloudflareCustomHostnameSnapshot> {
    const response = await this.request(
      `/custom_hostnames/${customHostnameId}`,
      {
        method: 'GET',
      },
    );

    return this.toSnapshot(
      response,
      'No pudimos consultar el custom hostname en Cloudflare.',
    );
  }

  async refreshCustomHostname(
    customHostnameId: string,
    input: {
      hostname: string;
      domainType: DomainType;
      verificationMethod: DomainVerificationMethod;
    },
  ): Promise<CloudflareCustomHostnameSnapshot> {
    const response = await this.request(
      `/custom_hostnames/${customHostnameId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(this.buildPayload(input)),
      },
    );

    return this.toSnapshot(
      response,
      'No pudimos refrescar el custom hostname en Cloudflare.',
    );
  }

  async updateCustomHostname(
    customHostnameId: string,
    input: {
      hostname: string;
      domainType: DomainType;
      verificationMethod: DomainVerificationMethod;
    },
  ): Promise<CloudflareCustomHostnameSnapshot> {
    const response = await this.request(
      `/custom_hostnames/${customHostnameId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(this.buildPayload(input)),
      },
    );

    return this.toSnapshot(
      response,
      'No pudimos actualizar el custom hostname en Cloudflare.',
    );
  }

  async deleteCustomHostname(customHostnameId: string) {
    const response = await this.request(
      `/custom_hostnames/${customHostnameId}`,
      {
        method: 'DELETE',
      },
    );

    const payload = response.data as CloudflareEnvelope | null;

    if (response.status === 404) {
      throw new CloudflareSaasClientError(
        'Cloudflare custom hostname was not found.',
        404,
        {
          payload: response.data,
          url: response.url,
        },
      );
    }

    if (!payload?.success) {
      const errorMessage =
        Array.isArray(payload?.errors) && payload.errors.length > 0
          ? JSON.stringify(payload.errors)
          : 'No pudimos eliminar el custom hostname en Cloudflare.';

      throw new CloudflareSaasClientError(errorMessage, response.status, {
        payload: response.data,
        url: response.url,
      });
    }
  }

  private buildPayload(input: {
    hostname: string;
    domainType: DomainType;
    verificationMethod: DomainVerificationMethod;
  }) {
    return {
      hostname: input.hostname,
      ...(input.domainType !== 'system_subdomain' && this.fallbackOrigin
        ? {
            custom_origin_server: this.fallbackOrigin,
          }
        : {}),
      ssl: {
        type: 'dv',
        method: toCloudflareSslMethod(input.verificationMethod),
      },
    };
  }

  private async request(
    path: string,
    init: RequestInit,
  ): Promise<CloudflareResponse> {
    if (!this.isConfigured()) {
      throw new CloudflareSaasClientError(
        'Cloudflare SaaS is not configured in this environment.',
        412,
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const url = `${this.apiBaseUrl}/zones/${this.zoneId}${path}`;

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
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
        url,
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new CloudflareSaasClientError(
          'Cloudflare request timed out.',
          408,
          { url },
        );
      }

      if (error instanceof Error) {
        throw new CloudflareSaasClientError(
          `Cloudflare request failed: ${error.message}`,
          502,
          { url },
        );
      }

      throw new CloudflareSaasClientError('Cloudflare request failed.', 502, {
        url,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private toSnapshot(response: CloudflareResponse, fallbackMessage: string) {
    const payload = response.data as CloudflareEnvelope | null;

    if (!payload?.success || !payload.result) {
      const errorMessage =
        Array.isArray(payload?.errors) && payload.errors.length > 0
          ? JSON.stringify(payload.errors)
          : fallbackMessage;

      throw new CloudflareSaasClientError(errorMessage, response.status, {
        payload: response.data,
        url: response.url,
      });
    }

    return (
      normalizeCloudflareCustomHostnameSnapshot(payload.result) ?? {
        id: null,
        hostname: null,
        status: null,
        customOriginServer: this.fallbackOrigin,
        verificationErrors: [],
        ownershipVerification: null,
        ssl: {
          status: null,
          method: null,
          type: null,
          validationErrors: [],
          validationRecords: [],
        },
        error: null,
        raw: (payload.result ?? null) as JsonValue | null,
      }
    );
  }
}
