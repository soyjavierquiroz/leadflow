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

export type WalletEngineCreditResult = WalletEngineDebitResult;

export type WalletEngineDebitOptions = {
  idempotencyKey?: string;
};

export type WalletEngineCreditOptions = {
  featureKey?: string;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  meta?: Record<string, unknown>;
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
const KREDIT_PLATFORM_KEY = PLATFORM_KEY;
const KREDIT_PRODUCT_KEY = 'leadflow';
const TEAM_PRODUCT_KEY = 'ads_wheel';
const UNIT_CODE = 'USD';
const UNIT_SCALE = 2;
const SEAT_DEBIT_FEATURE_KEY = 'ads_wheel.seat';
const KREDIT_UNIT_CODE = 'KREDIT';
const KREDIT_UNIT_SCALE = 6;
const INITIAL_WELCOME_CREDITS_AMOUNT = '5000000';
const DECIMAL_AMOUNT_PATTERN = /^-?\d+(?:\.\d+)?$/;
const WALLET_POST_MAX_ATTEMPTS = 3;
const WALLET_POST_RETRY_DELAY_MS = 250;

const sanitizeNullableText = (value: string | null | undefined) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const formatMinorUnitString = (value: string, scale: number) => {
  const normalized = sanitizeNullableText(value);

  if (!normalized || !/^-?\d+$/.test(normalized)) {
    throw new ServiceUnavailableException(
      'Wallet engine amount must be expressed as integer minor units.',
    );
  }

  const negative = normalized.startsWith('-');
  const digits = negative ? normalized.slice(1) : normalized;
  const paddedDigits = digits.padStart(scale + 1, '0');
  const whole = paddedDigits.slice(0, -scale) || '0';
  const fraction = paddedDigits.slice(-scale);

  return `${negative ? '-' : ''}${whole}.${fraction}`;
};

const normalizeDecimalAmountString = (value: string, scale: number) => {
  const normalized = sanitizeNullableText(value);

  if (!normalized || !DECIMAL_AMOUNT_PATTERN.test(normalized)) {
    throw new ServiceUnavailableException(
      'Wallet engine amount must be expressed as a decimal string.',
    );
  }

  if (!Number.isInteger(scale) || scale < 0 || scale > 9) {
    throw new ServiceUnavailableException(
      'Wallet engine unit scale must be an integer between 0 and 9.',
    );
  }

  const negative = normalized.startsWith('-');
  const unsignedValue = negative ? normalized.slice(1) : normalized;
  const [wholeRaw, fractionRaw = ''] = unsignedValue.split('.');

  if (fractionRaw.length > scale) {
    throw new ServiceUnavailableException(
      `Wallet engine amount exceeds the allowed ${scale} decimal places.`,
    );
  }

  const whole = wholeRaw.replace(/^0+(?=\d)/, '') || '0';

  if (scale === 0) {
    if (fractionRaw.length > 0) {
      throw new ServiceUnavailableException(
        'Wallet engine amount does not allow decimal places for this unit.',
      );
    }

    return `${negative ? '-' : ''}${whole}`;
  }

  return `${negative ? '-' : ''}${whole}.${fractionRaw.padEnd(scale, '0')}`;
};

const isPositiveDecimalAmountString = (value: string) =>
  !value.startsWith('-') && !/^0(?:\.0+)?$/.test(value);

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
      this.configService.get<string>('WALLET_ENGINE_BASE_URL') ??
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

  async upsertAccount(tenantId: string): Promise<WalletEngineAccountRef> {
    const normalizedTenantId = this.requireText(tenantId, 'tenantId');
    const response = await this.post<WalletEngineAccountUpsertResponse>(
      '/accounts/upsert',
      {
        platform_key: KREDIT_PLATFORM_KEY,
        product_key: KREDIT_PRODUCT_KEY,
        tenant_id: normalizedTenantId,
        external_ref: normalizedTenantId,
        unit_code: KREDIT_UNIT_CODE,
        unit_scale: KREDIT_UNIT_SCALE,
      },
      this.buildIdempotencyKey('leadflow-kredit-account-upsert', [
        KREDIT_PLATFORM_KEY,
        KREDIT_PRODUCT_KEY,
        normalizedTenantId,
      ]),
    );
    const accountId = this.readAccountId(response);

    if (!accountId) {
      throw new BadGatewayException(
        'Wallet engine did not return an account id for the KREDIT account.',
      );
    }

    return {
      accountId,
    };
  }

  async upsertSponsorAccount(
    sponsorId: string,
  ): Promise<WalletEngineAccountRef> {
    const normalizedSponsorId = this.requireText(sponsorId, 'sponsorId');
    return await this.upsertAccount(normalizedSponsorId);
  }

  async getTeamBalance(accountId: string): Promise<WalletEngineBalance> {
    const normalizedAccountId = this.requireText(accountId, 'accountId');

    return await this.get<WalletEngineBalance>(
      this.buildBalancePath(normalizedAccountId, TEAM_PRODUCT_KEY),
    );
  }

  async creditInitialKredits(accountId: string, sponsorId: string) {
    const normalizedAccountId = this.requireText(accountId, 'accountId');
    const normalizedSponsorId = this.requireText(sponsorId, 'sponsorId');

    return await this.post<unknown>(
      '/wallets/credit',
      {
        account_id: normalizedAccountId,
        amount: formatMinorUnitString(
          INITIAL_WELCOME_CREDITS_AMOUNT,
          KREDIT_UNIT_SCALE,
        ),
        unit_code: KREDIT_UNIT_CODE,
        unit_scale: KREDIT_UNIT_SCALE,
        reference_type: 'welcome_bonus',
        reference_id: normalizedSponsorId,
      },
      `welcome_bonus_kredit_${normalizedSponsorId}`,
    );
  }

  async getSponsorKredits(accountId: string): Promise<string> {
    const normalizedAccountId = this.requireText(accountId, 'accountId');
    const response = await this.get<WalletEngineBalanceResponse>(
      this.buildBalancePath(normalizedAccountId, KREDIT_PRODUCT_KEY),
    );
    const balances = this.toBalanceList(response);
    const kredietBalance = balances.find(
      (balance) => balance.unit_code === KREDIT_UNIT_CODE,
    );

    if (!kredietBalance) {
      return normalizeDecimalAmountString('0', KREDIT_UNIT_SCALE);
    }

    return this.normalizeDecimalAmountForScale(
      kredietBalance.balance,
      kredietBalance.unit_scale,
      KREDIT_UNIT_SCALE,
    );
  }

  normalizeKreditAmount(amount: string) {
    return normalizeDecimalAmountString(amount, KREDIT_UNIT_SCALE);
  }

  async creditKredits(
    accountId: string,
    amount: string,
    options?: WalletEngineCreditOptions,
  ): Promise<WalletEngineCreditResult> {
    const normalizedAccountId = this.requireText(accountId, 'accountId');
    const normalizedAmount = this.normalizeKreditAmount(amount);

    if (!isPositiveDecimalAmountString(normalizedAmount)) {
      throw new ServiceUnavailableException(
        'Wallet engine amount must be greater than zero.',
      );
    }

    const normalizedReferenceType = options?.referenceType
      ? this.requireText(options.referenceType, 'referenceType')
      : 'admin_credit';
    const normalizedReferenceId = options?.referenceId
      ? this.requireText(options.referenceId, 'referenceId')
      : this.buildIdempotencyKey('kredit-credit-ref', [
          normalizedAccountId,
          normalizedAmount,
        ]);
    const normalizedIdempotencyKey = options?.idempotencyKey
      ? this.requireText(options.idempotencyKey, 'idempotencyKey')
      : this.buildIdempotencyKey('kredit-credit', [
          normalizedAccountId,
          normalizedAmount,
          normalizedReferenceType,
          normalizedReferenceId,
        ]);

    return await this.post<WalletEngineCreditResult>(
      '/wallets/credit',
      {
        account_id: normalizedAccountId,
        amount: normalizedAmount,
        unit_code: KREDIT_UNIT_CODE,
        unit_scale: KREDIT_UNIT_SCALE,
        feature_key: options?.featureKey,
        reference_type: normalizedReferenceType,
        reference_id: normalizedReferenceId,
        reason: options?.reason,
        meta: options?.meta ?? {},
      },
      normalizedIdempotencyKey,
    );
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

    for (let attempt = 1; attempt <= WALLET_POST_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await firstValueFrom(
          this.httpService.post<T>(this.buildUrl(path), payload, {
            headers: this.buildHeaders(idempotencyKey),
          }),
        );

        return response.data;
      } catch (error) {
        if (
          attempt >= WALLET_POST_MAX_ATTEMPTS ||
          !this.shouldRetryPost(error)
        ) {
          throw this.toRequestException(error);
        }

        await this.sleep(WALLET_POST_RETRY_DELAY_MS * attempt);
      }
    }

    throw new ServiceUnavailableException(
      'Wallet engine request failed after retries.',
    );
  }

  private buildUrl(path: string) {
    return `${this.internalUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private buildBalancePath(accountId: string, productKey: string) {
    const query = new URLSearchParams({
      platform_key: PLATFORM_KEY,
      product_key: productKey,
    });

    return `/wallets/${encodeURIComponent(accountId)}/balance?${query.toString()}`;
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

  private shouldRetryPost(error: unknown) {
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;

    return status === undefined || status === 429 || status >= 500;
  }

  private async sleep(milliseconds: number) {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  private normalizeDecimalAmountForScale(
    value: string,
    sourceScale: number,
    targetScale: number,
  ) {
    const sourceAmount = normalizeDecimalAmountString(value, sourceScale);

    if (sourceScale === targetScale) {
      return sourceAmount;
    }

    const negative = sourceAmount.startsWith('-');
    const unsignedValue = negative ? sourceAmount.slice(1) : sourceAmount;
    const [whole, fraction = ''] = unsignedValue.split('.');
    const minorUnits = `${whole}${fraction}`.replace(/^0+(?=\d)/, '') || '0';

    return normalizeDecimalAmountString(
      formatMinorUnitString(`${negative ? '-' : ''}${minorUnits}`, targetScale),
      targetScale,
    );
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
