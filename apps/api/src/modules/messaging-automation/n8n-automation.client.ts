import { Injectable } from '@nestjs/common';

type AutomationResponse = {
  status: number;
  data: unknown;
  url: string;
};

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const delay = async (ms: number) =>
  await new Promise((resolve) => setTimeout(resolve, ms));

export class N8nAutomationClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

@Injectable()
export class N8nAutomationClient {
  private readonly defaultWebhookBaseUrl =
    process.env.MESSAGING_AUTOMATION_WEBHOOK_BASE_URL?.trim() || null;
  private readonly webhookToken =
    process.env.MESSAGING_AUTOMATION_WEBHOOK_TOKEN?.trim() || null;
  private readonly timeoutMs = parsePositiveInt(
    process.env.MESSAGING_AUTOMATION_DISPATCH_TIMEOUT_MS,
    4_000,
  );
  private readonly retries = parsePositiveInt(
    process.env.MESSAGING_AUTOMATION_DISPATCH_RETRIES,
    1,
  );

  hasDefaultWebhookBaseUrl() {
    return Boolean(this.defaultWebhookBaseUrl);
  }

  getDefaultWebhookBaseUrl() {
    return this.defaultWebhookBaseUrl;
  }

  async dispatch(url: string, payload: unknown): Promise<AutomationResponse> {
    let lastError: N8nAutomationClientError | null = null;

    for (let attempt = 1; attempt <= this.retries + 1; attempt += 1) {
      try {
        const response = await this.dispatchOnce(url, payload);

        if (
          RETRYABLE_STATUS_CODES.has(response.status) &&
          attempt <= this.retries
        ) {
          await delay(250 * attempt);
          continue;
        }

        return response;
      } catch (error) {
        const clientError = this.toClientError(error, url);
        lastError = clientError;

        if (
          (clientError.status === 408 || clientError.status === 504) &&
          attempt <= this.retries
        ) {
          await delay(250 * attempt);
          continue;
        }

        break;
      }
    }

    if (lastError) {
      throw lastError;
    }

    throw new N8nAutomationClientError(
      'The automation dispatch failed unexpectedly.',
      502,
      { url },
    );
  }

  private async dispatchOnce(
    url: string,
    payload: unknown,
  ): Promise<AutomationResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(this.webhookToken
            ? {
                Authorization: `Bearer ${this.webhookToken}`,
                'x-leadflow-automation-token': this.webhookToken,
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
        url,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private toClientError(error: unknown, url: string) {
    if (error instanceof N8nAutomationClientError) {
      return error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      return new N8nAutomationClientError(
        'The automation dispatch timed out.',
        408,
        { url },
      );
    }

    if (error instanceof Error) {
      return new N8nAutomationClientError(
        `The automation dispatch failed: ${error.message}`,
        504,
        { url },
      );
    }

    return new N8nAutomationClientError(
      'The automation dispatch failed.',
      504,
      { url },
    );
  }
}
