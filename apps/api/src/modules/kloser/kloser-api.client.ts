import * as crypto from 'crypto';
import { Injectable, Logger } from '@nestjs/common';

const DEFAULT_KLOSER_API_URL = 'http://kloser.kuruk.in/api/v1';
const DEFAULT_KLOSER_TIMEOUT_MS = 2_500;

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const readTimeoutMs = () => {
  const parsed = Number.parseInt(
    process.env.KLOSER_REQUEST_TIMEOUT_MS ?? '',
    10,
  );

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_KLOSER_TIMEOUT_MS;
};

const readPayloadField = (payload: unknown, field: string): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const value = (payload as Record<string, unknown>)[field];

  return typeof value === 'string' ? value : null;
};

@Injectable()
export class KloserApiClient {
  private readonly logger = new Logger(KloserApiClient.name);
  private readonly baseUrl: string;
  private readonly secret: string;
  private readonly timeoutMs: number;

  constructor() {
    this.baseUrl = normalizeBaseUrl(
      process.env.KLOSER_API_URL || DEFAULT_KLOSER_API_URL,
    );
    this.secret = process.env.KLOSER_HMAC_SECRET || '';
    this.timeoutMs = readTimeoutMs();

    if (!this.secret) {
      this.logger.warn(
        '[KloserApiClient] KLOSER_HMAC_SECRET is not defined in the environment.',
      );
    }
  }

  /**
   * Generates signed security headers for anti-replay protection.
   * Signature contract: HMAC_SHA256(Timestamp.Nonce.RawBody, Secret).
   */
  private generateHeaders(payload: any): Record<string, string> {
    return this.generateHeadersForRawBody(JSON.stringify(payload));
  }

  private generateHeadersForRawBody(rawBody: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomUUID();

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(`${timestamp}.${nonce}.${rawBody}`)
      .digest('hex');

    return {
      'Content-Type': 'application/json',
      'X-Kloser-Timestamp': timestamp,
      'X-Kloser-Nonce': nonce,
      'X-Kloser-Signature': signature,
    };
  }

  private prepareSignedJsonRequest(payload: any) {
    const body = JSON.stringify(payload);

    return {
      body,
      headers: this.generateHeadersForRawBody(body),
    };
  }

  /**
   * Mission injector: enqueues a follow-up in Kloser.
   */
  async createMission(payload: any): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const { body, headers } = this.prepareSignedJsonRequest(payload);

      const response = await fetch(`${this.baseUrl}/missions`, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `[Kloser] Mission create failed with HTTP ${response.status}: ${errorText}`,
        );
        return false;
      }

      this.logger.log(
        `[Kloser] Mission initialized for Lead ID: ${
          readPayloadField(payload, 'lead_id') ?? 'unknown'
        }`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        '[Kloser] Network error connecting to Kloser API. Leadflow continues operating.',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Inbound interceptor hard kill: cancels active missions without blocking.
   */
  async cancelMission(
    tenantId: string,
    remoteJid: string,
    strategyId: string,
    reason: string,
  ): Promise<void> {
    const payload = {
      tenant_id: tenantId,
      remote_jid: remoteJid,
      strategy_id: strategyId,
      reason,
    };

    try {
      const { body, headers } = this.prepareSignedJsonRequest(payload);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      void fetch(`${this.baseUrl}/missions/cancel`, {
        method: 'POST',
        signal: controller.signal,
        headers,
        body,
      })
        .catch((error: unknown) => {
          this.logger.error(
            '[Kloser] Async failure sending hard kill.',
            error instanceof Error ? error.stack : String(error),
          );
        })
        .finally(() => clearTimeout(timeoutId));

      this.logger.log(
        `[Kloser] Hard kill order fired for ${remoteJid} (${reason}).`,
      );
    } catch (error) {
      this.logger.error(
        '[Kloser] Internal error preparing hard kill.',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
