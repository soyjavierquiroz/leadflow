import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  MessagingRuntimeContextStatus,
  type MessagingConnection,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  joinUrlPath,
  normalizeBaseUrl,
  normalizeUrlPath,
  sanitizeNullableText,
} from '../shared/url.utils';

type RuntimeContextRegistrationInput = {
  instanceName: string;
  tenantId: string;
};

type RuntimeContextRegistrationPayload = {
  provider: 'evolution';
  channel: 'whatsapp';
  instance_name: string;
  tenant_id: string;
  service_owner_key: 'lead-handler';
  status: 'active';
};

type RuntimeContextResponse = {
  status: number;
  data: unknown;
};

type RuntimeContextMode = 'required' | 'optional';

const DEFAULT_REGISTER_PATH = '/register';
const FALLBACK_REGISTER_PATH = '/v1/context/register';
const DEFAULT_RESOLVE_FULL_PATH = '/resolve-full';
const FALLBACK_RESOLVE_FULL_PATH = '/v1/context/resolve-full';
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RESOLVE_RETRIES = 5;
const DEFAULT_RESOLVE_DELAY_MS = 1_000;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

const normalizePath = (value: string | null | undefined, fallback: string) => {
  return normalizeUrlPath(value) ?? normalizeUrlPath(fallback) ?? '';
};

const normalizePathCandidates = (
  primaryValue: string | null | undefined,
  fallback: string,
  extraCandidates: string[],
) => {
  const candidates = [
    normalizePath(primaryValue, fallback),
    ...extraCandidates.map((candidate) => normalizePath(candidate, candidate)),
  ];

  return [...new Set(candidates)];
};

