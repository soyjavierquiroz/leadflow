import { AiConfigService } from './ai-config.service';

describe('AiConfigService', () => {
  const swarmGatewayBaseUrl = 'http://ia-gateway_ia-gateway:3000';

  const buildService = () => {
    const prisma = {
      channelInstance: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      messagingConnection: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      aiAgentConfig: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      sponsor: {
        findFirst: jest.fn(),
      },
      team: {
        findUnique: jest.fn(),
      },
    };
    const walletEngineService = {
      isConfigured: jest.fn(),
      upsertSponsorAccount: jest.fn(),
      getSponsorKredits: jest.fn(),
    };
    const tenantConfigCacheService = {
      purgeTenantConfig: jest.fn(),
    };

    return {
      prisma,
      walletEngineService,
      tenantConfigCacheService,
      service: new AiConfigService(
        prisma as never,
        walletEngineService as never,
        tenantConfigCacheService as never,
      ),
    };
  };

  it('creates tenant default AI config with multinivel runtime metadata', async () => {
    const { prisma, service } = buildService();

    prisma.aiAgentConfig.findMany.mockResolvedValue([]);
    prisma.aiAgentConfig.create.mockResolvedValue({
      id: 'tenant-config-1',
    });

    await service.ensureTenantDefaultConfig({
      tenantId: 'team-1',
      brandKey: 'immunotec',
    });

    expect(prisma.aiAgentConfig.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'team-1',
        memberId: null,
        isActive: true,
        aiPolicy: expect.objectContaining({
          vertical_key: 'multinivel',
          brand_key: 'immunotec',
          business_model_type: 'multinivel',
          kloser: expect.objectContaining({
            strategy: expect.objectContaining({
              version: '2.2',
              enabled: true,
            }),
          }),
        }),
      }),
    });
  });

  it('repairs unknown tenant runtime metadata without clobbering the config', async () => {
    const { prisma, service } = buildService();

    prisma.aiAgentConfig.findMany.mockResolvedValue([
      {
        id: 'tenant-config-1',
        basePrompt: 'Prompt equipo',
        aiPolicy: {
          vertical_key: 'unknown',
          brand_key: 'unknown',
          business_model_type: 'unknown',
          model: 'gpt-4o-mini',
        },
      },
    ]);
    prisma.aiAgentConfig.update.mockResolvedValue({
      id: 'tenant-config-1',
    });

    await service.ensureTenantDefaultConfig({
      tenantId: 'team-1',
      brandKey: 'immunotec',
    });

    expect(prisma.aiAgentConfig.update).toHaveBeenCalledWith({
      where: {
        id: 'tenant-config-1',
      },
      data: {
        aiPolicy: expect.objectContaining({
          vertical_key: 'multinivel',
          brand_key: 'immunotec',
          business_model_type: 'multinivel',
          model: 'gpt-4o-mini',
          kloser: expect.objectContaining({
            strategy: expect.objectContaining({
              version: '2.2',
              enabled: true,
            }),
          }),
        }),
        isActive: true,
      },
    });
  });

  it('rejects Kloser writes on personal AI config updates', async () => {
    const { prisma, service } = buildService();

    prisma.sponsor.findFirst.mockResolvedValue({
      id: 'sponsor-1',
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      displayName: 'Ana Sponsor',
      team: {
        id: 'team-1',
        name: 'Freddy Team',
        code: 'freddy',
      },
    });

    await expect(
      service.updateMemberSettings(
        {
          workspaceId: 'workspace-1',
          teamId: 'team-1',
          sponsorId: 'sponsor-1',
        },
        {
          basePrompt: 'Prompt personal',
          aiPolicy: {
            kloser: {
              strategy: {
                cadence_minutes: [60],
              },
            },
          },
        },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'AI_CONFIG_KLOSER_PERSONAL_FORBIDDEN',
      }),
    });
    expect(prisma.aiAgentConfig.upsert).not.toHaveBeenCalled();
  });

  it('merges Kloser updates into the tenant AI config with memberId null', async () => {
    const { prisma, service, tenantConfigCacheService } = buildService();
    const updatedAt = new Date('2026-05-17T00:00:00.000Z');

    prisma.sponsor.findFirst.mockResolvedValue({
      id: 'sponsor-1',
      workspaceId: 'workspace-1',
      teamId: 'team-1',
      displayName: 'Ana Sponsor',
      team: {
        id: 'team-1',
        name: 'Freddy Team',
        code: 'freddy',
      },
    });
    prisma.aiAgentConfig.findMany
      .mockResolvedValueOnce([
        {
          id: 'tenant-config-1',
          tenantId: 'team-1',
          memberId: null,
          basePrompt: 'Prompt equipo',
          routeContexts: null,
          ctaPolicy: null,
          aiPolicy: {
            model: 'gpt-4o-mini',
            kloser: {
              strategy: {
                cadence_minutes: [1440],
              },
            },
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'tenant-config-1',
          tenantId: 'team-1',
          memberId: null,
          basePrompt: 'Prompt equipo',
          routeContexts: null,
          ctaPolicy: null,
          aiPolicy: {
            model: 'gpt-4o-mini',
            kloser: {
              strategy: {
                cadence_minutes: [60, 240],
              },
            },
          },
          updatedAt,
        },
      ]);
    prisma.aiAgentConfig.update.mockResolvedValue({
      id: 'tenant-config-1',
    });

    const result = await service.updateTeamSettings(
      {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        sponsorId: 'sponsor-1',
      },
      {
        basePrompt: 'Prompt equipo actualizado',
        aiPolicy: {
          kloser: {
            strategy: {
              cadence_minutes: [60, 240],
            },
          },
        },
      },
    );

    expect(prisma.aiAgentConfig.update).toHaveBeenCalledWith({
      where: {
        id: 'tenant-config-1',
      },
      data: expect.objectContaining({
        isActive: true,
        basePrompt: 'Prompt equipo actualizado',
        aiPolicy: expect.objectContaining({
          model: 'gpt-4o-mini',
          kloser: expect.objectContaining({
            strategy: expect.objectContaining({
              cadence_minutes: [60, 240],
            }),
          }),
        }),
      }),
    });
    expect(tenantConfigCacheService.purgeTenantConfig).toHaveBeenCalledWith(
      'team-1',
    );
    expect(result).toEqual(
      expect.objectContaining({
        configId: 'tenant-config-1',
        resolution: expect.objectContaining({
          strategy: 'tenant_default',
          tenantConfigId: 'tenant-config-1',
          memberConfigId: null,
        }),
        kloser: expect.objectContaining({
          strategy: expect.objectContaining({
            cadence_minutes: [60, 240],
          }),
        }),
      }),
    );
  });

  it('prefers member overrides, merges JSON policies, replaces placeholders and enriches the wallet context', async () => {
    const { prisma, walletEngineService, service } = buildService();

    prisma.channelInstance.findUnique.mockResolvedValue({
      id: 'channel-1',
      instanceName: 'drenvexman',
      tenantId: 'team-1',
      memberId: 'sponsor-1',
      provider: 'evolution',
      tenant: {
        id: 'team-1',
        name: 'Freddy Team',
        code: 'freddy',
      },
      member: {
        id: 'sponsor-1',
        teamId: 'team-1',
        displayName: 'Ana Sponsor',
        email: 'ana@example.com',
        phone: '+52 55 1234 5678',
        publicSlug: 'ana-sponsor',
      },
    });
    prisma.aiAgentConfig.findFirst.mockResolvedValueOnce({
      id: 'member-config-1',
      basePrompt:
        'Habla como {{name}} desde {{team_name}} y dirige a {{whatsapp_link}} cuando sea correcto.',
      routeContexts: {
        offer: {
          mode: 'member-offer',
        },
      },
      ctaPolicy: {
        close: {
          mode: 'soft',
        },
      },
      aiPolicy: {
        model: 'gpt-4o-mini',
        temperature: 0.4,
      },
    });
    prisma.aiAgentConfig.findMany.mockResolvedValueOnce([
      {
        id: 'tenant-config-1',
        basePrompt: 'Base team prompt.',
        routeContexts: {
          risk: {
            enabled: true,
          },
          offer: {
            mode: 'tenant-offer',
            fallback: true,
          },
        },
        ctaPolicy: {
          close: {
            mode: 'firm',
            book_call: true,
          },
        },
        aiPolicy: {
          model: 'gpt-5-mini',
          top_p: 0.9,
        },
      },
    ]);
    walletEngineService.isConfigured.mockReturnValue(true);
    walletEngineService.upsertSponsorAccount.mockResolvedValue({
      accountId: 'wallet-1',
    });
    walletEngineService.getSponsorKredits.mockResolvedValue('5000000');

    await expect(service.resolveRuntimeContext('drenvexman')).resolves.toEqual(
      expect.objectContaining({
        routing: expect.objectContaining({
          instance_name: 'drenvexman',
        }),
        member: expect.objectContaining({
          whatsapp_link: 'https://wa.me/525512345678',
        }),
        placeholders: {
          name: 'Ana Sponsor',
          team_name: 'Freddy Team',
          whatsapp_link: 'https://wa.me/525512345678',
        },
        wallet: {
          account_id: 'wallet-1',
          balance: '5000000',
          status: 'resolved',
          reason: null,
        },
        ai_agent: expect.objectContaining({
          basePrompt:
            'Base team prompt.\n\nHabla como Ana Sponsor desde Freddy Team y dirige a https://wa.me/525512345678 cuando sea correcto.',
          base_prompt:
            'Base team prompt.\n\nHabla como Ana Sponsor desde Freddy Team y dirige a https://wa.me/525512345678 cuando sea correcto.',
          route_contexts: {
            risk: {
              enabled: true,
            },
            offer: {
              mode: 'member-offer',
              fallback: true,
            },
          },
          cta_policy: {
            close: {
              mode: 'soft',
              book_call: true,
            },
          },
          ai_policy: {
            model: 'gpt-4o-mini',
            top_p: 0.9,
            temperature: 0.4,
          },
        }),
        resolution: {
          strategy: 'member_override',
          tenant_config_id: 'tenant-config-1',
          member_config_id: 'member-config-1',
        },
      }),
    );
  });

  it('falls back to the tenant configuration when the member override does not exist', async () => {
    const { prisma, walletEngineService, service } = buildService();

    prisma.channelInstance.findUnique.mockResolvedValue({
      id: 'channel-1',
      instanceName: 'drenvexman',
      tenantId: 'team-1',
      memberId: 'sponsor-1',
      provider: 'evolution',
      tenant: {
        id: 'team-1',
        name: 'Freddy Team',
        code: 'freddy',
      },
      member: {
        id: 'sponsor-1',
        teamId: 'team-1',
        displayName: 'Ana Sponsor',
        email: null,
        phone: null,
        publicSlug: null,
      },
    });
    prisma.aiAgentConfig.findFirst.mockResolvedValueOnce(null);
    prisma.aiAgentConfig.findMany.mockResolvedValueOnce([
      {
        id: 'tenant-config-1',
        basePrompt: 'Hola {{name}}',
        routeContexts: {
          business: {
            team_default: true,
          },
        },
        ctaPolicy: {
          close: {
            mode: 'team',
          },
        },
        aiPolicy: {
          model: 'gpt-4o-mini',
        },
      },
    ]);
    walletEngineService.isConfigured.mockReturnValue(false);

    await expect(service.resolveRuntimeContext('drenvexman')).resolves.toEqual(
      expect.objectContaining({
        ai_agent: expect.objectContaining({
          basePrompt: 'Hola Ana Sponsor',
          base_prompt: 'Hola Ana Sponsor',
          route_contexts: {
            business: {
              team_default: true,
            },
          },
          cta_policy: {
            close: {
              mode: 'team',
            },
          },
          ai_policy: {
            model: 'gpt-4o-mini',
          },
        }),
        wallet: {
          account_id: null,
          balance: null,
          status: 'unavailable',
          reason: 'Wallet engine is not configured for this environment.',
        },
        resolution: {
          strategy: 'tenant_default',
          tenant_config_id: 'tenant-config-1',
          member_config_id: null,
        },
      }),
    );
  });

  it('prioritizes a custom tenant basePrompt over the default tenant template', async () => {
    const { prisma, walletEngineService, service } = buildService();

    prisma.channelInstance.findUnique.mockResolvedValue({
      id: 'channel-1',
      instanceName: 'drenvexman',
      tenantId: 'team-1',
      memberId: 'sponsor-1',
      provider: 'evolution',
      tenant: {
        id: 'team-1',
        name: 'Freddy Team',
        code: 'freddy',
      },
      member: {
        id: 'sponsor-1',
        teamId: 'team-1',
        displayName: 'Ana Sponsor',
        email: null,
        phone: null,
        publicSlug: null,
      },
    });
    prisma.aiAgentConfig.findFirst.mockResolvedValueOnce(null);
    prisma.aiAgentConfig.findMany.mockResolvedValueOnce([
      {
        id: 'tenant-config-default',
        basePrompt:
          'Actua como asesor de {{team_name}} para conversaciones de negocio multinivel. Personaliza la ayuda para {{name}}, prioriza claridad, seguimiento util y una invitacion natural a continuar por WhatsApp cuando aplique.',
        routeContexts: null,
        ctaPolicy: null,
        aiPolicy: null,
        updatedAt: new Date('2026-05-20T00:00:00.000Z'),
      },
      {
        id: 'tenant-config-custom',
        basePrompt: 'Prompt real del tenant para {{team_name}}',
        routeContexts: null,
        ctaPolicy: null,
        aiPolicy: null,
        updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    ]);
    walletEngineService.isConfigured.mockReturnValue(false);

    await expect(service.resolveRuntimeContext('drenvexman')).resolves.toEqual(
      expect.objectContaining({
        ai_agent: expect.objectContaining({
          base_prompt: 'Prompt real del tenant para Freddy Team',
        }),
        resolution: expect.objectContaining({
          tenant_config_id: 'tenant-config-custom',
        }),
      }),
    );
  });

  it('resolves n8n runtime context by tenant_id and WhatsApp instance instead of a stale ChannelInstance', async () => {
    const { prisma, walletEngineService, service } = buildService();

    prisma.messagingConnection.findFirst.mockResolvedValue({
      id: 'connection-1',
      externalInstanceId: 'drenvexman',
      provider: 'EVOLUTION',
      teamId: 'team-custom',
      sponsorId: 'sponsor-custom',
      team: {
        id: 'team-custom',
        name: 'Tenant Custom',
        code: 'tenant-custom',
      },
      sponsor: {
        id: 'sponsor-custom',
        teamId: 'team-custom',
        displayName: 'Laura Sponsor',
        email: 'laura@example.com',
        phone: '+52 55 3333 4444',
        publicSlug: 'laura-sponsor',
      },
    });
    prisma.aiAgentConfig.findFirst.mockResolvedValueOnce({
      id: 'tenant-config-custom-latest',
      basePrompt: 'Prompt custom HTTP para {{team_name}} y {{name}}',
      routeContexts: null,
      ctaPolicy: null,
      aiPolicy: null,
      updatedAt: new Date('2026-05-21T00:00:00.000Z'),
    });
    walletEngineService.isConfigured.mockReturnValue(false);

    await expect(
      service.resolveRuntimeContext({
        instanceName: 'drenvexman',
        tenantId: 'team-custom',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        config_version:
          'ai-agent-config:tenant-config-custom-latest:2026-05-21T00:00:00.000Z',
        basePrompt: 'Prompt custom HTTP para Tenant Custom y Laura Sponsor',
        base_prompt: 'Prompt custom HTTP para Tenant Custom y Laura Sponsor',
        routing: expect.objectContaining({
          provider: 'evolution',
          instance_name: 'drenvexman',
        }),
        tenant: expect.objectContaining({
          id: 'team-custom',
        }),
        ai_agent: expect.objectContaining({
          base_prompt: 'Prompt custom HTTP para Tenant Custom y Laura Sponsor',
        }),
        resolution: expect.objectContaining({
          tenant_config_id: 'tenant-config-custom-latest',
        }),
      }),
    );
    expect(prisma.aiAgentConfig.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'team-custom',
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    expect(prisma.aiAgentConfig.findMany).not.toHaveBeenCalled();
    expect(prisma.messagingConnection.findFirst).toHaveBeenCalledWith({
      where: {
        externalInstanceId: 'drenvexman',
        teamId: 'team-custom',
      },
      include: {
        team: true,
        sponsor: true,
      },
    });
    expect(prisma.channelInstance.findFirst).not.toHaveBeenCalled();
  });

  it('builds a development runtime context for default-constructor when the user has no channel instance yet', async () => {
    const originalGatewayToken = process.env.GATEWAY_AUTH_TOKEN;
    const originalGatewayBaseUrl = process.env.IA_GATEWAY_BASE_URL;

    process.env.GATEWAY_AUTH_TOKEN = 'gateway-token';
    process.env.IA_GATEWAY_BASE_URL = swarmGatewayBaseUrl;

    const previousFetch = global.fetch;
    const { prisma, walletEngineService, service } = buildService();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ ok: true, session_ready: true })),
    });

    try {
      global.fetch = fetchMock as never;

      prisma.channelInstance.findUnique.mockResolvedValue(null);
      prisma.team.findUnique.mockResolvedValue({
        id: 'team-1',
        name: 'Freddy Team',
        code: 'freddy',
      });
      prisma.aiAgentConfig.findMany.mockResolvedValue([
        {
          id: 'tenant-config-1',
          basePrompt:
            'Usa el contexto de {{team_name}} para cablear el funnel.',
          routeContexts: {
            offer: {
              mode: 'team-default',
            },
          },
          ctaPolicy: null,
          aiPolicy: null,
        },
      ]);
      walletEngineService.isConfigured.mockReturnValue(false);

      await expect(
        service.initOrchestrationSessionForUser(
          {
            id: 'user-1',
            fullName: 'Super Admin',
            email: 'admin@example.com',
            role: 'SUPER_ADMIN',
            workspaceId: 'workspace-1',
            teamId: null,
            sponsorId: null,
            homePath: '/admin',
            workspace: null,
            team: null,
            sponsor: null,
          } as never,
          {
            instanceName: 'default-constructor',
            teamId: 'team-1',
            funnelId: 'funnel-1',
            funnelContext: {
              blocks: [{ type: 'hook_and_promise' }],
            },
          },
        ),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 200,
          sessionId: 'default-constructor-funnel-1',
          runtimeContext: expect.objectContaining({
            routing: expect.objectContaining({
              instance_name: 'default-constructor',
              provider: 'leadflow_builder',
            }),
            tenant: expect.objectContaining({
              id: 'team-1',
            }),
            resolution: expect.objectContaining({
              strategy: 'tenant_default',
            }),
          }),
        }),
      );

      expect(fetchMock).toHaveBeenCalledWith(
        `${swarmGatewayBaseUrl}/v1/session/init`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining(
            '"sessionId":"default-constructor-funnel-1"',
          ),
        }),
      );
    } finally {
      global.fetch = previousFetch;
      process.env.GATEWAY_AUTH_TOKEN = originalGatewayToken;
      process.env.IA_GATEWAY_BASE_URL = originalGatewayBaseUrl;
    }
  });

  it('initializes orchestration sessions against the IA Gateway with a synthesized system prompt', async () => {
    const originalGatewayToken = process.env.GATEWAY_AUTH_TOKEN;
    const originalGatewayBaseUrl = process.env.IA_GATEWAY_BASE_URL;

    process.env.GATEWAY_AUTH_TOKEN = 'gateway-token';
    process.env.IA_GATEWAY_BASE_URL = swarmGatewayBaseUrl;

    const previousFetch = global.fetch;
    const { prisma, walletEngineService, service } = buildService();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ ok: true, session_ready: true })),
    });

    try {
      global.fetch = fetchMock as never;

      prisma.channelInstance.findUnique.mockResolvedValue({
        id: 'channel-1',
        instanceName: 'drenvexman',
        tenantId: 'team-1',
        memberId: 'sponsor-1',
        provider: 'evolution',
        tenant: {
          id: 'team-1',
          name: 'Freddy Team',
          code: 'freddy',
        },
        member: {
          id: 'sponsor-1',
          teamId: 'team-1',
          displayName: 'Ana Sponsor',
          email: 'ana@example.com',
          phone: '+52 55 1234 5678',
          publicSlug: 'ana-sponsor',
        },
      });
      prisma.aiAgentConfig.findFirst.mockResolvedValueOnce(null);
      prisma.aiAgentConfig.findMany.mockResolvedValueOnce([
        {
          id: 'tenant-config-1',
          basePrompt: 'Hola {{name}}',
          routeContexts: {
            business: {
              team_default: true,
            },
          },
          ctaPolicy: {
            close: {
              mode: 'team',
            },
          },
          aiPolicy: {
            model: 'gpt-4o-mini',
          },
        },
      ]);
      walletEngineService.isConfigured.mockReturnValue(false);

      await expect(
        service.initOrchestrationSession({
          instanceName: 'drenvexman',
          funnelId: 'funnel-1',
          funnelContext: {
            blocks: [{ type: 'hero' }],
          },
          metadata: {
            source: 'unit-test',
          },
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 200,
          sessionId: 'drenvexman-funnel-1',
          data: {
            ok: true,
            session_ready: true,
          },
          runtimeContext: expect.objectContaining({
            tenant: expect.objectContaining({
              id: 'team-1',
            }),
          }),
        }),
      );

      expect(fetchMock).toHaveBeenCalledWith(
        `${swarmGatewayBaseUrl}/v1/session/init`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer gateway-token',
            'x-service-key': 'lead-handler',
          }),
          body: expect.stringContaining('"sessionId":"drenvexman-funnel-1"'),
        }),
      );
    } finally {
      global.fetch = previousFetch;
      process.env.GATEWAY_AUTH_TOKEN = originalGatewayToken;
      process.env.IA_GATEWAY_BASE_URL = originalGatewayBaseUrl;
    }
  });

  it('executes orchestrations by sending only sessionId and prompt to the IA Gateway', async () => {
    const originalGatewayToken = process.env.GATEWAY_AUTH_TOKEN;
    const originalGatewayBaseUrl = process.env.IA_GATEWAY_BASE_URL;

    process.env.GATEWAY_AUTH_TOKEN = 'gateway-token';
    process.env.IA_GATEWAY_BASE_URL = swarmGatewayBaseUrl;

    const previousFetch = global.fetch;
    const { prisma, walletEngineService, service } = buildService();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest
        .fn()
        .mockResolvedValue(
          JSON.stringify({ ok: true, execution_id: 'exec-1' }),
        ),
    });

    try {
      global.fetch = fetchMock as never;

      prisma.channelInstance.findUnique.mockResolvedValue({
        id: 'channel-1',
        instanceName: 'drenvexman',
        tenantId: 'team-1',
        memberId: 'sponsor-1',
        provider: 'evolution',
        tenant: {
          id: 'team-1',
          name: 'Freddy Team',
          code: 'freddy',
        },
        member: {
          id: 'sponsor-1',
          teamId: 'team-1',
          displayName: 'Ana Sponsor',
          email: 'ana@example.com',
          phone: '+52 55 1234 5678',
          publicSlug: 'ana-sponsor',
        },
      });
      prisma.aiAgentConfig.findFirst.mockResolvedValueOnce(null);
      prisma.aiAgentConfig.findMany.mockResolvedValueOnce([
        {
          id: 'tenant-config-1',
          basePrompt: 'Hola {{name}}',
          routeContexts: {
            business: {
              team_default: true,
            },
          },
          ctaPolicy: {
            close: {
              mode: 'team',
            },
          },
          aiPolicy: {
            model: 'gpt-4o-mini',
          },
        },
      ]);
      walletEngineService.isConfigured.mockReturnValue(false);

      await expect(
        service.executeOrchestration({
          instanceName: 'drenvexman',
          sessionId: 'drenvexman-funnel-1',
          intent: 'Optimiza el wiring del funnel.',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 200,
          sessionId: 'drenvexman-funnel-1',
          data: {
            ok: true,
            execution_id: 'exec-1',
          },
        }),
      );

      expect(fetchMock).toHaveBeenCalledWith(
        `${swarmGatewayBaseUrl}/v1/execute`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            sessionId: 'drenvexman-funnel-1',
            prompt: 'Optimiza el wiring del funnel.',
          }),
        }),
      );
    } finally {
      global.fetch = previousFetch;
      process.env.GATEWAY_AUTH_TOKEN = originalGatewayToken;
      process.env.IA_GATEWAY_BASE_URL = originalGatewayBaseUrl;
    }
  });

  it('closes orchestration sessions against the IA Gateway', async () => {
    const originalGatewayToken = process.env.GATEWAY_AUTH_TOKEN;
    const originalGatewayBaseUrl = process.env.IA_GATEWAY_BASE_URL;

    process.env.GATEWAY_AUTH_TOKEN = 'gateway-token';
    process.env.IA_GATEWAY_BASE_URL = swarmGatewayBaseUrl;

    const previousFetch = global.fetch;
    const { prisma, walletEngineService, service } = buildService();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ ok: true, closed: true })),
    });

    try {
      global.fetch = fetchMock as never;

      prisma.channelInstance.findUnique.mockResolvedValue({
        id: 'channel-1',
        instanceName: 'drenvexman',
        tenantId: 'team-1',
        memberId: 'sponsor-1',
        provider: 'evolution',
        tenant: {
          id: 'team-1',
          name: 'Freddy Team',
          code: 'freddy',
        },
        member: {
          id: 'sponsor-1',
          teamId: 'team-1',
          displayName: 'Ana Sponsor',
          email: 'ana@example.com',
          phone: '+52 55 1234 5678',
          publicSlug: 'ana-sponsor',
        },
      });
      prisma.aiAgentConfig.findFirst.mockResolvedValueOnce(null);
      prisma.aiAgentConfig.findMany.mockResolvedValueOnce([
        {
          id: 'tenant-config-1',
          basePrompt: 'Hola {{name}}',
          routeContexts: null,
          ctaPolicy: null,
          aiPolicy: null,
        },
      ]);
      walletEngineService.isConfigured.mockReturnValue(false);

      await expect(
        service.closeOrchestrationSession({
          instanceName: 'drenvexman',
          sessionId: 'drenvexman-funnel-1',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 200,
          sessionId: 'drenvexman-funnel-1',
          data: {
            ok: true,
            closed: true,
          },
        }),
      );

      expect(fetchMock).toHaveBeenCalledWith(
        `${swarmGatewayBaseUrl}/v1/session/close`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            sessionId: 'drenvexman-funnel-1',
          }),
        }),
      );
    } finally {
      global.fetch = previousFetch;
      process.env.GATEWAY_AUTH_TOKEN = originalGatewayToken;
      process.env.IA_GATEWAY_BASE_URL = originalGatewayBaseUrl;
    }
  });

  it('retries session init against the swarm service name when DNS lookup fails with ENOTFOUND', async () => {
    const originalGatewayToken = process.env.GATEWAY_AUTH_TOKEN;
    const originalGatewayBaseUrl = process.env.IA_GATEWAY_BASE_URL;

    process.env.GATEWAY_AUTH_TOKEN = 'gateway-token';
    process.env.IA_GATEWAY_BASE_URL = 'http://ia_gateway:3000';

    const previousFetch = global.fetch;
    const { prisma, walletEngineService, service } = buildService();
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new TypeError('fetch failed'), {
          cause: { code: 'ENOTFOUND' },
        }),
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: jest
          .fn()
          .mockResolvedValue(JSON.stringify({ ok: true, session_ready: true })),
      });

    try {
      global.fetch = fetchMock as never;

      prisma.channelInstance.findUnique.mockResolvedValue({
        id: 'channel-1',
        instanceName: 'drenvexman',
        tenantId: 'team-1',
        memberId: 'sponsor-1',
        provider: 'evolution',
        tenant: {
          id: 'team-1',
          name: 'Freddy Team',
          code: 'freddy',
        },
        member: {
          id: 'sponsor-1',
          teamId: 'team-1',
          displayName: 'Ana Sponsor',
          email: 'ana@example.com',
          phone: '+52 55 1234 5678',
          publicSlug: 'ana-sponsor',
        },
      });
      prisma.aiAgentConfig.findFirst.mockResolvedValueOnce(null);
      prisma.aiAgentConfig.findMany.mockResolvedValueOnce([
        {
          id: 'tenant-config-1',
          basePrompt: 'Hola {{name}}',
          routeContexts: null,
          ctaPolicy: null,
          aiPolicy: null,
        },
      ]);
      walletEngineService.isConfigured.mockReturnValue(false);

      await expect(
        service.initOrchestrationSession({
          instanceName: 'drenvexman',
          funnelId: 'funnel-1',
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: 200,
          sessionId: 'drenvexman-funnel-1',
          data: {
            ok: true,
            session_ready: true,
          },
        }),
      );

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        'http://ia_gateway:3000/v1/session/init',
        expect.any(Object),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        `${swarmGatewayBaseUrl}/v1/session/init`,
        expect.any(Object),
      );
    } finally {
      global.fetch = previousFetch;
      process.env.GATEWAY_AUTH_TOKEN = originalGatewayToken;
      process.env.IA_GATEWAY_BASE_URL = originalGatewayBaseUrl;
    }
  });
});
