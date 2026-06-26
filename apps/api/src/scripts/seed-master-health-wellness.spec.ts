import {
  applyStepOverrides,
  containsForbiddenText,
  findSourceDxnFunnelInstance,
  seedHealthWellnessMaster,
} from './seed-master-health-wellness.lib';

describe('seed-master-health-wellness', () => {
  it('applies wellness copy overrides and removes prohibited DXN copy', () => {
    const result = applyStepOverrides(
      [
        {
          type: 'hero',
          eyebrow: 'DXN',
          headline: 'Ingresos extra con Freddy Catunta',
          subheadline: 'Oportunidad exclusiva en Bolivia',
          button_text: 'Quiero saber de DXN',
          imageUrl:
            'https://cdn.example.com/freddy-dxn/ingresos.retodetransformacion.com/hero.jpg',
          accessToken: 'do-not-copy',
          benefits: ['Negocio multinivel', 'Asesor asignado'],
        },
      ],
      'landing',
    );

    const serialized = JSON.stringify(result);

    expect(serialized).toContain(
      'Descubre tu punto de partida para mejorar tu bienestar',
    );
    expect(serialized).toContain('Quiero mi evaluación');
    expect(serialized).toContain('https://placehold.co/1200x800');
    expect(serialized).not.toContain('accessToken');
    expect(containsForbiddenText(serialized)).toBe(false);
  });

  it('finds the healthiest DXN source candidate automatically', async () => {
    const weakCandidate = buildSourceCandidate({
      id: 'weak-source',
      name: 'DXN borrador',
      steps: [{ id: 'step-1' }],
      conversionContract: {},
      publications: [],
    });
    const healthyCandidate = buildSourceCandidate({
      id: 'healthy-source',
      name: 'Freddy-DXN landing',
      steps: [{ id: 'step-1' }, { id: 'step-2' }, { id: 'step-3' }],
      conversionContract: {
        flowGraph: {
          edges: [{ sourceStepId: 'step-1', targetStepId: 'step-2' }],
        },
      },
      publications: [
        {
          status: 'active',
          isActive: true,
          domain: {
            normalizedHost: 'ingresos.retodetransformacion.com',
          },
        },
      ],
    });
    const prisma = {
      funnelInstance: {
        findMany: jest
          .fn()
          .mockResolvedValue([weakCandidate, healthyCandidate]),
      },
    };

    await expect(
      findSourceDxnFunnelInstance(prisma as never, {
        logger: { log: jest.fn(), warn: jest.fn() },
      }),
    ).resolves.toMatchObject({
      id: 'healthy-source',
    });
    expect(prisma.funnelInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      }),
    );
  });

  it('is idempotent when health-wellness-evaluation is already linked', async () => {
    const prisma = {
      funnelArsenalTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'template-1',
          templateKey: 'health-wellness-evaluation',
          assetSlug: 'health-wellness-evaluation',
          sourceFunnelInstanceId: 'master-instance-1',
          sourceFunnelId: 'master-funnel-1',
          libraryAssetVersionId: 'library-version-1',
        }),
        findUnique: jest.fn().mockResolvedValue({
          sourceFunnelInstanceId: 'master-instance-1',
          sourceFunnelId: 'master-funnel-1',
          assetSlug: 'health-wellness-evaluation',
          templateKey: 'health-wellness-evaluation',
          libraryAssetVersionId: 'library-version-1',
        }),
      },
      funnelInstance: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'master-instance-1',
            funnelId: 'master-funnel-1',
            teamId: 'arsenal-team-1',
            steps: [{ id: 'step-1' }, { id: 'step-2' }],
          })
          .mockResolvedValueOnce({
            id: 'master-instance-1',
            funnelId: 'master-funnel-1',
            name: 'Evaluación de bienestar — Master',
            code: 'marketplace-health-wellness-evaluation-master',
            thumbnailUrl:
              'https://placehold.co/1200x630?text=Wellness+Preview',
            rotationPoolId: null,
            trackingProfileId: null,
            handoffStrategyId: null,
            conversionContract: {},
            settingsJson: {},
            mediaMap: {},
            funnel: {
              id: 'master-funnel-1',
              name: 'Evaluación de bienestar — Master',
              description:
                'Formulario de interés para iniciar una evaluación de salud, nutrición o bienestar.',
              code: 'health-wellness-evaluation-master',
              thumbnailUrl:
                'https://placehold.co/1200x630?text=Wellness+Preview',
              config: {},
            },
            steps: [
              {
                id: 'step-1',
                slug: 'captura',
                blocksJson: [],
                mediaMap: {},
                settingsJson: {},
              },
              {
                id: 'step-2',
                slug: 'confirmacion',
                blocksJson: [],
                mediaMap: {},
                settingsJson: {},
              },
            ],
            publications: [],
          }),
      },
      $transaction: jest.fn(),
    };
    const logger = { log: jest.fn(), warn: jest.fn() };

    await expect(
      seedHealthWellnessMaster(prisma as never, { logger }),
    ).resolves.toMatchObject({
      status: 'already_linked',
      masterFunnelInstanceId: 'master-instance-1',
      masterFunnelId: 'master-funnel-1',
      builderUrl:
        '/admin/tenants/arsenal-team-1/funnels/master-funnel-1/builder',
    });
    expect(logger.log).toHaveBeenCalledWith('already linked');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('clones DXN into an internal master, applies overrides, and associates marketplace records', async () => {
    const source = buildSourceCandidate({
      id: 'source-dxn-instance',
      name: 'Freddy-DXN',
      steps: [
        buildSourceStep('source-step-1', 'landing', true, false),
        buildSourceStep('source-step-2', 'presentation', false, false),
        buildSourceStep('source-step-3', 'thank_you', false, true),
      ],
      conversionContract: {
        flowGraph: {
          edges: [
            { sourceStepId: 'source-step-1', targetStepId: 'source-step-2' },
          ],
        },
      },
      publications: [
        {
          status: 'active',
          isActive: true,
          domain: {
            normalizedHost: 'ingresos.retodetransformacion.com',
          },
        },
      ],
    });
    const tx = buildTransactionMock(source);
    const prisma = {
      funnelArsenalTemplate: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
        findUnique: jest.fn().mockResolvedValue({
          sourceFunnelInstanceId: 'master-instance-1',
          sourceFunnelId: 'master-funnel-1',
          assetSlug: 'health-wellness-evaluation',
          templateKey: 'health-wellness-evaluation',
          libraryAssetVersionId: 'library-version-1',
        }),
      },
      funnelInstance: {
        findMany: jest.fn().mockResolvedValue([source]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'master-instance-1',
          funnelId: 'master-funnel-1',
          name: 'Evaluación de bienestar — Master',
          code: 'marketplace-health-wellness-evaluation-master',
          thumbnailUrl:
            'https://placehold.co/1200x630?text=Wellness+Preview',
          rotationPoolId: null,
          trackingProfileId: null,
          handoffStrategyId: null,
          conversionContract: {
            source: 'health_wellness_master_seed',
          },
          settingsJson: {
            headline:
              'Descubre tu punto de partida para mejorar tu bienestar',
          },
          mediaMap: {
            cover: 'https://placehold.co/1200x800?text=Wellness+Evaluation',
          },
          funnel: {
            id: 'master-funnel-1',
            name: 'Evaluación de bienestar — Master',
            description:
              'Formulario de interés para iniciar una evaluación de salud, nutrición o bienestar.',
            code: 'health-wellness-evaluation-master',
            thumbnailUrl:
              'https://placehold.co/1200x630?text=Wellness+Preview',
            config: {
              headline:
                'Descubre tu punto de partida para mejorar tu bienestar',
            },
          },
          steps: [
            {
              id: 'master-step-1',
              slug: 'captura',
              blocksJson: [
                {
                  headline:
                    'Descubre tu punto de partida para mejorar tu bienestar',
                },
              ],
              mediaMap: {},
              settingsJson: {},
            },
            {
              id: 'master-step-2',
              slug: 'presentacion',
              blocksJson: [
                {
                  headline:
                    'Cómo mejorar tu bienestar con un plan simple y sostenible',
                },
              ],
              mediaMap: {},
              settingsJson: {},
            },
            {
              id: 'master-step-3',
              slug: 'confirmacion',
              blocksJson: [{ headline: 'Tu solicitud fue recibida' }],
              mediaMap: {},
              settingsJson: {},
            },
          ],
          publications: [],
        }),
      },
      workspace: {
        upsert: jest.fn().mockResolvedValue({ id: 'arsenal-workspace-1' }),
      },
      team: {
        upsert: jest.fn().mockResolvedValue({ id: 'arsenal-team-1' }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };

    await expect(
      seedHealthWellnessMaster(prisma as never, {
        logger: { log: jest.fn(), warn: jest.fn() },
      }),
    ).resolves.toMatchObject({
      status: 'created',
      sourceFunnelInstanceId: 'source-dxn-instance',
      masterFunnelInstanceId: 'master-instance-1',
      masterFunnelId: 'master-funnel-1',
      templateKey: 'health-wellness-evaluation',
      assetSlug: 'health-wellness-evaluation',
      confirmations: {
        noPublications: true,
        noDomainsCopied: true,
        noTrackingTokens: true,
        noForbiddenCopy: true,
      },
    });

    expect(tx.funnelPublication.create).not.toHaveBeenCalled();
    expect(tx.domain.findFirst).not.toHaveBeenCalled();
    expect(tx.domain.upsert).not.toHaveBeenCalled();
    expect(tx.funnelInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'master-instance-1' },
        data: expect.objectContaining({
          name: 'Evaluación de bienestar — Master',
          code: 'marketplace-health-wellness-evaluation-master',
          trackingProfileId: null,
          handoffStrategyId: null,
        }),
      }),
    );
    expect(tx.funnelInstance.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'source-dxn-instance' },
      }),
    );
    expect(tx.funnelArsenalTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          templateKey: 'health-wellness-evaluation',
          assetSlug: 'health-wellness-evaluation',
          sourceFunnelInstanceId: 'master-instance-1',
          sourceFunnelId: 'master-funnel-1',
          status: 'active',
        }),
      }),
    );
    expect(tx.libraryFunnelVersion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sourceFunnelInstanceId: 'master-instance-1',
          sourceFunnelId: 'master-funnel-1',
          stepsCount: 3,
        }),
      }),
    );
  });
});

