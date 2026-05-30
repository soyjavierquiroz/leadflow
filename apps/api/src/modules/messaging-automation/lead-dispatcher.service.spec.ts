import { LeadDispatcherService } from './lead-dispatcher.service';

describe('LeadDispatcherService', () => {
  const fixedNow = '2026-03-30T12:00:00.000Z';
  const mockAssignment = {
    id: 'assign_test_ana_001',
    teamId: 'team_test_001',
    workspace: {
      timezone: 'America/La_Paz',
    },
    team: {
      id: 'team_test_001',
      name: 'Inmuno Team',
      code: 'inmuno-team',
      aiAgentConfigs: [
        {
          id: 'tenant_config_custom_001',
          basePrompt: 'Prompt custom de Inmuno para seguimiento.',
          updatedAt: new Date('2026-03-29T10:00:00.000Z'),
          routeContexts: {
            vertical: 'salud',
          },
          ctaPolicy: null,
          aiPolicy: {
            wallet_account_id: 'wallet_tenant_001',
            kloser: {
              strategy: {
                id: 'inmuno_follow_up',
                version: '2.2',
                enabled: true,
                max_attempts: 4,
                cadence_minutes: [30, 1440],
              },
              compliance_policy: {
                has_whatsapp_opt_in: true,
                quiet_hours: {
                  start: '22:00',
                  end: '07:00',
                },
              },
              cta_policy: {
                type: 'checkout_link',
                required: true,
                shortener: 'kuruk',
                allowed_domains: ['retodetransformacion.com'],
              },
              message_policy: {
                template_id: 'inmuno_follow_up_v2',
                language: 'es-MX',
                variables: {
                  advisor: 'Ana',
                },
                max_length: 800,
                requires_personalization: true,
              },
            },
          },
        },
      ],
    },
    lead: {
      id: 'lead_test_001',
      status: 'captured',
      fullName: 'Carlos Mendoza',
      phone: '+52 55 1234 5678',
      email: 'carlos.mendoza@example.com',
      trafficLayer: 'PAID_WHEEL',
      originAdWheelId: 'wheel_test_001',
    },
    trafficLayer: 'PAID_WHEEL',
    originAdWheelId: 'wheel_test_001',
    sponsor: {
      id: 'sponsor_ana_001',
      displayName: 'Ana',
      email: 'ana@example.com',
      phone: '+52 55 7777 8888',
      messagingConnection: {
        externalInstanceId: 'drenvexman',
      },
    },
    funnelInstance: {
      code: 'inmuno-reset',
    },
    funnelPublication: {
      pathPrefix: '/inmuno',
    },
  };

  const buildPayload = (service: LeadDispatcherService, eventId: string) =>
    (
      service as unknown as {
        buildPayload: (
          assignment: typeof mockAssignment,
          nextEventId: string,
        ) => unknown;
      }
    ).buildPayload(mockAssignment, eventId);

  const buildResponse = (status: number, data: unknown) =>
    ({
      status,
      text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    }) as unknown as Response;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(fixedNow));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    delete process.env.N8N_DISPATCHER_WEBHOOK_URL;
    delete process.env.N8N_DISPATCHER_API_KEY;
    delete process.env.N8N_WEBHOOK_INTERNAL_BASE;
    jest.restoreAllMocks();
  });

  it('builds the exact lead context payload expected by the generic dispatcher', () => {
    const service = new LeadDispatcherService({} as never);
    const payload = buildPayload(service, 'evt_test_lead_context_seed');

    expect(payload).toEqual({
      event: 'LEAD_CONTEXT_UPSERT',
      event_id: 'evt_test_lead_context_seed',
      occurred_at: fixedNow,
      source: {
        app: 'leadflow',
        type: 'external_app',
        version: '1.0.0',
      },
      config_version:
        'ai-agent-config:tenant_config_custom_001:2026-03-29T10:00:00.000Z',
      runtime_config: expect.objectContaining({
        version: 'leadflow.ai-runtime-context.v1',
        base_prompt: 'Prompt custom de Inmuno para seguimiento.',
        routing: {
          provider: 'evolution',
          channel: 'whatsapp',
          instance_name: 'drenvexman',
          service_owner_key: 'lead-handler',
        },
        tenant: expect.objectContaining({
          id: 'team_test_001',
          name: 'Inmuno Team',
          code: 'inmuno-team',
          vertical_key: 'multinivel',
          brand_key: 'inmuno-team',
          business_model_type: 'multinivel',
        }),
        ai_agent: expect.objectContaining({
          base_prompt: 'Prompt custom de Inmuno para seguimiento.',
          route_contexts: {
            vertical: 'salud',
          },
        }),
      }),
      routing: {
        provider: 'evolution',
        channel: 'whatsapp',
        instance_name: 'drenvexman',
        number_id: '',
        remote_jid: '525512345678@s.whatsapp.net',
        service_hint: 'lead-handler',
      },
      lead: {
        external_id: 'lead_test_001',
        name: 'Carlos Mendoza',
        phone_e164: '525512345678',
        email: 'carlos.mendoza@example.com',
      },
      assignment: {
        owner_external_id: 'sponsor_ana_001',
        owner_name: 'Ana',
        owner_role: 'sponsor',
        assignment_id: 'assign_test_ana_001',
      },
      context: {
        lead_stage: 'new',
        lead_source: 'leadflow_wheel',
        vertical_hint: 'inmuno',
        traffic_layer: 'PAID_WHEEL',
        ad_wheel_id: 'wheel_test_001',
        is_owned_lead: false,
        campaign: {},
        signals: {
          detected_signal: 'lead_assigned',
          detected_objection: '',
        },
        memory: {
          summary: 'Lead asignado vía Leadflow Wheel',
          last_objection: '',
          next_action: 'Esperando primer mensaje del lead',
        },
        custom_fields: {
          traffic_layer: 'PAID_WHEEL',
          ad_wheel_id: 'wheel_test_001',
          is_owned_lead: false,
        },
        notes: '',
      },
    });
  });

  it('keeps the custom tenant basePrompt even when a default config is newer', () => {
    const service = new LeadDispatcherService({} as never);
    const assignment = {
      ...mockAssignment,
      team: {
        ...mockAssignment.team,
        aiAgentConfigs: [
          {
            id: 'tenant_config_default_new',
            basePrompt:
              'Actua como asesor de {{team_name}} para conversaciones de negocio multinivel. Personaliza la ayuda para {{name}}, prioriza claridad, seguimiento util y una invitacion natural a continuar por WhatsApp cuando aplique.',
            updatedAt: new Date('2026-05-20T00:00:00.000Z'),
            routeContexts: null,
            ctaPolicy: null,
            aiPolicy: null,
          },
          {
            ...mockAssignment.team.aiAgentConfigs[0],
            id: 'tenant_config_custom_old',
            basePrompt: 'Prompt custom antiguo que debe ganar.',
            updatedAt: new Date('2026-05-01T00:00:00.000Z'),
          },
        ],
      },
    };
    const payload = (
      service as unknown as {
        buildPayload: (
          assignment: any,
          nextEventId: string,
        ) => {
          config_version: string;
          runtime_config: {
            base_prompt: string;
            ai_agent: {
              base_prompt: string;
            };
          };
        };
      }
    ).buildPayload(assignment, 'evt_test_prompt_priority');

    expect(payload.config_version).toBe(
      'ai-agent-config:tenant_config_custom_old:2026-05-01T00:00:00.000Z',
    );
    expect(payload.runtime_config.base_prompt).toBe(
      'Prompt custom antiguo que debe ganar.',
    );
    expect(payload.runtime_config.ai_agent.base_prompt).toBe(
      'Prompt custom antiguo que debe ganar.',
    );
  });

  it('builds the Kloser mission payload v2.2 from tenant config and lead identity', () => {
    const service = new LeadDispatcherService({} as never);
    const dispatcherPayload = buildPayload(
      service,
      'evt_test_lead_context_seed',
    );
    const missionPayload = (
      service as unknown as {
        buildKloserMissionPayload: (
          assignment: typeof mockAssignment,
          payload: typeof dispatcherPayload,
        ) => unknown;
      }
    ).buildKloserMissionPayload(mockAssignment, dispatcherPayload);

    expect(missionPayload).toEqual({
      event_id: expect.stringMatching(/^lf_evt_/),
      event_type: 'mission.created',
      tenant_id: 'team_test_001',
      lead_id: 'lead_test_001',
      remote_jid: '525512345678@s.whatsapp.net',
      channel: 'whatsapp',
      idempotency_key: 'lf_strat_inmuno_follow_up_lead_lead_test_001',
      due_at: '2026-03-30T12:30:00.000Z',
      timezone: 'America/La_Paz',
      strategy: {
        id: 'inmuno_follow_up',
        version: '2.2',
        enabled: true,
        max_attempts: 4,
        cadence_minutes: [30, 1440],
      },
      compliance_policy: {
        has_whatsapp_opt_in: true,
        quiet_hours: {
          start: '22:00',
          end: '07:00',
        },
        is_opted_out: false,
        stage_allows_automation: true,
        human_takeover: false,
      },
      cta_policy: {
        type: 'checkout_link',
        required: true,
        shortener: 'none',
        allowed_domains: ['retodetransformacion.com'],
        base_url: null,
        requires_shortener: false,
      },
      message_policy: {
        template_id: 'inmuno_follow_up_v2',
        language: 'es-MX',
        variables: {
          advisor: 'Ana',
        },
        max_length: 800,
        requires_personalization: true,
        forbidden_claims: [],
      },
      context_snapshot: {
        lead_stage: 'captured',
        source: 'leadflow_core',
        custom_attributes: {
          vertical: 'salud',
          app_key: 'leadflow',
          wallet_account_id: 'wallet_tenant_001',
          push_name: 'Carlos Mendoza',
        },
      },
      observability: {
        source_system: 'leadflow',
        service_owner_key: 'lead-handler',
      },
    });
  });

  it('persists the Kloser master payload snapshots on lead context dispatch', async () => {
    process.env.N8N_DISPATCHER_WEBHOOK_URL =
      'https://n8n.example.com/webhook/channels/dispatcher/lead-context-upsert';

    const dispatchAssignment = {
      ...mockAssignment,
      workspaceId: 'workspace_test_001',
      sponsorId: 'sponsor_ana_001',
      leadId: 'lead_test_001',
      funnelInstanceId: 'funnel_instance_001',
      funnelPublicationId: 'funnel_publication_001',
      sponsor: {
        ...mockAssignment.sponsor,
        messagingConnection: {
          id: 'messaging_connection_001',
          externalInstanceId: 'drenvexman',
        },
      },
    };
    const prisma = {
      assignment: {
        findUnique: jest.fn().mockResolvedValue(dispatchAssignment),
      },
      automationDispatch: {
        create: jest.fn().mockResolvedValue({
          id: 'automation_dispatch_001',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const kloserApiClient = {
      createMission: jest.fn().mockResolvedValue(undefined),
    };
    const service = new LeadDispatcherService(
      prisma as never,
      kloserApiClient as never,
    );
    jest
      .spyOn(
        service as unknown as {
          postWithRetry: (
            input: unknown,
          ) => Promise<{ status: number; data: unknown }>;
        },
        'postWithRetry',
      )
      .mockResolvedValue({ status: 202, data: { accepted: true } });

    await expect(
      service.dispatchLeadContextUpsert({
        assignmentId: 'assign_test_ana_001',
      }),
    ).resolves.toEqual({
      status: 202,
      data: { accepted: true },
    });

    expect(prisma.automationDispatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace_test_001',
        teamId: 'team_test_001',
        sponsorId: 'sponsor_ana_001',
        leadId: 'lead_test_001',
        assignmentId: 'assign_test_ana_001',
        funnelInstanceId: 'funnel_instance_001',
        funnelPublicationId: 'funnel_publication_001',
        messagingConnectionId: 'messaging_connection_001',
        triggerType: 'LEAD_CONTEXT_UPSERT',
        status: 'pending',
        compliancePolicy: {
          has_whatsapp_opt_in: true,
          quiet_hours: {
            start: '22:00',
            end: '07:00',
          },
        },
        ctaPolicy: {
          type: 'checkout_link',
          required: true,
          shortener: 'kuruk',
          allowed_domains: ['retodetransformacion.com'],
        },
        contextSnapshot: {
          leadStage: 'captured',
          routeMode: 'leadflow_wheel',
          verticalFlow: 'salud',
          leadId: 'lead_test_001',
          assignmentId: 'assign_test_ana_001',
          trafficLayer: 'PAID_WHEEL',
          capturedAt: fixedNow,
        },
        masterPayload: expect.objectContaining({
          version: 'leadflow.kloser-master-payload.v1',
          config_version:
            'ai-agent-config:tenant_config_custom_001:2026-03-29T10:00:00.000Z',
          tenantId: 'team_test_001',
          leadId: 'lead_test_001',
          assignmentId: 'assign_test_ana_001',
          runtime_config: expect.objectContaining({
            base_prompt: 'Prompt custom de Inmuno para seguimiento.',
            ai_agent: expect.objectContaining({
              base_prompt: 'Prompt custom de Inmuno para seguimiento.',
            }),
          }),
          compliancePolicy: {
            has_whatsapp_opt_in: true,
            quiet_hours: {
              start: '22:00',
              end: '07:00',
            },
          },
          ctaPolicy: {
            type: 'checkout_link',
            required: true,
            shortener: 'kuruk',
            allowed_domains: ['retodetransformacion.com'],
          },
        }),
      }),
    });
    expect(prisma.automationDispatch.update).toHaveBeenCalledWith({
      where: {
        id: 'automation_dispatch_001',
      },
      data: expect.objectContaining({
        status: 'dispatched',
        responseSnapshot: {
          accepted: true,
        },
        responseStatusCode: 202,
        dispatchedAt: expect.any(Date),
        completedAt: expect.any(Date),
      }),
    });
    expect(kloserApiClient.createMission).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'team_test_001',
        lead_id: 'lead_test_001',
      }),
    );
  });

  it('sends the dispatcher request with the expected url, headers and body', async () => {
    process.env.N8N_DISPATCHER_WEBHOOK_URL =
      'https://n8n.example.com/webhook/channels/dispatcher/lead-context-upsert';
    process.env.N8N_DISPATCHER_API_KEY = 'dispatcher-secret';

    const service = new LeadDispatcherService({} as never);
    const payload = buildPayload(service, 'evt_test_network_request');
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(buildResponse(202, { accepted: true }));

    const result = await (
      service as unknown as {
        postWithRetry: (
          input: unknown,
        ) => Promise<{ status: number; data: unknown }>;
      }
    ).postWithRetry(payload);

    expect(result).toEqual({
      status: 202,
      data: { accepted: true },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [requestUrl, requestInit] = fetchSpy.mock.calls[0] ?? [];

    expect(requestUrl).toBe(
      'http://n8n_v2_webhook:5678/webhook/channels/dispatcher/lead-context-upsert',
    );
    expect(requestInit).toBeDefined();
    expect(requestInit?.method).toBe('POST');
    expect(requestInit?.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-dispatcher-api-key': 'dispatcher-secret',
    });
    expect(requestInit?.body).toBe(JSON.stringify(payload));
  });

  it('retries once after a retryable 500 response and then succeeds', async () => {
    process.env.N8N_DISPATCHER_WEBHOOK_URL =
      'https://n8n.example.com/webhook/channels/dispatcher/lead-context-upsert';
    process.env.N8N_DISPATCHER_API_KEY = 'dispatcher-secret';

    const service = new LeadDispatcherService({} as never);
    const payload = buildPayload(service, 'evt_test_retry_path');
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(buildResponse(500, { code: 'TEMPORARY_FAILURE' }))
      .mockResolvedValueOnce(buildResponse(202, { accepted: true }));

    const promise = (
      service as unknown as {
        postWithRetry: (
          input: unknown,
        ) => Promise<{ status: number; data: unknown }>;
      }
    ).postWithRetry(payload);

    await Promise.resolve();

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(2_000);

    const result = await promise;

    expect(result).toEqual({
      status: 202,
      data: { accepted: true },
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('sanitizes dispatcher urls to avoid double slashes in the webhook path', async () => {
    process.env.N8N_DISPATCHER_WEBHOOK_URL =
      'https://n8n.example.com/webhook/channels/dispatcher/lead-context-upsert/';
    process.env.N8N_WEBHOOK_INTERNAL_BASE =
      'http://n8n_v2_webhook:5678/webhook//';

    const service = new LeadDispatcherService({} as never);
    const payload = buildPayload(service, 'evt_test_sanitized_dispatcher_url');
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(buildResponse(202, { accepted: true }));

    await (
      service as unknown as {
        postWithRetry: (
          input: unknown,
        ) => Promise<{ status: number; data: unknown }>;
      }
    ).postWithRetry(payload);

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://n8n_v2_webhook:5678/webhook/channels/dispatcher/lead-context-upsert',
      expect.any(Object),
    );
  });
});
