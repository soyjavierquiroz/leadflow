import { buildRuntimeContextConfigSyncPayload } from './runtime-context-config-sync.service';

describe('RuntimeContextConfigSyncService payload contract', () => {
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
});
