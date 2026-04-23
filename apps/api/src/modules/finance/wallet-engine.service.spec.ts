import type {
  AxiosResponse,
  InternalAxiosRequestConfig,
  RawAxiosRequestHeaders,
} from 'axios';
import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import {
  readWalletEngineException,
  WalletEngineService,
} from './wallet-engine.service';

const buildAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {
    headers: {} as RawAxiosRequestHeaders,
  } as InternalAxiosRequestConfig,
});

describe('WalletEngineService', () => {
  const createService = () => {
    const httpService = {
      get: jest.fn(),
      post: jest.fn(),
    };
    const configService = new ConfigService({
      WALLET_ENGINE_INTERNAL_URL: 'http://wallet-engine:3000',
      WALLET_ENGINE_API_KEY: 'wallet-secret',
    });

    return {
      httpService,
      service: new WalletEngineService(httpService as never, configService),
    };
  };

  const createServiceWithBaseUrl = () => {
    const httpService = {
      get: jest.fn(),
      post: jest.fn(),
    };
    const configService = new ConfigService({
      WALLET_ENGINE_BASE_URL: 'http://wallet-api:3000',
      WALLET_ENGINE_API_KEY: 'wallet-secret',
    });

    return {
      httpService,
      service: new WalletEngineService(httpService as never, configService),
    };
  };

  it('injects Authorization on GET requests', async () => {
    const { service, httpService } = createService();

    httpService.get.mockReturnValue(
      of(
        buildAxiosResponse({
          account_id: 'account-1',
          unit_code: 'USD',
          unit_scale: 2,
          balance: '10.00',
          held_amount: '0.00',
          available_balance: '10.00',
          updated_at: '2026-04-01T00:00:00.000Z',
        }),
      ),
    );

    await service.getTeamBalance('account-1');

    expect(httpService.get).toHaveBeenCalledWith(
      'http://wallet-engine:3000/wallets/account-1/balance',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer wallet-secret',
        }),
      }),
    );
    expect(
      httpService.get.mock.calls[0]?.[1]?.headers?.['Idempotency-Key'],
    ).toBeUndefined();
  });

  it('injects Authorization and Idempotency-Key on account upserts', async () => {
    const { service, httpService } = createService();

    httpService.post.mockReturnValue(
      of(
        buildAxiosResponse({
          id: 'account-1',
          platform_key: 'leadflow',
          product_key: 'ads_wheel',
          tenant_id: 'team-1',
          external_ref: 'team-1',
          unit_code: 'USD',
          unit_scale: 2,
          status: 'active',
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: '2026-04-01T00:00:00.000Z',
        }),
      ),
    );

    await service.upsertTeamAccount('team-1');

    expect(httpService.post).toHaveBeenCalledWith(
      'http://wallet-engine:3000/accounts/upsert',
      {
        platform_key: 'leadflow',
        product_key: 'ads_wheel',
        tenant_id: 'team-1',
        external_ref: 'team-1',
        unit_code: 'USD',
        unit_scale: 2,
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer wallet-secret',
          'Idempotency-Key': expect.any(String),
        }),
      }),
    );
  });

  it('upserts KREDIT accounts for the Leadflow product', async () => {
    const { service, httpService } = createService();

    httpService.post.mockReturnValue(
      of(
        buildAxiosResponse({
          account_id: 'account-kredit-1',
          platform_key: 'kurukin',
          product_key: 'leadflow',
          tenant_id: 'sponsor-1',
          status: 'active',
          created_at: '2026-04-01T00:00:00.000Z',
          updated_at: '2026-04-01T00:00:00.000Z',
        }),
      ),
    );

    await expect(service.upsertSponsorAccount('sponsor-1')).resolves.toEqual({
      accountId: 'account-kredit-1',
    });

    expect(httpService.post).toHaveBeenCalledWith(
      'http://wallet-engine:3000/accounts/upsert',
      {
        tenant_id: 'sponsor-1',
        external_ref: 'sponsor-1',
        platform_key: 'kurukin',
        product_key: 'leadflow',
        unit_code: 'KREDIT',
        unit_scale: 6,
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer wallet-secret',
          'Idempotency-Key': expect.any(String),
        }),
      }),
    );
  });

  it('credits the welcome KREDIT bonus with an explicit idempotency key', async () => {
    const { service, httpService } = createService();

    httpService.post.mockReturnValue(of(buildAxiosResponse({ ok: true })));

    await service.creditInitialKredits('account-kredit-1', 'sponsor-1');

    expect(httpService.post).toHaveBeenCalledWith(
      'http://wallet-engine:3000/wallets/credit',
      {
        account_id: 'account-kredit-1',
        amount: '5.000000',
        unit_code: 'KREDIT',
        unit_scale: 6,
        reference_type: 'welcome_bonus',
        reference_id: 'sponsor-1',
      },
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer wallet-secret',
          'Idempotency-Key': 'welcome_bonus_kredit_sponsor-1',
        }),
      }),
    );
  });

  it('prefers WALLET_ENGINE_BASE_URL when building wallet requests', async () => {
    const { service, httpService } = createServiceWithBaseUrl();

    httpService.post.mockReturnValue(
      of(
        buildAxiosResponse({
          account_id: 'account-kredit-1',
          platform_key: 'kurukin',
          product_key: 'leadflow',
          tenant_id: 'sponsor-1',
        }),
      ),
    );

    await service.upsertAccount('sponsor-1');

    expect(httpService.post).toHaveBeenCalledWith(
      'http://wallet-api:3000/accounts/upsert',
      expect.objectContaining({
        platform_key: 'kurukin',
        product_key: 'leadflow',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer wallet-secret',
        }),
      }),
    );
  });

  it('reads the KREDIT balance from wallet balance collections', async () => {
    const { service, httpService } = createService();

    httpService.get.mockReturnValue(
      of(
        buildAxiosResponse({
          balances: [
            {
              account_id: 'account-kredit-1',
              unit_code: 'USD',
              unit_scale: 2,
              balance: '10.00',
              held_amount: '0.00',
              available_balance: '10.00',
              updated_at: '2026-04-01T00:00:00.000Z',
            },
            {
              account_id: 'account-kredit-1',
              unit_code: 'KREDIT',
              unit_scale: 0,
              balance: '5000000',
              held_amount: '0',
              available_balance: '5000000',
              updated_at: '2026-04-01T00:00:00.000Z',
            },
          ],
        }),
      ),
    );

    await expect(service.getSponsorKredits('account-kredit-1')).resolves.toBe(
      '5000000',
    );
  });

  it('uses a deterministic Idempotency-Key for repeated seat debits', async () => {
    const { service, httpService } = createService();

    httpService.post.mockReturnValue(
      of(
        buildAxiosResponse({
          ledger_entry: {
            id: 'ledger-1',
            account_id: 'account-1',
            movement_type: 'debit',
            amount: '25.00',
            balance_after: '75.00',
            unit_code: 'USD',
            unit_scale: 2,
            feature_key: 'ads_wheel.seat',
            reference_type: 'seat_billing',
            reference_id: 'seat-1',
            idempotency_key: 'seat-debit',
            meta_json: {},
            created_at: '2026-04-01T00:00:00.000Z',
          },
          balance: {
            account_id: 'account-1',
            unit_code: 'USD',
            unit_scale: 2,
            balance: '75.00',
            held_amount: '0.00',
            available_balance: '75.00',
            updated_at: '2026-04-01T00:00:00.000Z',
          },
        }),
      ),
    );

    await service.debitSeat('account-1', '25.00', 'seat-1');
    await service.debitSeat('account-1', '25.00', 'seat-1');

    const firstHeaders = httpService.post.mock.calls[0]?.[2]?.headers;
    const secondHeaders = httpService.post.mock.calls[1]?.[2]?.headers;

    expect(firstHeaders.Authorization).toBe('Bearer wallet-secret');
    expect(firstHeaders['Idempotency-Key']).toBeDefined();
    expect(secondHeaders['Idempotency-Key']).toBe(
      firstHeaders['Idempotency-Key'],
    );
  });

  it('accepts a custom Idempotency-Key for seat debits', async () => {
    const { service, httpService } = createService();

    httpService.post.mockReturnValue(
      of(
        buildAxiosResponse({
          ledger_entry: {
            id: 'ledger-1',
            account_id: 'account-1',
            movement_type: 'debit',
            amount: '25.00',
            balance_after: '75.00',
            unit_code: 'USD',
            unit_scale: 2,
            feature_key: 'ads_wheel.seat',
            reference_type: 'seat_billing',
            reference_id: 'join_wheel-1_sponsor-1',
            idempotency_key: 'join_wheel-1_sponsor-1',
            meta_json: {},
            created_at: '2026-04-01T00:00:00.000Z',
          },
          balance: {
            account_id: 'account-1',
            unit_code: 'USD',
            unit_scale: 2,
            balance: '75.00',
            held_amount: '0.00',
            available_balance: '75.00',
            updated_at: '2026-04-01T00:00:00.000Z',
          },
        }),
      ),
    );

    await service.debitSeat('account-1', '25.00', 'join_wheel-1_sponsor-1', {
      idempotencyKey: 'join_wheel-1_sponsor-1',
    });

    expect(
      httpService.post.mock.calls[0]?.[2]?.headers?.['Idempotency-Key'],
    ).toBe('join_wheel-1_sponsor-1');
  });

  it('formats integer minor units using the wallet scale', () => {
    const { service } = createService();

    expect(service.formatMinorUnits(2_500)).toBe('25.00');
    expect(service.formatMinorUnits(1)).toBe('0.01');
  });

  it('exposes the upstream wallet status from wrapped exceptions', () => {
    const error = new BadGatewayException({
      code: 'WALLET_ENGINE_REQUEST_FAILED',
      message: 'Wallet engine request failed with HTTP 402: insufficient funds',
      upstreamStatus: 402,
    });

    expect(readWalletEngineException(error)).toEqual({
      upstreamStatus: 402,
      message: 'Wallet engine request failed with HTTP 402: insufficient funds',
    });
  });
});
