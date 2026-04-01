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

  it('injects Authorization on GET requests', async () => {
    const { service, httpService } = createService();

    httpService.get.mockReturnValue(
      of(
        buildAxiosResponse({
          account_id: 'account-1',
          unit_code: 'KREDIT',
          unit_scale: 6,
          balance: '10.000000',
          held_amount: '0.000000',
          available_balance: '10.000000',
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
          unit_code: 'KREDIT',
          unit_scale: 6,
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

  it('uses a deterministic Idempotency-Key for repeated seat debits', async () => {
    const { service, httpService } = createService();

    httpService.post.mockReturnValue(
      of(
        buildAxiosResponse({
          ledger_entry: {
            id: 'ledger-1',
            account_id: 'account-1',
            movement_type: 'debit',
            amount: '25.000000',
            balance_after: '75.000000',
            unit_code: 'KREDIT',
            unit_scale: 6,
            feature_key: 'ads_wheel.seat',
            reference_type: 'seat_billing',
            reference_id: 'seat-1',
            idempotency_key: 'seat-debit',
            meta_json: {},
            created_at: '2026-04-01T00:00:00.000Z',
          },
          balance: {
            account_id: 'account-1',
            unit_code: 'KREDIT',
            unit_scale: 6,
            balance: '75.000000',
            held_amount: '0.000000',
            available_balance: '75.000000',
            updated_at: '2026-04-01T00:00:00.000Z',
          },
        }),
      ),
    );

    await service.debitSeat('account-1', '25.000000', 'seat-1');
    await service.debitSeat('account-1', '25.000000', 'seat-1');

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
            amount: '25.000000',
            balance_after: '75.000000',
            unit_code: 'KREDIT',
            unit_scale: 6,
            feature_key: 'ads_wheel.seat',
            reference_type: 'seat_billing',
            reference_id: 'join_wheel-1_sponsor-1',
            idempotency_key: 'join_wheel-1_sponsor-1',
            meta_json: {},
            created_at: '2026-04-01T00:00:00.000Z',
          },
          balance: {
            account_id: 'account-1',
            unit_code: 'KREDIT',
            unit_scale: 6,
            balance: '75.000000',
            held_amount: '0.000000',
            available_balance: '75.000000',
            updated_at: '2026-04-01T00:00:00.000Z',
          },
        }),
      ),
    );

    await service.debitSeat(
      'account-1',
      '25.000000',
      'join_wheel-1_sponsor-1',
      {
        idempotencyKey: 'join_wheel-1_sponsor-1',
      },
    );

    expect(
      httpService.post.mock.calls[0]?.[2]?.headers?.['Idempotency-Key'],
    ).toBe('join_wheel-1_sponsor-1');
  });

  it('formats integer minor units using the wallet scale', () => {
    const { service } = createService();

    expect(service.formatMinorUnits(25_000_000)).toBe('25.000000');
    expect(service.formatMinorUnits(1)).toBe('0.000001');
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
