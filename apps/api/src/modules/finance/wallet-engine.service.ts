import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AxiosError, AxiosRequestConfig } from 'axios';
import { createHash } from 'node:crypto';
import { firstValueFrom } from 'rxjs';

type WalletEngineAccount = {
  id: string;
  platform_key: string;
  product_key: string;
  tenant_id: string;
  external_ref: string;
  unit_code: string;
  unit_scale: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export type WalletEngineBalance = {
  account_id: string;
  unit_code: string;
  unit_scale: number;
  balance: string;
  held_amount: string;
  available_balance: string;
  updated_at: string;
};

export type WalletEngineDebitResult = {
  ledger_entry: {
    id: string;
    account_id: string;
    movement_type: string;
    amount: string;
    balance_after: string;
    unit_code: string;
    unit_scale: number;
    feature_key?: string;
    reference_type?: string;
    reference_id?: string;
    idempotency_key?: string;
    meta_json: Record<string, unknown>;
    created_at: string;
  };
  balance: WalletEngineBalance;
};

const PLATFORM_KEY = 'leadflow';
const PRODUCT_KEY = 'ads_wheel';
const UNIT_CODE = 'KREDIT';
const UNIT_SCALE = 6;
const SEAT_DEBIT_FEATURE_KEY = 'ads_wheel.seat';

const sanitizeNullableText = (value: string | null | undefined) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeBaseUrl = (value: string | null | undefined) => {
  const sanitized = sanitizeNullableText(value);

  if (!sanitized) {
    return null;
  }

  try {
    const url = new URL(sanitized);
    return url.toString().replace(/\/+$/, '');
  } catch {
    return null;
  }
};

@Injectable()
export class WalletEngineService {
  private readonly internalUrl: string | null;
  private readonly apiKey: string | null;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.internalUrl = normalizeBaseUrl(
      this.configService.get<string>('WALLET_ENGINE_INTERNAL_URL'),
    );
    this.apiKey = sanitizeNullableText(
      this.configService.get<string>('WALLET_ENGINE_API_KEY'),
    );
  }

  isConfigured() {
    return Boolean(this.internalUrl && this.apiKey);
  }

  getInternalUrl() {
    return this.internalUrl;
  }

  async upsertTeamAccount(teamId: string): Promise<WalletEngineAccount> {
    const normalizedTeamId = this.requireText(teamId, 'teamId');
    const response = await this.post<WalletEngineAccount>(
      '/accounts/upsert',
      {
        platform_key: PLATFORM_KEY,
        product_key: PRODUCT_KEY,
        tenant_id: normalizedTeamId,
        external_ref: normalizedTeamId,
        unit_code: UNIT_CODE,
        unit_scale: UNIT_SCALE,
      },
      this.buildIdempotencyKey('team-account-upsert', normalizedTeamId),
    );

    if (!sanitizeNullableText(response.id)) {
      throw new BadGatewayException(
        'Wallet engine did not return an account id.',
      );
    }

    return response;
  }

  async getTeamBalance(accountId: string): Promise<WalletEngineBalance> {
    const normalizedAccountId = this.requireText(accountId, 'accountId');

    return await this.get<WalletEngineBalance>(
      `/wallets/${encodeURIComponent(normalizedAccountId)}/balance`,
    );
  }

  async debitSeat(
    accountId: string,
    amount: string,
    referenceId: string,
  ): Promise<WalletEngineDebitResult> {
    const normalizedAccountId = this.requireText(accountId, 'accountId');
    const normalizedAmount = this.requireText(amount, 'amount');
    const normalizedReferenceId = this.requireText(referenceId, 'referenceId');

    return await this.post<WalletEngineDebitResult>(
      '/wallets/debit',
      {
        account_id: normalizedAccountId,
        amount: normalizedAmount,
        unit_code: UNIT_CODE,
        unit_scale: UNIT_SCALE,
        feature_key: SEAT_DEBIT_FEATURE_KEY,
        reference_type: 'seat_billing',
        reference_id: normalizedReferenceId,
        meta: {
          platform_key: PLATFORM_KEY,
          product_key: PRODUCT_KEY,
        },
      },
      this.buildIdempotencyKey('seat-debit', [
        normalizedAccountId,
        normalizedAmount,
        normalizedReferenceId,
      ]),
    );
  }

  private async get<T>(path: string): Promise<T> {
    this.ensureConfigured();

    try {
      const response = await firstValueFrom(
        this.httpService.get<T>(this.buildUrl(path), {
          headers: this.buildHeaders(),
        }),
      );

      return response.data;
    } catch (error) {
      throw this.toRequestException(error);
    }
  }

  private async post<T>(
    path: string,
    payload: unknown,
    idempotencyKey: string,
  ): Promise<T> {
    this.ensureConfigured();

    try {
      const response = await firstValueFrom(
        this.httpService.post<T>(this.buildUrl(path), payload, {
          headers: this.buildHeaders(idempotencyKey),
        }),
      );

      return response.data;
    } catch (error) {
      throw this.toRequestException(error);
    }
  }

  private buildUrl(path: string) {
    return `${this.internalUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private buildHeaders(idempotencyKey?: string): AxiosRequestConfig['headers'] {
    return {
      Accept: 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      ...(idempotencyKey
        ? {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          }
        : {}),
    };
  }

  private buildIdempotencyKey(
    operation: string,
    input: string | string[],
    maxLength = 120,
  ) {
    const fingerprint = Array.isArray(input) ? input.join('|') : input;
    const digest = createHash('sha256').update(fingerprint).digest('hex');
    const normalized = `${operation}-${digest.slice(0, 24)}`.replace(
      /[^A-Za-z0-9_.:-]/g,
      '-',
    );

    return normalized.slice(0, maxLength);
  }

  private ensureConfigured() {
    if (this.isConfigured()) {
      return;
    }

    throw new ServiceUnavailableException(
      'Wallet engine client is not configured for this environment.',
    );
  }

  private requireText(value: string, field: string) {
    const normalized = sanitizeNullableText(value);

    if (!normalized) {
      throw new ServiceUnavailableException(
        `Wallet engine ${field} is required.`,
      );
    }

    return normalized;
  }

  private toRequestException(error: unknown) {
    const axiosError = error as AxiosError<{ error?: { message?: string } }>;
    const status = axiosError.response?.status;
    const message =
      axiosError.response?.data?.error?.message ??
      axiosError.message ??
      'Wallet engine request failed.';

    if (status) {
      return new BadGatewayException(
        `Wallet engine request failed with HTTP ${status}: ${message}`,
      );
    }

    return new ServiceUnavailableException(
      `Wallet engine is unavailable: ${message}`,
    );
  }
}
