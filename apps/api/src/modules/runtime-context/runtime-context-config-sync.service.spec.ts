import {
  RuntimeContextConfigSyncService,
  buildRuntimeContextConfigSyncPayload,
} from './runtime-context-config-sync.service';

describe('RuntimeContextConfigSyncService payload contract', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('maps AI config fields to the runtime-context snake_case contract', () => {
    const payload = buildRuntimeContextConfigSyncPayload({
      tenantId: 'tenant-1',
      memberId: 'lead-handler:funnel-1',
      basePrompt: 'Base prompt',
      verticalKey: 'health',
      brandKey: 'freddy',
      businessModelType: 'high_ticket',
      routeContexts: {
        offer: 'Offer context',
      },
      funnelContext: {
        funnel_instance_id: 'funnel-1',
      },
      ctaPolicy: {
        default_cta: 'watch_video',
      },
      aiPolicy: {
        model: 'gpt-4o-mini',
        kloser: {
          strategy: {
            cadence_minutes: [60, 240],
          },
        },
      },
      status: 'active',
    });

    expect(payload).toEqual({
      tenant_id: 'tenant-1',
      member_id: 'lead-handler:funnel-1',
      base_prompt: 'Base prompt',
      vertical_key: 'health',
      brand_key: 'freddy',
      business_model_type: 'high_ticket',
      route_contexts: {
        offer: 'Offer context',
      },
      funnel_context: {
        funnel_instance_id: 'funnel-1',
      },
      cta_policy: {
        default_cta: 'watch_video',
      },
      ai_policy: {
        model: 'gpt-4o-mini',
        kloser: {
          strategy: {
            cadence_minutes: [60, 240],
          },
        },
      },
      status: 'active',
    });
    expect(payload).not.toHaveProperty('aiPolicy');
    expect(payload).not.toHaveProperty('ctaPolicy');
    expect(payload).not.toHaveProperty('routeContexts');
    expect(payload).not.toHaveProperty('funnelContext');
  });

  it('posts an AI agent config sync payload with runtime naming and routing metadata', async () => {
    process.env.RUNTIME_CONTEXT_CENTRAL_BASE_URL =
      'http://runtime-context.example';
    process.env.RUNTIME_CONTEXT_CENTRAL_API_KEY = 'secret-key';

    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);
    const service = new RuntimeContextConfigSyncService({} as never);

    await service.syncAiAgentConfig({
      tenantCode: 'freddy-dxn',
      config: {
        id: 'config-1',
        tenantId: 'tenant-1',
        memberId: null,
        basePrompt: 'Prompt guardado',
        routeContexts: null,
        ctaPolicy: null,
        aiPolicy: null,
        isActive: true,
        createdAt: new Date('2026-05-20T00:00:00.000Z'),
        updatedAt: new Date('2026-05-21T00:00:00.000Z'),
      },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://runtime-context.example/v1/config/sync',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-internal-api-key': 'secret-key',
          'x-service-key': 'leadflow_api',
        }),
        body: JSON.stringify({
          tenant_id: 'tenant-1',
          member_id: null,
          base_prompt: 'Prompt guardado',
          vertical_key: 'multinivel',
          brand_key: 'freddy-dxn',
          business_model_type: 'multinivel',
          route_contexts: {},
          funnel_context: {},
          cta_policy: {},
          ai_policy: {
            vertical_key: 'multinivel',
            brand_key: 'freddy-dxn',
            business_model_type: 'multinivel',
          },
          status: 'active',
        }),
      }),
    );
  });
});
