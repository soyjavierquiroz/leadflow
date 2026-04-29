import { AiConfigService } from './ai-config.service';

describe('AiConfigService', () => {
  const buildService = () => {
    const prisma = {
      channelInstance: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      aiAgentConfig: {
        findFirst: jest.fn(),
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

    return {
      prisma,
      walletEngineService,
      service: new AiConfigService(
        prisma as never,
        walletEngineService as never,
      ),
    };
  };

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
    prisma.aiAgentConfig.findFirst
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
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
      });
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
        ai_agent: {
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
        },
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
    prisma.aiAgentConfig.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
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
      });
    walletEngineService.isConfigured.mockReturnValue(false);

    await expect(service.resolveRuntimeContext('drenvexman')).resolves.toEqual(
      expect.objectContaining({
        ai_agent: {
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
        },
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

  it('builds a development runtime context for default-constructor when the user has no channel instance yet', async () => {
    const originalGatewayToken = process.env.GATEWAY_AUTH_TOKEN;
    const originalGatewayBaseUrl = process.env.IA_GATEWAY_BASE_URL;

    process.env.GATEWAY_AUTH_TOKEN = 'gateway-token';
    process.env.IA_GATEWAY_BASE_URL = 'http://ia_gateway:3000';

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
      prisma.aiAgentConfig.findFirst.mockResolvedValue({
        id: 'tenant-config-1',
        basePrompt: 'Usa el contexto de {{team_name}} para cablear el funnel.',
        routeContexts: {
          offer: {
            mode: 'team-default',
          },
        },
        ctaPolicy: null,
        aiPolicy: null,
      });
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
        'http://ia_gateway:3000/v1/session/init',
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
    process.env.IA_GATEWAY_BASE_URL = 'http://ia_gateway:3000';

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
      prisma.aiAgentConfig.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
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
        });
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
        'http://ia_gateway:3000/v1/session/init',
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
    process.env.IA_GATEWAY_BASE_URL = 'http://ia_gateway:3000';

    const previousFetch = global.fetch;
    const { prisma, walletEngineService, service } = buildService();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest
        .fn()
        .mockResolvedValue(JSON.stringify({ ok: true, execution_id: 'exec-1' })),
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
      prisma.aiAgentConfig.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
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
        });
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
        'http://ia_gateway:3000/v1/execute',
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
    process.env.IA_GATEWAY_BASE_URL = 'http://ia_gateway:3000';

    const previousFetch = global.fetch;
    const { prisma, walletEngineService, service } = buildService();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue(JSON.stringify({ ok: true, closed: true })),
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
      prisma.aiAgentConfig.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'tenant-config-1',
          basePrompt: 'Hola {{name}}',
          routeContexts: null,
          ctaPolicy: null,
          aiPolicy: null,
        });
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
        'http://ia_gateway:3000/v1/session/close',
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
});
