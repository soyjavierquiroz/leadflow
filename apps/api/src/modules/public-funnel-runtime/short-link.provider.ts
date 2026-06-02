import { Injectable, Logger } from '@nestjs/common';
import { getApiRuntimeConfig } from '../../config/runtime';

type ShortLinkResult = {
  resolvedUrl: string;
  shortUrl: string | null;
  shortened: boolean;
  provider: 'yourls' | 'fallback_long_url';
};

type YourlsPayload = {
  shorturl?: string;
  shortUrl?: string;
  url?: {
    keyword?: string;
    shorturl?: string;
  };
  status?: string;
  statusCode?: number;
  message?: string;
  code?: string;
  errorCode?: string;
};

export class ShortLinkProviderUnavailableError extends Error {
  constructor(message = 'YOURLS is not configured.') {
    super(message);
    this.name = 'ShortLinkProviderUnavailableError';
  }
}

export class ShortLinkKeywordConflictError extends Error {
  constructor(message = 'YOURLS keyword is already in use.') {
    super(message);
    this.name = 'ShortLinkKeywordConflictError';
  }
}

export class ShortLinkProviderRequestError extends Error {
  readonly statusCode: number | null;

  constructor(message: string, statusCode?: number | null) {
    super(message);
    this.name = 'ShortLinkProviderRequestError';
    this.statusCode = statusCode ?? null;
  }
}

export type CustomShortLinkResult = {
  resolvedUrl: string;
  shortUrl: string;
  shortCode: string;
  provider: 'yourls';
  providerMetadata: {
    status?: string;
    statusCode?: number;
    keyword: string;
  };
};

export type ShortLinkDeleteResult = {
  ok: boolean;
  notFound: boolean;
};

@Injectable()
export class ShortLinkProvider {
  private readonly logger = new Logger(ShortLinkProvider.name);
  private readonly runtimeConfig = getApiRuntimeConfig();

  extractShortCode(shortUrl?: string | null): string | null {
    const trimmed = shortUrl?.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const url = new URL(trimmed);
      return this.extractReasonableLastSegment(url.pathname);
    } catch {
      const withoutQuery = trimmed.split('?')[0]?.split('#')[0] ?? '';
      return this.extractReasonableLastSegment(withoutQuery);
    }
  }

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

  async shortenUrlWithKeyword(
    longUrl: string,
    keyword: string,
  ): Promise<CustomShortLinkResult> {
    if (!this.runtimeConfig.yourlsApiUrl || !this.runtimeConfig.yourlsSignature) {
      throw new ShortLinkProviderUnavailableError();
    }

    const params = new URLSearchParams({
      signature: this.runtimeConfig.yourlsSignature,
      action: 'shorturl',
      format: 'json',
      url: longUrl,
      keyword,
    });

    const payload = await this.requestYourls(params);
    this.assertSuccessfulKeywordPayload(payload);

    const shortUrl =
      payload.shorturl?.trim() ||
      payload.shortUrl?.trim() ||
      payload.url?.shorturl?.trim() ||
      null;

    if (!shortUrl) {
      throw new ShortLinkProviderRequestError(
        'YOURLS did not return a short URL.',
      );
    }

    return {
      resolvedUrl: shortUrl,
      shortUrl,
      shortCode: payload.url?.keyword?.trim() || keyword,
      provider: 'yourls',
      providerMetadata: {
        status: payload.status,
        statusCode: payload.statusCode,
        keyword,
      },
    };
  }

  async deleteShortUrl(keyword: string): Promise<ShortLinkDeleteResult> {
    if (!this.runtimeConfig.yourlsApiUrl || !this.runtimeConfig.yourlsSignature) {
      throw new ShortLinkProviderUnavailableError();
    }

    let payload = await this.requestYourls(
      this.buildDeleteShortUrlParams(keyword, 'delete'),
    );

    if (this.isInvalidActionPayload(payload)) {
      payload = await this.requestYourls(
        this.buildDeleteShortUrlParams(keyword, 'deleteurl'),
      );
    }

    if (payload.status === 'fail' && this.isNotFoundPayload(payload)) {
      return {
        ok: false,
        notFound: true,
      };
    }

    if (payload.status === 'fail') {
      throw new ShortLinkProviderRequestError(
        payload.message ?? 'YOURLS could not delete the short URL.',
        payload.statusCode,
      );
    }

    return {
      ok: true,
      notFound: false,
    };
  }

  private extractReasonableLastSegment(value: string) {
    const segment =
      value
        .replace(/\/+$/, '')
        .split('/')
        .map((item) => item.trim())
        .filter(Boolean)
        .pop() ?? null;

    if (!segment || !/^[A-Za-z0-9._~-]+$/.test(segment)) {
      return null;
    }

    return segment;
  }

  private buildDeleteShortUrlParams(
    keyword: string,
    action: 'delete' | 'deleteurl',
  ) {
    return new URLSearchParams({
      signature: this.runtimeConfig.yourlsSignature!,
      action,
      format: 'json',
      shorturl: keyword,
    });
  }

  private async requestYourls(params: URLSearchParams): Promise<YourlsPayload> {
    let response: Response;

    try {
      response = await fetch(this.runtimeConfig.yourlsApiUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });
    } catch (error) {
      throw new ShortLinkProviderRequestError(
        `YOURLS request failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    if (!response.ok) {
      throw new ShortLinkProviderRequestError(
        `YOURLS responded with HTTP ${response.status}.`,
        response.status,
      );
    }

    return (await response.json()) as YourlsPayload;
  }

  private assertSuccessfulKeywordPayload(payload: YourlsPayload) {
    if (payload.status !== 'fail') {
      return;
    }

    const message = payload.message?.toLowerCase() ?? '';
    const code = `${payload.code ?? payload.errorCode ?? ''}`.toLowerCase();

    if (
      payload.statusCode === 400 ||
      payload.statusCode === 409 ||
      code.includes('error:keyword') ||
      code.includes('keyword') ||
      message.includes('keyword') ||
      message.includes('already') ||
      message.includes('exists')
    ) {
      throw new ShortLinkKeywordConflictError(
        payload.message ?? 'YOURLS keyword is already in use.',
      );
    }

    throw new ShortLinkProviderRequestError(
      payload.message ?? 'YOURLS could not create the short URL.',
      payload.statusCode,
    );
  }

  private isNotFoundPayload(payload: YourlsPayload) {
    const message = payload.message?.toLowerCase() ?? '';
    const code = `${payload.code ?? payload.errorCode ?? ''}`.toLowerCase();

    return (
      payload.statusCode === 404 ||
      message.includes('not found') ||
      message.includes('does not exist') ||
      message.includes('not exist') ||
      code.includes('not found') ||
      code.includes('does not exist') ||
      code.includes('not exist')
    );
  }

  private isInvalidActionPayload(payload: YourlsPayload) {
    if (payload.status !== 'fail') {
      return false;
    }

    const message = payload.message?.toLowerCase() ?? '';
    const code = `${payload.code ?? payload.errorCode ?? ''}`.toLowerCase();

    return (
      message.includes('invalid action') ||
      message.includes('unknown action') ||
      code.includes('invalid action') ||
      code.includes('unknown action')
    );
  }
}
