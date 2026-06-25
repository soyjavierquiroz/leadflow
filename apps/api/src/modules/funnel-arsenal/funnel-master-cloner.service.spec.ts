import type { PrismaService } from '../../prisma/prisma.service';
import { FunnelMasterClonerService } from './funnel-master-cloner.service';

describe('FunnelMasterClonerService', () => {
  it('deep clones a master FunnelInstance, rewrites step references and resets secrets', async () => {
    const tx = {
      funnelInstance: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'source-instance-1',
          workspaceId: 'source-workspace',
          teamId: 'source-team',
          templateId: 'source-template-1',
          funnelId: 'source-funnel-1',
          name: 'Source funnel',
          code: 'source-code',
          thumbnailUrl: 'https://cdn.example.com/thumb.png',
          status: 'active',
          structuralType: 'multi_step_conversion',
          conversionContract: {
            flowGraph: {
              edges: [
                {
                  sourceStepId: 'source-step-a',
                  targetStepId: 'source-step-b',
                },
              ],
            },
            metaCapiToken: 'do-not-copy',
          },
          settingsJson: {
            entryStepId: 'source-step-a',
            theme: 'source',
            metaPixelId: '123',
          },
          mediaMap: {
            hero: 'https://cdn.example.com/hero.png',
            signed:
              'https://cdn.example.com/private.png?X-Amz-Signature=secret',
          },
          template: {
            id: 'source-template-1',
          },
          funnel: {
            id: 'source-funnel-1',
            description: 'Source description',
            config: {
              currentStepId: 'source-step-a',
              webhookSecret: 'secret',
            },
            stages: ['captured', 'qualified'],
            entrySources: ['form'],
          },
          steps: [
            {
              id: 'source-step-a',
              stepType: 'landing',
              slug: 'inicio',
              position: 1,
              isEntryStep: true,
              isConversionStep: false,
              blocksJson: [
                {
                  type: 'hero',
                  settings: {
                    nextStepId: 'source-step-b',
                    accessToken: 'secret',
                  },
                },
              ],
              mediaMap: {
                hero: 'https://cdn.example.com/hero.png',
              },
              settingsJson: {
                nextStepId: 'source-step-b',
              },
            },
            {
              id: 'source-step-b',
              stepType: 'thank_you',
              slug: 'gracias',
              position: 2,
              isEntryStep: false,
              isConversionStep: true,
              blocksJson: [{ type: 'thanks' }],
              mediaMap: {},
              settingsJson: {},
            },
          ],
        }),
        create: jest.fn().mockResolvedValue({ id: 'cloned-instance-1' }),
      },
      team: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'target-team',
          workspaceId: 'target-workspace',
          name: 'Margarita Pasos',
          code: 'margarita-pasos',
        }),
      },
      domain: {
        findFirst: jest.fn().mockResolvedValue({ id: 'custom-domain-1' }),
      },
      funnelPublication: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'publication-1',
          pathPrefix: '/evaluacion',
          domain: {
            host: 'margarita.example.com',
          },
        }),
      },
      funnel: {
        create: jest.fn().mockResolvedValue({ id: 'cloned-funnel-1' }),
      },
      funnelStep: {
        create: jest.fn().mockResolvedValue({ id: 'unused' }),
      },
    };
    const service = new FunnelMasterClonerService({} as PrismaService);

    const result = await service.cloneMasterFunnelInstanceToTeamInTransaction(
      tx as never,
      {
        sourceFunnelInstanceId: 'source-instance-1',
        targetWorkspaceId: 'target-workspace',
        targetTeamId: 'target-team',
        requestedPath: '/evaluacion',
        templateKey: 'health-wellness-evaluation',
        blueprintKey: 'blueprint.health_wellness.v1',
        templateLabel: 'Evaluación',
        templateDescription: 'Template description',
        instanceCode: 'arsenal-health-wellness-evaluation',
      },
    );

    const clonedStepA = result.stepIdMap['source-step-a'];
    const clonedStepB = result.stepIdMap['source-step-b'];

    expect(clonedStepA).toBeTruthy();
    expect(clonedStepB).toBeTruthy();
    expect(clonedStepA).not.toBe('source-step-a');
    expect(clonedStepB).not.toBe('source-step-b');
    expect(tx.funnelInstance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'target-workspace',
          teamId: 'target-team',
          code: 'arsenal-health-wellness-evaluation',
          rotationPoolId: null,
          trackingProfileId: null,
          handoffStrategyId: null,
          conversionContract: expect.objectContaining({
            flowGraph: {
              edges: [
                {
                  sourceStepId: clonedStepA,
                  targetStepId: clonedStepB,
                },
              ],
            },
          }),
          settingsJson: expect.not.objectContaining({
            metaPixelId: expect.anything(),
          }),
        }),
      }),
    );
    expect(tx.funnelStep.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: clonedStepA,
          blocksJson: [
            {
              type: 'hero',
              settings: {
                nextStepId: clonedStepB,
              },
            },
          ],
        }),
      }),
    );
    expect(tx.funnelPublication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trackingProfileId: null,
          handoffStrategyId: null,
          metaPixelId: null,
          tiktokPixelId: null,
          metaCapiToken: null,
          tiktokAccessToken: null,
          pathPrefix: '/evaluacion',
        }),
      }),
    );
    expect(result).toMatchObject({
      funnelId: 'cloned-funnel-1',
      funnelInstanceId: 'cloned-instance-1',
      publicationId: 'publication-1',
      publicUrl: 'https://margarita.example.com/evaluacion',
      pathPrefix: '/evaluacion',
    });
  });

  it('allocates platform fallback paths with team slug and collision suffixes', async () => {
    const tx = {
      domain: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'platform-domain-1' }),
      },
      funnelPublication: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'conflict-1' })
          .mockResolvedValueOnce(null),
      },
    };
    const service = new FunnelMasterClonerService({} as PrismaService);

    await expect(
      service.resolvePublicationTarget(tx as never, {
        workspaceId: 'workspace-1',
        teamId: 'team-1',
        teamSlug: 'Margarita Pasos',
        requestedPath: '/evaluacion',
      }),
    ).resolves.toEqual({
      domainId: 'platform-domain-1',
      pathPrefix: '/u/margarita-pasos/evaluacion-2',
    });
    expect(tx.domain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          normalizedHost: 'leadflow.kuruk.in',
        },
        create: expect.objectContaining({
          domainType: 'system_subdomain',
          status: 'active',
        }),
      }),
    );
  });
});