const normalizeMode = (
  value: string | null | undefined,
): RuntimeContextMode => {
  const sanitized = sanitizeNullableText(value)?.toLowerCase();

  if (sanitized === 'optional') {
    return 'optional';
  }

  return 'required';
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

@Injectable()
export class RuntimeContextCentralService {
  private readonly baseUrl = normalizeBaseUrl(
    process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL,
  );
  private readonly registerPaths = normalizePathCandidates(
    process.env.RUNTIME_CONTEXT_REGISTER_PATH,
    DEFAULT_REGISTER_PATH,
    [FALLBACK_REGISTER_PATH],
  );
  private readonly resolveFullPaths = normalizePathCandidates(
    process.env.RUNTIME_CONTEXT_RESOLVE_FULL_PATH,
    DEFAULT_RESOLVE_FULL_PATH,
    [FALLBACK_RESOLVE_FULL_PATH],
  );
  private readonly mode = normalizeMode(process.env.RUNTIME_CONTEXT_MODE);
  private readonly apiKey = sanitizeNullableText(
    process.env.RUNTIME_CONTEXT_CENTRAL_API_KEY,
  );
  private readonly timeoutMs = parsePositiveInt(
    process.env.RUNTIME_CONTEXT_REQUEST_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );
  private readonly resolveRetries = parsePositiveInt(
    process.env.RUNTIME_CONTEXT_RESOLVE_RETRIES,
    DEFAULT_RESOLVE_RETRIES,
  );
  private readonly resolveDelayMs = parsePositiveInt(
    process.env.RUNTIME_CONTEXT_RESOLVE_DELAY_MS,
    DEFAULT_RESOLVE_DELAY_MS,
  );

  constructor(private readonly prisma: PrismaService) {}

  isConfigured() {
    return Boolean(this.baseUrl);
  }

  async markConnectionProvisioned(input: {
    connectionId: string;
    tenantId: string;
  }) {
    await this.prisma.messagingConnection.update({
      where: {
        id: input.connectionId,
      },
      data: {
        runtimeContextStatus: MessagingRuntimeContextStatus.PROVISIONED,
        runtimeContextTenantId: input.tenantId,
        runtimeContextRegisteredAt: null,
        runtimeContextReadyAt: null,
        runtimeContextLastCheckedAt: null,
        runtimeContextLastErrorAt: null,
        runtimeContextLastErrorMessage: null,
      },
    });
  }

  async ensureConnectionReady(
    connection: Pick<
      MessagingConnection,
      | 'id'
      | 'workspaceId'
      | 'externalInstanceId'
      | 'runtimeContextStatus'
      | 'runtimeContextTenantId'
    >,
  ) {
    if (!connection.externalInstanceId) {
      return {
        ready: false,
      } as const;
    }

    if (
      connection.runtimeContextStatus === MessagingRuntimeContextStatus.READY
    ) {
      return {
        ready: true,
      } as const;
    }

    const tenantId = connection.runtimeContextTenantId ?? connection.workspaceId;
    let currentStatus = connection.runtimeContextStatus;
    const registrationInput = {
      instanceName: connection.externalInstanceId,
      tenantId,
    } satisfies RuntimeContextRegistrationInput;

    if (!this.baseUrl) {
      if (this.mode === 'optional') {
        await this.markConnectionReadyLocally({
          connectionId: connection.id,
          tenantId,
        });

        return {
          ready: true,
          resolution: {
            mode: 'local',
            reason:
              'Runtime Context Central is not configured. Local persistence fallback was used.',
          },
        } as const;
      }

      this.ensureConfigured();
    }

    if (
      connection.runtimeContextStatus !==
        MessagingRuntimeContextStatus.PROVISIONED &&
      connection.runtimeContextStatus !== MessagingRuntimeContextStatus.REGISTERED
    ) {
      await this.markConnectionProvisioned({
        connectionId: connection.id,
        tenantId,
      });
      currentStatus = MessagingRuntimeContextStatus.PROVISIONED;
    }

    try {
      await this.registerInstanceInRuntimeContext(registrationInput);
      await this.prisma.messagingConnection.update({
        where: {
          id: connection.id,
        },
        data: {
          runtimeContextStatus: MessagingRuntimeContextStatus.REGISTERED,
          runtimeContextTenantId: tenantId,
          runtimeContextRegisteredAt: new Date(),
          runtimeContextLastCheckedAt: null,
          runtimeContextLastErrorAt: null,
          runtimeContextLastErrorMessage: null,
        },
      });
      currentStatus = MessagingRuntimeContextStatus.REGISTERED;

      const resolution = await this.waitUntilResolvable(registrationInput);
      const resolvedAt = new Date();

      await this.prisma.messagingConnection.update({
        where: {
          id: connection.id,
        },
        data: {
          runtimeContextStatus: MessagingRuntimeContextStatus.READY,
          runtimeContextTenantId: tenantId,
          runtimeContextReadyAt: resolvedAt,
          runtimeContextLastCheckedAt: resolvedAt,
          runtimeContextLastErrorAt: null,
          runtimeContextLastErrorMessage: null,
        },
      });

      return {
        ready: true,
        resolution,
      } as const;
    } catch (error) {
      if (this.shouldUseLocalFallback(error)) {
        await this.markConnectionReadyLocally({
          connectionId: connection.id,
          tenantId,
        });

        return {
          ready: true,
          resolution: {
            mode: 'local',
            reason:
              error instanceof Error
                ? error.message
                : 'Runtime context onboarding failed and local persistence fallback was used.',
          },
        } as const;
      }

      const lastErrorMessage =
        error instanceof Error
          ? error.message
          : 'Runtime context onboarding failed unexpectedly.';

      await this.prisma.messagingConnection.update({
        where: {
          id: connection.id,
        },
        data: {
          runtimeContextStatus:
            currentStatus === MessagingRuntimeContextStatus.REGISTERED
              ? MessagingRuntimeContextStatus.REGISTERED
              : MessagingRuntimeContextStatus.PROVISIONED,
          runtimeContextTenantId: tenantId,
          runtimeContextLastCheckedAt: new Date(),
          runtimeContextLastErrorAt: new Date(),
          runtimeContextLastErrorMessage: lastErrorMessage,
          lastErrorAt: new Date(),
          lastErrorMessage,
        },
      });

      throw error;
    }
  }

  async registerInstanceInRuntimeContext(
    input: RuntimeContextRegistrationInput,
  ) {
    this.ensureConfigured();

    const payload = this.buildPayload(input);
    const response = await this.requestWithFallback(this.registerPaths, payload);

    if (
      (response.status >= 200 && response.status < 300) ||
      response.status === 409
    ) {
      return response;
    }

    throw new Error(
      `Runtime context register failed with HTTP ${response.status}`,
    );
  }

  async waitUntilResolvable(input: RuntimeContextRegistrationInput) {
    this.ensureConfigured();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.resolveRetries; attempt += 1) {
      if (attempt > 0) {
        await delay(this.resolveDelayMs);
      }

      try {
        const response = await this.requestWithFallback(
          this.resolveFullPaths,
          this.buildPayload(input),
        );

        if (response.status === 200) {
          return response.data;
        }

        if (response.status === 404) {
          lastError = new Error(
            `Runtime context resolve-full still missing instance ${input.instanceName}.`,
          );
          continue;
        }

        if (RETRYABLE_STATUS_CODES.has(response.status)) {
          lastError = new Error(
            `Runtime context resolve-full retryable response: HTTP ${response.status}`,
          );
          continue;
        }

        throw new Error(
          `Runtime context resolve-full failed with HTTP ${response.status}`,
        );
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error(
                'Runtime context resolve-full failed unexpectedly.',
              );

        if (attempt >= this.resolveRetries - 1) {
          break;
        }
      }
    }

    throw (
      lastError ??
      new Error('Runtime context resolve-full failed without an error.')
    );
  }

  private buildPayload(
    input: RuntimeContextRegistrationInput,
  ): RuntimeContextRegistrationPayload {
    return {
      provider: 'evolution',
      channel: 'whatsapp',
      instance_name: input.instanceName,
      tenant_id: input.tenantId,
      service_owner_key: 'lead-handler',
      status: 'active',
    };
  }

  private async requestWithFallback(
    paths: string[],
    payload: RuntimeContextRegistrationPayload,
  ) {
    let lastResponse: RuntimeContextResponse | null = null;

    for (const path of paths) {
      const response = await this.request(path, payload);
      lastResponse = response;

      if (response.status !== 404) {
        return response;
      }
    }

    return (
      lastResponse ?? {
        status: 404,
        data: null,
      }
    );
  }

  private async markConnectionReadyLocally(input: {
    connectionId: string;
    tenantId: string;
  }) {
    const now = new Date();

    await this.prisma.messagingConnection.update({
      where: {
        id: input.connectionId,
      },
      data: {
        runtimeContextStatus: MessagingRuntimeContextStatus.READY,
        runtimeContextTenantId: input.tenantId,
        runtimeContextRegisteredAt: now,
        runtimeContextReadyAt: now,
        runtimeContextLastCheckedAt: now,
        runtimeContextLastErrorAt: null,
        runtimeContextLastErrorMessage: null,
      },
    });
  }

  private shouldUseLocalFallback(error: unknown) {
    return this.mode === 'optional' && error instanceof Error;
  }

  private async request(
    path: string,
    payload: RuntimeContextRegistrationPayload,
  ): Promise<RuntimeContextResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);
    const requestUrl = joinUrlPath(this.baseUrl!, path);

    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(this.apiKey
            ? {
                'x-runtime-context-api-key': this.apiKey,
              }
            : {}),
        },
        body: JSON.stringify(payload),
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
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private ensureConfigured() {
    if (this.baseUrl) {
      return;
    }

    throw new ServiceUnavailableException({
      code: 'RUNTIME_CONTEXT_NOT_CONFIGURED',
      message:
        'Runtime Context Central is required before dispatching leads to the downstream handler.',
    });
  }
}
