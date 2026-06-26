import { lintFunnelDraft } from '../../../../packages/shared/funnel-lint/src/lint-funnel-draft';
import {
  repairFlowGraphNodeKeysForCurrentSteps,
  repairFunnelFlowGraphNodeKeys,
} from './repair-funnel-flowgraph-node-keys.lib';

describe('repair funnel flowgraph node keys', () => {
  const brokenContract = {
    flowGraph: {
      version: 1,
      entryStepId: 'newA',
      defaultOutcome: 'submit_success',
      nodes: {
        oldA: {
          stepId: 'newA',
          slug: 'captura',
          exits: {
            submit_success: {
              outcome: 'submit_success',
              toStepId: 'newB',
            },
          },
        },
        oldB: {
          stepId: 'newB',
          slug: 'gracias',
          exits: {},
          isTerminal: true,
        },
      },
    },
  };

  it('reindexes a broken cloned FlowGraph by current node.stepId values', () => {
    const result = repairFlowGraphNodeKeysForCurrentSteps(brokenContract, [
      { id: 'newA' },
      { id: 'newB' },
    ]);

    expect(result.changed).toBe(true);
    expect(result.conversionContract).toMatchObject({
      flowGraph: {
        entryStepId: 'newA',
        nodes: {
          newA: {
            stepId: 'newA',
            exits: {
              submit_success: {
                toStepId: 'newB',
              },
            },
          },
          newB: {
            stepId: 'newB',
          },
        },
      },
    });
    expect(
      Object.keys(
        (result.conversionContract as typeof brokenContract).flowGraph.nodes,
      ),
    ).toEqual(['newA', 'newB']);

    const report = lintFunnelDraft({
      blocksJson: [],
      structuralType: 'multi_step_conversion',
      conversionContract: result.conversionContract,
    });

    expect(report.issues).toEqual([]);
  });

  it('updates affected instances and reports before and after lint counts', async () => {
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
      funnelInstance: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'instance-1',
          name: 'Broken clone',
          conversionContract: brokenContract,
          steps: [{ id: 'newA' }, { id: 'newB' }],
        }),
        findMany: jest.fn(),
        update,
      },
    };

    await expect(
      repairFunnelFlowGraphNodeKeys(prisma, {
        funnelInstanceId: 'instance-1',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        instanceId: 'instance-1',
        changed: true,
        before: expect.objectContaining({
          errorCount: 2,
        }),
        after: expect.objectContaining({
          errorCount: 0,
          issueCount: 0,
          nodeKeys: ['newA', 'newB'],
        }),
      }),
    ]);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'instance-1',
        },
        data: {
          conversionContract: expect.objectContaining({
            flowGraph: expect.objectContaining({
              nodes: expect.objectContaining({
                newA: expect.objectContaining({
                  stepId: 'newA',
                }),
              }),
            }),
          }),
        },
      }),
    );
  });
});
