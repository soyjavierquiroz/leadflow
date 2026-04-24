import { BadRequestException } from '@nestjs/common';
import { AiConfigController } from './ai-config.controller';

describe('AiConfigController', () => {
  const buildController = () => {
    const aiConfigService = {
      resolveRuntimeContext: jest.fn(),
    };

    return {
      aiConfigService,
      controller: new AiConfigController(aiConfigService as never),
    };
  };

  it('maps the resolved runtime context to the resolve-full contract expected by n8n', async () => {
    const { controller, aiConfigService } = buildController();

    aiConfigService.resolveRuntimeContext.mockResolvedValue({
      version: 'leadflow.ai-runtime-context.v1',
      routing: {
        provider: 'evolution',
        channel: 'whatsapp',
        instance_name: 'drenvexman',
        service_owner_key: 'lead-handler',
      },
      tenant: {
        id: 'team-1',
        name: 'Freddy Team',
        code: 'immunotec',
      },
      member: {
        id: 'sponsor-1',
        name: 'Ana Sponsor',
        email: 'ana@example.com',
        phone: '+52 55 1234 5678',
        public_slug: 'ana-sponsor',
        whatsapp_link: 'https://wa.me/525512345678',
      },
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
        base_prompt: 'Prompt final',
        route_contexts: {
          risk: {
            enabled: true,
          },
        },
        cta_policy: {
          close: {
            mode: 'soft',
          },
        },
        ai_policy: {
          model: 'gpt-4o-mini',
        },
      },
      resolution: {
        strategy: 'member_override',
        tenant_config_id: 'tenant-config-1',
        member_config_id: 'member-config-1',
      },
    });

    await expect(
      controller.resolveFull({
        instance_name: 'drenvexman',
      }),
    ).resolves.toEqual({
      tenant_id: 'team-1',
      app_key: 'leadflow_api',
      platform_key: 'kurukin',
      product_key: 'leadflow',
      vertical_key: 'immunotec',
      service_owner_key: 'lead-handler',
      wallet_subject: {
        type: 'sponsor',
        id: 'sponsor-1',
        account_id: 'wallet-1',
        balance: '5000000',
        status: 'resolved',
        reason: null,
      },
      runtime_config: expect.objectContaining({
        tenant: {
          id: 'team-1',
          name: 'Freddy Team',
          code: 'immunotec',
        },
        ai_agent: {
          base_prompt: 'Prompt final',
          route_contexts: {
            risk: {
              enabled: true,
            },
          },
          cta_policy: {
            close: {
              mode: 'soft',
            },
          },
          ai_policy: {
            model: 'gpt-4o-mini',
          },
        },
      }),
      config_version: 'leadflow.ai-runtime-context.v1',
      status: 'active',
    });
    expect(aiConfigService.resolveRuntimeContext).toHaveBeenCalledWith(
      'drenvexman',
    );
  });

  it('rejects requests without instance_name', async () => {
    const { controller } = buildController();

    await expect(
      controller.resolveFull({
        instance_name: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
