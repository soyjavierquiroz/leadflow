import { FlowNodeRole } from '../../../../../packages/shared/funnel-lint/src';
import type { PrismaService } from '../../prisma/prisma.service';
import { FunnelGraphMutationService } from './funnel-graph-mutation.service';

describe('FunnelGraphMutationService', () => {
  it('mutates a system tenant funnel instance by tenant and Funnel.id without user workspace scope', async () => {
    const tx = {
      funnelInstance: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'master-instance-1',
          workspaceId: 'arsenal-workspace-1',
          teamId: 'arsenal-team-1',
          funnelId: 'master-funnel-1',
          structuralType: 'two_step_conversion',
          conversionContract: {},
          steps: [],
        }),
        update: jest.fn().mockResolvedValue({ id: 'master-instance-1' }),
      },
      funnelStep: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'step-1',
          slug: 'nuevo-offer',
          stepType: 'landing',
          position: 1,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const templateService = {
      getStepDefaults: jest.fn().mockResolvedValue({
        blocksJson: [],
        mediaMap: {},
        settingsJson: {},
      }),
    };
    const runtimeContextConfigSyncService = {
      syncFunnelContextForInstance: jest.fn().mockResolvedValue(undefined),
    };
    const service = new FunnelGraphMutationService(
      prisma as unknown as PrismaService,
      templateService as never,
      runtimeContextConfigSyncService as never,
    );

    await expect(
      service.addNode(
        {
          workspaceId: '',
          teamId: 'arsenal-team-1',
        },
        'master-instance-1',
        {
          role: FlowNodeRole.OFFER,
          title: 'Nuevo Offer',
        },
        {
          funnelId: 'master-funnel-1',
        },
      ),
    ).resolves.toMatchObject({
      graph: {
        nodes: {
          'step-1': {
            stepId: 'step-1',
          },
        },
      },
    });
    expect(tx.funnelInstance.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'master-instance-1',
          teamId: 'arsenal-team-1',
          funnelId: 'master-funnel-1',
        },
      }),
    );
  });
});