const buildSourceStep = (
  id: string,
  stepType: string,
  isEntryStep: boolean,
  isConversionStep: boolean,
) => ({
  id,
  workspaceId: 'source-workspace',
  teamId: 'source-team',
  funnelInstanceId: 'source-dxn-instance',
  stepType,
  slug: stepType === 'thank_you' ? 'confirmacion' : stepType,
  position:
    stepType === 'landing' ? 1 : stepType === 'presentation' ? 2 : 3,
  isEntryStep,
  isConversionStep,
  blocksJson: [
    {
      headline: 'DXN con Freddy Catunta',
      subheadline: 'Ingresos extra en Bolivia',
      button_text: 'Quiero DXN',
    },
  ],
  mediaMap: {},
  settingsJson: {},
  createdAt: new Date('2026-06-26T00:00:00.000Z'),
  updatedAt: new Date('2026-06-26T00:00:00.000Z'),
});

const buildSourceCandidate = (overrides: Record<string, unknown>) => ({
  id: 'source-instance',
  workspaceId: 'source-workspace',
  teamId: 'source-team',
  templateId: 'source-template',
  funnelId: 'source-funnel',
  name: 'DXN',
  code: 'dxn',
  thumbnailUrl: null,
  status: 'active',
  structuralType: 'multi_step_conversion',
  conversionContract: {},
  rotationPoolId: null,
  trackingProfileId: null,
  handoffStrategyId: null,
  settingsJson: {},
  mediaMap: {},
  createdAt: new Date('2026-06-26T00:00:00.000Z'),
  updatedAt: new Date('2026-06-26T00:00:00.000Z'),
  funnel: {
    id: 'source-funnel',
    workspaceId: 'source-workspace',
    name: 'DXN',
    description: 'Source',
    code: 'dxn-source',
    thumbnailUrl: null,
    config: {},
    status: 'active',
    isTemplate: false,
    stages: ['captured', 'qualified'],
    entrySources: ['form'],
    defaultTeamId: 'source-team',
    defaultRotationPoolId: null,
    createdAt: new Date('2026-06-26T00:00:00.000Z'),
    updatedAt: new Date('2026-06-26T00:00:00.000Z'),
  },
  team: {
    id: 'source-team',
    workspaceId: 'source-workspace',
    name: 'Freddy-DXN',
    code: 'freddy-dxn',
    logoUrl: null,
    status: 'active',
    teamType: 'commercial_team',
    isActive: true,
    lastAssignedUserId: null,
    subscriptionExpiresAt: null,
    description: null,
    managerUserId: null,
    maxSeats: 10,
    createdAt: new Date('2026-06-26T00:00:00.000Z'),
    updatedAt: new Date('2026-06-26T00:00:00.000Z'),
  },
  template: {
    id: 'source-template',
    workspaceId: null,
    name: 'Source Template',
    description: null,
    code: 'source-template',
    status: 'active',
    version: 1,
    funnelType: 'hybrid',
    blocksJson: {},
    mediaMap: {},
    settingsJson: {},
    allowedOverridesJson: {},
    defaultHandoffStrategyId: null,
    createdAt: new Date('2026-06-26T00:00:00.000Z'),
    updatedAt: new Date('2026-06-26T00:00:00.000Z'),
  },
  steps: [],
  publications: [],
  ...overrides,
});

