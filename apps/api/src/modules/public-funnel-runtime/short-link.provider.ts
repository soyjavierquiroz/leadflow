import { Injectable, Logger } from '@nestjs/common';
import { getApiRuntimeConfig } from '../../config/runtime';

type ShortLinkResult = {
  resolvedUrl: string;
  shortUrl: string | null;
  shortened: boolean;
  provider: 'yourls' | 'fallback_long_url';
};

@Injectable()
export class ShortLinkProvider {
  private readonly logger = new Logger(ShortLinkProvider.name);
  private readonly runtimeConfig = getApiRuntimeConfig();

  async shortenUrl(longUrl: string): Promise<ShortLinkResult> {
    if (!this.runtimeConfig.yourlsApiUrl || !this.runtimeConfig.yourlsSignature) {
      return {
        resolvedUrl: longUrl,
        shortUrl: null,
        shortened: false,
        provider: 'fallback_long_url',
      };
    }

    try {
      const params = new URLSearchParams({
        signature: this.runtimeConfig.yourlsSignature,
        action: 'shorturl',
        format: 'json',
        url: longUrl,
      });
      const response = await fetch(this.runtimeConfig.yourlsApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(`YOURLS responded with HTTP ${response.status}.`);
      }

      const payload = (await response.json()) as {
        shorturl?: string;
        shortUrl?: string;
        status?: string;
      };
      const shortUrl =
        payload.shorturl?.trim() || payload.shortUrl?.trim() || null;

      if (!shortUrl) {
        throw new Error('YOURLS did not return a short URL.');
      }

      return {
        resolvedUrl: shortUrl,
        shortUrl,
        shortened: true,
        provider: 'yourls',
      };
    } catch (error) {
      this.logger.warn(
        `Falling back to long URL because YOURLS failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );

      return {
        resolvedUrl: longUrl,
        shortUrl: null,
        shortened: false,
        provider: 'fallback_long_url',
      };
    }
  }
}
