import { createHash } from 'crypto';
import { CapiManagerService } from './capi-manager.service';
import type { AttributionDecision } from './public-funnel-runtime.types';

const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

describe('CapiManagerService', () => {
  const buildInput = (decision?: Partial<AttributionDecision>) => ({
    publication: {
      id: 'publication-1',
      teamId: 'team-1',
      metaPixelId: 'meta-pixel-1',
      metaCapiToken: 'meta-token-1',
      tiktokPixelId: 'tt-pixel-1',
      tiktokAccessToken: 'tt-token-1',
      domainHost: 'promo.example.com',
      pathPrefix: '/',
    },
    lead: {
      id: 'lead-1',
      email: 'Lead@Example.com',
      phone: '+57 300 123 4567',
      fullName: 'Lead Demo',
    },
    attributionDecision: {
      entryMode: 'paid_ads',
      trafficLayer: 'PAID_WHEEL',
      forcedSponsorId: null,
      adWheelId: 'wheel-1',
      attributionType: 'promo',
      attributionSlug: 'wheel-1',
      runtimePathPrefix: '/promo/wheel-1',
      referralQueryParam: null,
      sourceUrl: 'https://promo.example.com/promo/wheel-1',
      requestedPath: '/promo/wheel-1',
      pathMatchesCampaign: true,
      fbclid: 'fbclid-123',
      gclid: null,
      ttclid: 'ttclid-456',
      hasPaidClickId: true,
      clientIpAddress: '203.0.113.10',
      clientUserAgent: 'LeadflowTestAgent/1.0',
      ...decision,
    } satisfies AttributionDecision,
    eventId: 'evt-1',
  });

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue('ok'),
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('skips CAPI dispatch for organic traffic', async () => {
    const service = new CapiManagerService();
    const logSpy = jest.spyOn((service as any).logger, 'log');

    await service.dispatchLeadConversion(
      buildInput({
        trafficLayer: 'ORGANIC',
        pathMatchesCampaign: false,
        fbclid: null,
        ttclid: null,
        hasPaidClickId: false,
      }),
    );

    expect(global.fetch).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      '[CAPI_SKIP] Lead identificado como orgánico. Omisión de reporte para evitar polución de píxel.',
    );
  });

  it('skips CAPI dispatch when the paid visit does not match a campaign path', async () => {
    const service = new CapiManagerService();

    await service.dispatchLeadConversion(
      buildInput({
        requestedPath: '/',
        pathMatchesCampaign: false,
      }),
    );

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('dispatches hashed Meta and TikTok payloads for paid campaign traffic with click ids', async () => {
    const service = new CapiManagerService();

    await service.dispatchLeadConversion(buildInput());

    expect(global.fetch).toHaveBeenCalledTimes(2);

    const metaCall = (global.fetch as jest.Mock).mock.calls[0];
    const tikTokCall = (global.fetch as jest.Mock).mock.calls[1];
    const metaBody = JSON.parse(metaCall[1].body as string);
    const tikTokBody = JSON.parse(tikTokCall[1].body as string);

    expect(metaCall[0]).toContain('/meta-pixel-1/events');
    expect(metaCall[0]).toContain('access_token=meta-token-1');
    expect(tikTokCall[1].headers['Access-Token']).toBe('tt-token-1');
    expect(tikTokBody.event_source_id).toBe('tt-pixel-1');
    expect(metaBody.data[0].user_data.em).toEqual([
      sha256('lead@example.com'),
    ]);
    expect(metaBody.data[0].user_data.ph).toEqual([
      sha256('573001234567'),
    ]);
    expect(metaBody.data[0].user_data.client_ip_address).toBe('203.0.113.10');
    expect(metaBody.data[0].user_data.client_user_agent).toBe(
      'LeadflowTestAgent/1.0',
    );
    expect(metaBody.data[0].event_name).toBe('CompleteRegistration');
    expect(tikTokBody.data[0].event).toBe('CompleteRegistration');
    expect(metaBody.data[0].event_id).toBe('evt-1');
    expect(tikTokBody.data[0].event_id).toBe('evt-1');
    expect(tikTokBody.data[0].context.user.email).toBe(
      sha256('lead@example.com'),
    );
    expect(tikTokBody.data[0].context.user.phone_number).toBe(
      sha256('573001234567'),
    );
    expect(tikTokBody.data[0].context.ad.callback).toBe('ttclid-456');
  });

  it('does not include access tokens or provider response bodies in CAPI error logs', async () => {
    const service = new CapiManagerService();
    const errorSpy = jest.spyOn((service as any).logger, 'error');

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      text: jest
        .fn()
        .mockResolvedValue('provider echoed meta-token-1 and tt-token-1'),
    });

    await service.dispatchLeadConversion(buildInput());

    const loggedMessages = errorSpy.mock.calls
      .flat()
      .map((value) => String(value))
      .join('\n');

    expect(loggedMessages).toContain('Meta dispatch failed');
    expect(loggedMessages).toContain('TikTok dispatch failed');
    expect(loggedMessages).not.toContain('meta-token-1');
    expect(loggedMessages).not.toContain('tt-token-1');
    expect(loggedMessages).not.toContain('provider echoed');
  });
});