const buildTransactionMock = (source: Record<string, unknown>) => ({
  funnelInstance: {
    findUnique: jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(source)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        conversionContract: {
          flowGraph: {
            edges: [
              {
                sourceStepId: 'master-step-1',
                targetStepId: 'master-step-2',
              },
            ],
          },
        },
        settingsJson: {},
        mediaMap: {},
      }),
    create: jest.fn().mockResolvedValue({ id: 'master-instance-1' }),
    update: jest.fn().mockResolvedValue({
      id: 'master-instance-1',
      steps: [
        buildSourceStep('master-step-1', 'landing', true, false),
        buildSourceStep('master-step-2', 'presentation', false, false),
        buildSourceStep('master-step-3', 'thank_you', false, true),
      ],
    }),
  },
  team: {
    findUnique: jest.fn().mockResolvedValue({
      id: 'arsenal-team-1',
      workspaceId: 'arsenal-workspace-1',
      name: 'LeadFlow Arsenal Masters',
      code: 'leadflow-arsenal-masters',
    }),
  },
  funnel: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'master-funnel-1' }),
    update: jest.fn().mockResolvedValue({ id: 'master-funnel-1' }),
  },
  funnelStep: {
    create: jest.fn().mockResolvedValue({ id: 'unused' }),
    update: jest.fn().mockResolvedValue({ id: 'unused' }),
    count: jest.fn().mockResolvedValue(3),
  },
  domain: {
    findFirst: jest.fn(),
    upsert: jest.fn(),
  },
  funnelPublication: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  libraryCollection: {
    upsert: jest.fn().mockResolvedValue({ id: 'collection-1' }),
  },
  libraryAsset: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'asset-1' }),
    update: jest.fn(),
  },
  libraryAssetVersion: {
    upsert: jest.fn().mockResolvedValue({ id: 'library-version-1' }),
  },
  libraryFunnelVersion: {
    upsert: jest.fn().mockResolvedValue({ id: 'library-funnel-version-1' }),
  },
  libraryMedia: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    createMany: jest.fn().mockResolvedValue({ count: 2 }),
  },
  funnelArsenalTemplate: {
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({
      id: 'template-1',
      templateKey: 'health-wellness-evaluation',
      assetSlug: 'health-wellness-evaluation',
      libraryAssetVersionId: 'library-version-1',
    }),
    update: jest.fn(),
  },
});
