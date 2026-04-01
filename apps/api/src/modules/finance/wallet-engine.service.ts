import { HttpService } from '@nestjs/axios';
import {
  BadGatewayException,
  ServiceUnavailableException,
  Injectable,
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

type WalletEngineAccountUpsertResponse =
  | WalletEngineAccount
  | {
      account_id: string;
      platform_key: string;
      product_key: string;
      tenant_id: string;
      status?: string;
      created_at?: string;
      updated_at?: string;
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

export type WalletEngineDebitOptions = {
  idempotencyKey?: string;
};

export type WalletEngineAccountRef = {
  accountId: string;
};

type WalletEngineBalanceResponse =
  | WalletEngineBalance
  | WalletEngineBalance[]
  | {
      balances: WalletEngineBalance[];
    };

type WalletEngineExceptionResponse = {
  code: string;
  message: string;
  upstreamStatus: number | null;
};

const PLATFORM_KEY = 'leadflow';
const TEAM_PRODUCT_KEY = 'ads_wheel';
const SPONSOR_PRODUCT_KEY = 'ai_assistant';
const UNIT_CODE = 'USD';
const UNIT_SCALE = 2;
const SEAT_DEBIT_FEATURE_KEY = 'ads_wheel.seat';
const KREDIT_UNIT_CODE = 'KREDIT';
const WELCOME_BONUS_AMOUNT = '5000000';

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
        product_key: TEAM_PRODUCT_KEY,
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

  async upsertSponsorAccount(sponsorId: string): Promise<WalletEngineAccountRef> {
    const normalizedSponsorId = this.requireText(sponsorId, 'sponsorId');
    const response = await this.post<WalletEngineAccountUpsertResponse>(
      '/accounts/upsert',
      {
        tenant_id: normalizedSponsorId,
        platform_key: PLATFORM_KEY,
        product_key: SPONSOR_PRODUCT_KEY,
      },
      this.buildIdempotencyKey('sponsor-account-upsert', normalizedSponsorId),
    );
    const accountId = this.readAccountId(response);

    if (!accountId) {
      throw new BadGatewayException(
        'Wallet engine did not return an account id for the sponsor account.',
      );
    }

    return {
      accountId,
    };
  }

  async getTeamBalance(accountId: string): Promise<WalletEngineBalance> {
    const normalizedAccountId = this.requireText(accountId, 'accountId');

    return await this.get<WalletEngineBalance>(
      `/wallets/${encodeURIComponent(normalizedAccountId)}/balance`,
    );
  }

  async creditInitialKredits(accountId: string, sponsorId: string) {
    const normalizedAccountId = this.requireText(accountId, 'accountId');
    const normalizedSponsorId = this.requireText(sponsorId, 'sponsorId');

    return await this.post<unknown>(
      '/wallets/credit',
      {
        account_id: normalizedAccountId,
        amount: WELCOME_BONUS_AMOUNT,
        unit_code: KREDIT_UNIT_CODE,
        reference_type: 'welcome_bonus',
        reference_id: normalizedSponsorId,
      },
      `welcome_bonus_kredit_${normalizedSponsorId}`,
    );
  }

  async getSponsorKredits(accountId: string): Promise<string> {
    const normalizedAccountId = this.requireText(accountId, 'accountId');
    const response = await this.get<WalletEngineBalanceResponse>(
      `/wallets/${encodeURIComponent(normalizedAccountId)}/balance`,
    );
    const balances = this.toBalanceList(response);
    const kredietBalance = balances.find(
      (balance) => balance.unit_code === KREDIT_UNIT_CODE,
    );

    return kredietBalance?.balance ?? '0';
  }

  async debitSeat(
    accountId: string,
    amount: string,
    referenceId: string,
    options?: WalletEngineDebitOptions,
  ): Promise<WalletEngineDebitResult> {
    const normalizedAccountId = this.requireText(accountId, 'accountId');
    const normalizedAmount = this.requireText(amount, 'amount');
    const normalizedReferenceId = this.requireText(referenceId, 'referenceId');
    const normalizedIdempotencyKey = options?.idempotencyKey
      ? this.requireText(options.idempotencyKey, 'idempotencyKey')
      : this.buildIdempotencyKey('seat-debit', [
          normalizedAccountId,
          normalizedAmount,
          normalizedReferenceId,
        ]);

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
          product_key: TEAM_PRODUCT_KEY,
        },
      },
      normalizedIdempotencyKey,
    );
  }

  formatMinorUnits(amountInMinorUnits: number) {
    if (!Number.isInteger(amountInMinorUnits)) {
      throw new ServiceUnavailableException(
        'Wallet engine amount must be expressed as integer minor units.',
      );
    }

    const sign = amountInMinorUnits < 0 ? '-' : '';
    const absolute = Math.abs(amountInMinorUnits);
    const base = 10 ** UNIT_SCALE;
    const whole = Math.trunc(absolute / base);
    const fraction = String(absolute % base).padStart(UNIT_SCALE, '0');

    return `${sign}${whole}.${fraction}`;
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

  private readAccountId(response: WalletEngineAccountUpsertResponse) {
    if ('account_id' in response) {
      return sanitizeNullableText(response.account_id);
    }

    return sanitizeNullableText(response.id);
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

  private toBalanceList(
    response: WalletEngineBalanceResponse,
  ): WalletEngineBalance[] {
    if (Array.isArray(response)) {
      return response;
    }

    if ('balances' in response && Array.isArray(response.balances)) {
      return response.balances;
    }

    if ('unit_code' in response) {
      return [response];
    }

    return [];
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
      return new BadGatewayException({
        code: 'WALLET_ENGINE_REQUEST_FAILED',
        message: `Wallet engine request failed with HTTP ${status}: ${message}`,
        upstreamStatus: status,
      } satisfies WalletEngineExceptionResponse);
    }

    return new ServiceUnavailableException({
      code: 'WALLET_ENGINE_UNAVAILABLE',
      message: `Wallet engine is unavailable: ${message}`,
      upstreamStatus: null,
    } satisfies WalletEngineExceptionResponse);
  }
}

export const readWalletEngineException = (error: unknown) => {
  if (
    !(
      error instanceof BadGatewayException ||
      error instanceof ServiceUnavailableException
    )
  ) {
    return {
      upstreamStatus: null,
      message: error instanceof Error ? error.message : 'Unknown wallet error.',
    };
  }

  const response = error.getResponse();

  if (!response || typeof response !== 'object' || Array.isArray(response)) {
    return {
      upstreamStatus: null,
      message: error.message,
    };
  }

  return {
    upstreamStatus:
      'upstreamStatus' in response &&
      typeof response.upstreamStatus === 'number'
        ? response.upstreamStatus
        : null,
    message:
      'message' in response && typeof response.message === 'string'
        ? response.message
        : error.message,
  };
};
