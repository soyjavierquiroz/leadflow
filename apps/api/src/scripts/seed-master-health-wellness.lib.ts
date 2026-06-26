import {
  FunnelArsenalTemplateStatus,
  LibraryAssetStatus,
  LibraryAssetType,
  LibraryAssetVersionStatus,
  LibraryMediaType,
  LibraryOwnerType,
  LibraryVisibility,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import {
  funnelArsenalTemplates,
  getBusinessBlueprintByKey,
} from '@leadflow/account-model';
import { FunnelMasterClonerService } from '../modules/funnel-arsenal/funnel-master-cloner.service';
import { ensureLeadFlowArsenalWorkspace } from '../modules/funnel-arsenal/leadflow-arsenal-workspace';

const ASSET_SLUG = 'health-wellness-evaluation';
const MASTER_NAME = 'Evaluación de bienestar — Master';
const MASTER_FUNNEL_CODE = 'health-wellness-evaluation-master';
const MASTER_INSTANCE_CODE = 'marketplace-health-wellness-evaluation-master';
const SOURCE_DOMAIN = 'ingresos.retodetransformacion.com';
const PLACEHOLDER_COVER =
  'https://placehold.co/1200x800?text=Wellness+Evaluation';
const PLACEHOLDER_COACH = 'https://placehold.co/800x800?text=Coach';
const PLACEHOLDER_PREVIEW =
  'https://placehold.co/1200x630?text=Wellness+Preview';

const wellnessCopy = {
  eyebrow: 'Evaluación de bienestar',
  headline: 'Descubre tu punto de partida para mejorar tu bienestar',
  subheadline:
    'Responde unas preguntas simples y recibe una evaluación inicial personalizada.',
  cta: 'Quiero mi evaluación',
  benefits: [
    'Identifica tus objetivos principales',
    'Recibe una guía inicial clara',
    'Da el primer paso sin compromiso',
  ],
  thankYouHeadline: 'Tu solicitud fue recibida',
  thankYouBody:
    'En breve recibirás el siguiente paso para completar tu evaluación.',
  presentationHeadline:
    'Cómo mejorar tu bienestar con un plan simple y sostenible',
  description:
    'Formulario de interés para iniciar una evaluación de salud, nutrición o bienestar.',
};

const forbiddenTextPatterns = [
  /dxn/gi,
  /freddy\s+catunta/gi,
  /freddy/gi,
  /ingresos\.retodetransformacion\.com/gi,
  /ingresos\s+extra/gi,
  /bolivia/gi,
  /negocio\s+multinivel/gi,
  /multinivel/gi,
  /oportunidad\s+exclusiva/gi,
  /asesor\s+asignado/gi,
] as const;

const secretKeyFragments = [
  'secret',
  'token',
  'authorization',
  'cookie',
  'api-key',
  'apikey',
  'access-token',
  'access_token',
  'accesstoken',
  'capi',
  'pixel',
  'webhook',
] as const;

type SeedStatus = 'created' | 'already_linked' | 'recreated';

type HealthWellnessSeedOptions = {
  forceRecreate?: boolean;
  sourceFunnelInstanceId?: string | null;
  logger?: Pick<typeof console, 'log' | 'warn'>;
};

type HealthWellnessSeedResult = {
  status: SeedStatus;
  sourceFunnelInstanceId: string | null;
  masterFunnelInstanceId: string;
  masterFunnelId: string;
  templateId: string;
  templateKey: string;
  assetSlug: string;
  builderUrl: string;
  previewUrl: string;
  stepsCount: number;
  marketplaceLibraryAssetVersionId: string | null;
  confirmations: {
    noPublications: boolean;
    noDomainsCopied: boolean;
    noTrackingTokens: boolean;
    noForbiddenCopy: boolean;
  };
};

type SourceFunnelInstance = Prisma.FunnelInstanceGetPayload<{
  include: {
    funnel: true;
    team: true;
    template: true;
    steps: true;
    publications: {
      include: {
        domain: true;
      };
    };
  };
}>;

type SeedTransaction = Prisma.TransactionClient;

const toInputJson = (value: Prisma.JsonValue): Prisma.InputJsonValue =>
  value as Prisma.InputJsonValue;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isSecretKey = (key: string) => {
  const normalized = key.trim().toLowerCase();

  return secretKeyFragments.some((fragment) => normalized.includes(fragment));
};

const containsForbiddenText = (value: string) =>
  forbiddenTextPatterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  });

const hasValidFlowGraph = (value: Prisma.JsonValue | null | undefined) => {
  if (!isRecord(value)) {
    return false;
  }

  const graph = value.flowGraph;

  if (!isRecord(graph)) {
    return false;
  }

  return Array.isArray(graph.edges) || Array.isArray(graph.nodes);
};

const sanitizeString = (value: string, keyHint = '') => {
  const isUrl = /^https?:\/\//i.test(value);

  if (isUrl && containsForbiddenText(value)) {
    const normalizedKey = keyHint.toLowerCase();

    if (normalizedKey.includes('coach') || normalizedKey.includes('avatar')) {
      return PLACEHOLDER_COACH;
    }

    if (
      normalizedKey.includes('og') ||
      normalizedKey.includes('preview') ||
      normalizedKey.includes('thumb')
    ) {
      return PLACEHOLDER_PREVIEW;
    }

    return PLACEHOLDER_COVER;
  }

  return value
    .replace(/dxn/gi, 'bienestar')
    .replace(/freddy\s+catunta/gi, 'tu equipo de bienestar')
    .replace(/freddy/gi, 'tu equipo de bienestar')
    .replace(/ingresos\.retodetransformacion\.com/gi, 'tu evaluación')
    .replace(/ingresos\s+extra/gi, 'bienestar personal')
    .replace(/bolivia/gi, 'tu zona')
    .replace(/negocio\s+multinivel/gi, 'plan de bienestar')
    .replace(/multinivel/gi, 'bienestar')
    .replace(/oportunidad\s+exclusiva/gi, 'evaluación personalizada')
    .replace(/asesor\s+asignado/gi, 'siguiente paso');
};

const sanitizeJson = (
  value: Prisma.JsonValue | null | undefined,
  keyHint = '',
): Prisma.JsonValue => {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJson(entry, keyHint));
  }

  if (!isRecord(value)) {
    if (typeof value === 'string') {
      return sanitizeString(value, keyHint);
    }

    return (value ?? null) as Prisma.JsonValue;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isSecretKey(key))
      .map(([key, entryValue]) => [key, sanitizeJson(entryValue, key)]),
  ) as Prisma.JsonValue;
};

const textForStep = (stepType: string) => {
  if (stepType === 'thank_you') {
    return {
      title: wellnessCopy.thankYouHeadline,
      body: wellnessCopy.thankYouBody,
      cta: wellnessCopy.cta,
    };
  }

  if (stepType === 'presentation') {
    return {
      title: wellnessCopy.presentationHeadline,
      body: wellnessCopy.subheadline,
      cta: wellnessCopy.cta,
    };
  }

  return {
    title: wellnessCopy.headline,
    body: wellnessCopy.subheadline,
    cta: wellnessCopy.cta,
  };
};

const applyStepCopy = (
  value: Prisma.JsonValue,
  stepType: string,
): Prisma.JsonValue => {
  const text = textForStep(stepType);

  if (Array.isArray(value)) {
    return value.map((entry) => applyStepCopy(entry, stepType));
  }

  if (!isRecord(value)) {
    return value;
  }

  const entries = Object.entries(value).map(([key, entryValue]) => {
    const normalizedKey = key.toLowerCase();

    if (
      ['eyebrow', 'kicker', 'preheadline'].includes(normalizedKey) &&
      typeof entryValue === 'string'
    ) {
      return [key, wellnessCopy.eyebrow] as const;
    }

    if (
      ['headline', 'title', 'heading', 'heroheadline', 'herotitle'].includes(
        normalizedKey,
      ) &&
      typeof entryValue === 'string'
    ) {
      return [key, text.title] as const;
    }

    if (
      [
        'subheadline',
        'subtitle',
        'description',
        'body',
        'helpertext',
        'helper_text',
      ].includes(normalizedKey) &&
      typeof entryValue === 'string'
    ) {
      return [key, text.body] as const;
    }

    if (
      [
        'cta',
        'ctatext',
        'ctacopy',
        'buttontext',
        'button_text',
        'desktopbuttontext',
        'mobilebuttontext',
        'submittext',
        'submit_text',
      ].includes(normalizedKey) &&
      typeof entryValue === 'string'
    ) {
      return [key, text.cta] as const;
    }

    if (
      normalizedKey.includes('benefit') &&
      Array.isArray(entryValue) &&
      entryValue.every((entry) => typeof entry === 'string')
    ) {
      return [key, wellnessCopy.benefits] as const;
    }

    return [key, applyStepCopy(entryValue as Prisma.JsonValue, stepType)] as const;
  });

  return Object.fromEntries(entries) as Prisma.JsonValue;
};

const applyStepOverrides = (
  value: Prisma.JsonValue | null | undefined,
  stepType: string,
) => applyStepCopy(sanitizeJson(value), stepType);

const sourceSearchWhere = (sourceFunnelInstanceId?: string | null) => {
  const textMatches = [
    { name: { contains: 'DXN', mode: Prisma.QueryMode.insensitive } },
    { code: { contains: 'dxn', mode: Prisma.QueryMode.insensitive } },
    {
      team: {
        is: {
          OR: [
            { name: { contains: 'Freddy-DXN', mode: Prisma.QueryMode.insensitive } },
            { name: { contains: 'DXN', mode: Prisma.QueryMode.insensitive } },
            { code: { contains: 'dxn', mode: Prisma.QueryMode.insensitive } },
          ],
        },
      },
    },
    {
      funnel: {
        is: {
          OR: [
            { name: { contains: 'DXN', mode: Prisma.QueryMode.insensitive } },
            { code: { contains: 'dxn', mode: Prisma.QueryMode.insensitive } },
          ],
        },
      },
    },
    {
      publications: {
        some: {
          domain: {
            is: {
              normalizedHost: SOURCE_DOMAIN,
            },
          },
        },
      },
    },
  ];

  if (!sourceFunnelInstanceId) {
    return {
      OR: textMatches,
    };
  }

  return {
    OR: [{ id: sourceFunnelInstanceId }, ...textMatches],
  };
};

const sourceInclude = {
  funnel: true,
  team: true,
  template: true,
  steps: {
    orderBy: {
      position: 'asc',
    },
  },
  publications: {
    include: {
      domain: true,
    },
  },
} satisfies Prisma.FunnelInstanceInclude;

const scoreSourceCandidate = (candidate: SourceFunnelInstance) => {
  const hasActivePublication = candidate.publications.some(
    (publication) => publication.status === 'active' && publication.isActive,
  );
  const hasTargetDomain = candidate.publications.some(
    (publication) => publication.domain.normalizedHost === SOURCE_DOMAIN,
  );
  const nameSignal = [
    candidate.name,
    candidate.code,
    candidate.team.name,
    candidate.team.code,
    candidate.funnel?.name,
    candidate.funnel?.code,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    candidate.steps.length * 10 +
    (hasValidFlowGraph(candidate.conversionContract) ? 25 : 0) +
    (hasActivePublication ? 15 : 0) +
    (hasTargetDomain ? 20 : 0) +
    (candidate.templateId ? 5 : 0) +
    (/dxn/i.test(nameSignal) ? 5 : 0)
  );
};

const findSourceDxnFunnelInstance = async (
  prisma: PrismaClient,
  options: HealthWellnessSeedOptions,
): Promise<SourceFunnelInstance> => {
  const candidates = await prisma.funnelInstance.findMany({
    where: sourceSearchWhere(options.sourceFunnelInstanceId),
    include: sourceInclude,
    take: 50,
  });

  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreSourceCandidate(candidate),
    }))
    .sort((left, right) => right.score - left.score);

  if (ranked.length === 0) {
    throw new Error(
      `No DXN source FunnelInstance was found. Set SOURCE_DXN_FUNNEL_INSTANCE_ID as a fallback.`,
    );
  }

  options.logger?.log(
    `DXN source candidates: ${ranked
      .map(
        ({ candidate, score }) =>
          `${candidate.id}:${candidate.name}:${candidate.steps.length}steps:score${score}`,
      )
      .join(', ')}`,
  );

  return ranked[0].candidate;
};

const findUniqueFunnelCode = async (
  tx: SeedTransaction,
  workspaceId: string,
  baseCode: string,
) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = attempt === 0 ? baseCode : `${baseCode}-${attempt + 1}`;
    const existing = await tx.funnel.findUnique({
      where: {
        workspaceId_code: {
          workspaceId,
          code,
        },
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return code;
    }
  }

  throw new Error(`Could not allocate a unique Funnel.code for ${baseCode}.`);
};

const findUniqueFunnelInstanceCode = async (
  tx: SeedTransaction,
  teamId: string,
  baseCode: string,
) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = attempt === 0 ? baseCode : `${baseCode}-${attempt + 1}`;
    const existing = await tx.funnelInstance.findUnique({
      where: {
        teamId_code: {
          teamId,
          code,
        },
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return code;
    }
  }

  throw new Error(
    `Could not allocate a unique FunnelInstance.code for ${baseCode}.`,
  );
};

const updateClonedMasterCopy = async (
  tx: SeedTransaction,
  input: {
    funnelId: string;
    funnelInstanceId: string;
    workspaceId: string;
    teamId: string;
  },
) => {
  const funnelCode = await findUniqueFunnelCode(
    tx,
    input.workspaceId,
    MASTER_FUNNEL_CODE,
  );
  const instanceCode = await findUniqueFunnelInstanceCode(
    tx,
    input.teamId,
    MASTER_INSTANCE_CODE,
  );

  await tx.funnel.update({
    where: {
      id: input.funnelId,
    },
    data: {
      name: MASTER_NAME,
      code: funnelCode,
      description: wellnessCopy.description,
      thumbnailUrl: PLACEHOLDER_PREVIEW,
      config: toInputJson(
        sanitizeJson({
          isMasterFunnel: true,
          source: 'health_wellness_master_seed',
          assetSlug: ASSET_SLUG,
          templateKey: ASSET_SLUG,
          headline: wellnessCopy.headline,
          description: wellnessCopy.description,
          cta: wellnessCopy.cta,
        }),
      ),
      status: 'draft',
    },
  });

  const currentInstance = await tx.funnelInstance.findUnique({
    where: {
      id: input.funnelInstanceId,
    },
    select: {
      conversionContract: true,
      settingsJson: true,
      mediaMap: true,
    },
  });

  const instance = await tx.funnelInstance.update({
    where: {
      id: input.funnelInstanceId,
    },
    data: {
      name: MASTER_NAME,
      code: instanceCode,
      thumbnailUrl: PLACEHOLDER_PREVIEW,
      status: 'draft',
      rotationPoolId: null,
      trackingProfileId: null,
      handoffStrategyId: null,
      conversionContract: toInputJson(
        sanitizeJson({
          ...((currentInstance?.conversionContract ?? {}) as Record<
            string,
            Prisma.JsonValue
          >),
          source: 'health_wellness_master_seed',
          assetSlug: ASSET_SLUG,
          templateKey: ASSET_SLUG,
        }),
      ),
      settingsJson: toInputJson(
        sanitizeJson({
          ...((currentInstance?.settingsJson ?? {}) as Record<
            string,
            Prisma.JsonValue
          >),
          headline: wellnessCopy.headline,
          subheadline: wellnessCopy.subheadline,
          cta: wellnessCopy.cta,
          benefits: wellnessCopy.benefits,
        }),
      ),
      mediaMap: toInputJson(
        sanitizeJson({
          ...((currentInstance?.mediaMap ?? {}) as Record<
            string,
            Prisma.JsonValue
          >),
          cover: PLACEHOLDER_COVER,
          coach: PLACEHOLDER_COACH,
          preview: PLACEHOLDER_PREVIEW,
        }),
      ),
    },
    include: {
      steps: {
        orderBy: {
          position: 'asc',
        },
      },
    },
  });

  for (const step of instance.steps) {
    await tx.funnelStep.update({
      where: {
        id: step.id,
      },
      data: {
        blocksJson: toInputJson(
          applyStepOverrides(step.blocksJson, step.stepType),
        ),
        mediaMap: toInputJson(
          sanitizeJson({
            ...(isRecord(step.mediaMap) ? step.mediaMap : {}),
            cover: PLACEHOLDER_COVER,
            preview: PLACEHOLDER_PREVIEW,
          } as Prisma.JsonValue),
        ),
        settingsJson: toInputJson(
          applyStepOverrides(step.settingsJson, step.stepType),
        ),
      },
    });
  }

  return {
    funnelCode,
    instanceCode,
  };
};

const upsertLibraryVersion = async (
  tx: SeedTransaction,
  input: {
    sourceFunnelInstanceId: string;
    sourceFunnelId: string;
    stepsCount: number;
  },
) => {
  const collection = await tx.libraryCollection.upsert({
    where: {
      slug: 'funnel-marketplace',
    },
    create: {
      slug: 'funnel-marketplace',
      title: 'Funnel Marketplace',
      description: 'Published LeadFlow marketplace funnel assets.',
      assetType: LibraryAssetType.funnel,
      status: 'active',
      sortOrder: 10,
    },
    update: {
      title: 'Funnel Marketplace',
      description: 'Published LeadFlow marketplace funnel assets.',
      assetType: LibraryAssetType.funnel,
      status: 'active',
    },
    select: {
      id: true,
    },
  });

  const existingAsset = await tx.libraryAsset.findFirst({
    where: {
      slug: ASSET_SLUG,
    },
    select: {
      id: true,
    },
  });

  const asset = existingAsset
    ? await tx.libraryAsset.update({
        where: {
          id: existingAsset.id,
        },
        data: {
          title: 'Evaluación de bienestar',
          description: wellnessCopy.description,
          assetType: LibraryAssetType.funnel,
          ownerType: LibraryOwnerType.system,
          visibility: LibraryVisibility.internal,
          status: LibraryAssetStatus.active,
        },
        select: {
          id: true,
        },
      })
    : await tx.libraryAsset.create({
        data: {
          collectionId: collection.id,
          slug: ASSET_SLUG,
          title: 'Evaluación de bienestar',
          description: wellnessCopy.description,
          assetType: LibraryAssetType.funnel,
          ownerType: LibraryOwnerType.system,
          visibility: LibraryVisibility.internal,
          status: LibraryAssetStatus.active,
        },
        select: {
          id: true,
        },
      });

  const version = await tx.libraryAssetVersion.upsert({
    where: {
      assetId_version: {
        assetId: asset.id,
        version: '1.0.0',
      },
    },
    create: {
      assetId: asset.id,
      version: '1.0.0',
      status: LibraryAssetVersionStatus.published,
      publishedAt: new Date(),
      changeLog: 'Seeded from DXN source funnel as health wellness master.',
      sourceReferenceId: input.sourceFunnelInstanceId,
      previewConfig: toInputJson({
        previewUrl: `/member/funnels/${ASSET_SLUG}/preview`,
      }),
    },
    update: {
      status: LibraryAssetVersionStatus.published,
      publishedAt: new Date(),
      changeLog: 'Seeded from DXN source funnel as health wellness master.',
      sourceReferenceId: input.sourceFunnelInstanceId,
      previewConfig: toInputJson({
        previewUrl: `/member/funnels/${ASSET_SLUG}/preview`,
      }),
    },
    select: {
      id: true,
    },
  });

  await tx.libraryFunnelVersion.upsert({
    where: {
      assetVersionId: version.id,
    },
    create: {
      assetVersionId: version.id,
      sourceFunnelInstanceId: input.sourceFunnelInstanceId,
      sourceFunnelId: input.sourceFunnelId,
      stepsCount: input.stepsCount,
      framework: 'wellness-evaluation',
      difficulty: 'basic',
      estimatedMinutes: 5,
      flowSummary: toInputJson([
        'captura',
        'presentacion',
        'confirmacion',
      ]),
    },
    update: {
      sourceFunnelInstanceId: input.sourceFunnelInstanceId,
      sourceFunnelId: input.sourceFunnelId,
      stepsCount: input.stepsCount,
      framework: 'wellness-evaluation',
      difficulty: 'basic',
      estimatedMinutes: 5,
      flowSummary: toInputJson([
        'captura',
        'presentacion',
        'confirmacion',
      ]),
    },
  });

  await tx.libraryMedia.deleteMany({
    where: {
      assetVersionId: version.id,
      mediaType: {
        in: [LibraryMediaType.thumbnail, LibraryMediaType.cover],
      },
    },
  });
  await tx.libraryMedia.createMany({
    data: [
      {
        assetVersionId: version.id,
        mediaType: LibraryMediaType.thumbnail,
        url: PLACEHOLDER_PREVIEW,
        altText: 'Vista previa de Evaluación de bienestar',
        sortOrder: 1,
      },
      {
        assetVersionId: version.id,
        mediaType: LibraryMediaType.cover,
        url: PLACEHOLDER_COVER,
        altText: 'Portada de Evaluación de bienestar',
        sortOrder: 2,
      },
    ],
  });

  return version.id;
};

const upsertMarketplaceTemplate = async (
  tx: SeedTransaction,
  input: {
    sourceFunnelInstanceId: string;
    sourceFunnelId: string;
    stepsCount: number;
    libraryAssetVersionId: string;
  },
) => {
  const staticTemplate = funnelArsenalTemplates.find(
    (template) => template.templateKey === ASSET_SLUG,
  );
  const blueprint = getBusinessBlueprintByKey('blueprint.health_wellness.v1');
  const existing = await tx.funnelArsenalTemplate.findFirst({
    where: {
      OR: [{ assetSlug: ASSET_SLUG }, { templateKey: ASSET_SLUG }],
    },
    select: {
      id: true,
    },
  });
  const data = {
    templateKey: ASSET_SLUG,
    assetSlug: ASSET_SLUG,
    blueprintKey:
      staticTemplate?.blueprintKey ?? 'blueprint.health_wellness.v1',
    vertical: blueprint?.vertical ?? 'health_wellness',
    objective: staticTemplate?.goal ?? 'Capturar solicitudes de evaluación.',
    language: 'es',
    label: 'Evaluación de bienestar',
    description: wellnessCopy.description,
    headline: wellnessCopy.headline,
    goal: staticTemplate?.goal ?? 'Capturar solicitudes de evaluación inicial.',
    recommendedFor:
      staticTemplate?.recommendedFor ??
      'Nutrición, fitness, terapias y centros de bienestar.',
    cta: wellnessCopy.cta,
    pathSuggestion: staticTemplate?.pathSuggestion ?? '/evaluacion',
    difficulty: staticTemplate?.difficulty ?? 'basic',
    status: FunnelArsenalTemplateStatus.active,
    stepsCount: input.stepsCount,
    coverUrl: PLACEHOLDER_COVER,
    thumbnailUrl: PLACEHOLDER_PREVIEW,
    screenshotsJson: toInputJson([PLACEHOLDER_PREVIEW]),
    flowSummaryJson: toInputJson([
      'captura',
      'presentacion',
      'confirmacion',
    ]),
    blocksPresetKey: staticTemplate?.blocksPresetKey ?? 'basic-lead-capture',
    sourceFunnelInstanceId: input.sourceFunnelInstanceId,
    sourceFunnelId: input.sourceFunnelId,
    libraryAssetVersionId: input.libraryAssetVersionId,
    publishedAt: new Date(),
  };

  return existing
    ? tx.funnelArsenalTemplate.update({
        where: {
          id: existing.id,
        },
        data,
        select: {
          id: true,
          templateKey: true,
          assetSlug: true,
          libraryAssetVersionId: true,
        },
      })
    : tx.funnelArsenalTemplate.create({
        data,
        select: {
          id: true,
          templateKey: true,
          assetSlug: true,
          libraryAssetVersionId: true,
        },
      });
};

const archiveExistingInternalMaster = async (
  prisma: PrismaClient,
  sourceFunnelInstanceId: string | null | undefined,
) => {
  if (!sourceFunnelInstanceId) {
    return;
  }

  const existing = await prisma.funnelInstance.findUnique({
    where: {
      id: sourceFunnelInstanceId,
    },
    select: {
      id: true,
      funnelId: true,
      team: {
        select: {
          code: true,
        },
      },
      workspace: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (
    !existing ||
    existing.team.code !== 'leadflow-arsenal-masters' ||
    existing.workspace.slug !== 'leadflow-arsenal'
  ) {
    return;
  }

  await prisma.funnelPublication.updateMany({
    where: {
      funnelInstanceId: existing.id,
    },
    data: {
      status: 'archived',
      isActive: false,
    },
  });
  await prisma.funnelInstance.update({
    where: {
      id: existing.id,
    },
    data: {
      status: 'archived',
    },
  });

  if (existing.funnelId) {
    await prisma.funnel.update({
      where: {
        id: existing.funnelId,
      },
      data: {
        status: 'archived',
      },
    });
  }
};

const validateCreatedMaster = async (
  prisma: PrismaClient,
  input: {
    funnelInstanceId: string;
    templateId: string;
  },
) => {
  const master = await prisma.funnelInstance.findUnique({
    where: {
      id: input.funnelInstanceId,
    },
    include: {
      funnel: true,
      steps: {
        orderBy: {
          position: 'asc',
        },
      },
      publications: true,
    },
  });

  if (!master?.funnelId || !master.funnel) {
    throw new Error('Created master is missing its Funnel builder link.');
  }

  if (master.steps.length < 2) {
    throw new Error('Created master must contain at least 2 steps.');
  }

  if (master.publications.length > 0) {
    throw new Error('Created master unexpectedly has FunnelPublication rows.');
  }

  if (
    master.rotationPoolId ||
    master.trackingProfileId ||
    master.handoffStrategyId
  ) {
    throw new Error('Created master unexpectedly copied ownership or tracking.');
  }

  const template = await prisma.funnelArsenalTemplate.findUnique({
    where: {
      id: input.templateId,
    },
    select: {
      sourceFunnelInstanceId: true,
      sourceFunnelId: true,
      assetSlug: true,
      templateKey: true,
      libraryAssetVersionId: true,
    },
  });

  if (
    template?.assetSlug !== ASSET_SLUG ||
    template.templateKey !== ASSET_SLUG ||
    template.sourceFunnelInstanceId !== master.id ||
    template.sourceFunnelId !== master.funnelId
  ) {
    throw new Error('FunnelArsenalTemplate was not associated to the master.');
  }

  const serialized = JSON.stringify({
    funnel: {
      name: master.funnel.name,
      description: master.funnel.description,
      code: master.funnel.code,
      thumbnailUrl: master.funnel.thumbnailUrl,
      config: master.funnel.config,
    },
    instance: {
      name: master.name,
      code: master.code,
      thumbnailUrl: master.thumbnailUrl,
      conversionContract: master.conversionContract,
      settingsJson: master.settingsJson,
      mediaMap: master.mediaMap,
    },
    steps: master.steps.map((step) => ({
      slug: step.slug,
      blocksJson: step.blocksJson,
      mediaMap: step.mediaMap,
      settingsJson: step.settingsJson,
    })),
  });
  const noForbiddenCopy = !containsForbiddenText(serialized);
  const noTrackingTokens =
    !/(metaCapiToken|tiktokAccessToken|accessToken|metaPixelId|pixelId)/i.test(
      serialized,
    );

  if (!noForbiddenCopy) {
    throw new Error('Created master still contains DXN/Freddy/source-domain copy.');
  }

  if (!noTrackingTokens) {
    throw new Error('Created master still contains tracking token fields.');
  }

  return {
    stepsCount: master.steps.length,
    marketplaceLibraryAssetVersionId: template.libraryAssetVersionId,
    confirmations: {
      noPublications: master.publications.length === 0,
      noDomainsCopied: master.publications.length === 0,
      noTrackingTokens,
      noForbiddenCopy,
    },
  };
};

const buildBuilderUrl = (teamId: string, funnelId: string) =>
  `/admin/tenants/${encodeURIComponent(teamId)}/funnels/${encodeURIComponent(
    funnelId,
  )}/builder`;

const buildPreviewUrl = () => `/member/funnels/${ASSET_SLUG}/preview`;

export const seedHealthWellnessMaster = async (
  prisma: PrismaClient,
  options: HealthWellnessSeedOptions = {},
): Promise<HealthWellnessSeedResult> => {
  const forceRecreate =
    options.forceRecreate ??
    process.env.FORCE_RECREATE_HEALTH_WELLNESS_MASTER === 'true';
  const logger = options.logger ?? console;
  const existingTemplate = await prisma.funnelArsenalTemplate.findFirst({
    where: {
      OR: [{ assetSlug: ASSET_SLUG }, { templateKey: ASSET_SLUG }],
    },
    select: {
      id: true,
      templateKey: true,
      assetSlug: true,
      sourceFunnelInstanceId: true,
      sourceFunnelId: true,
      libraryAssetVersionId: true,
    },
  });

  if (existingTemplate?.sourceFunnelInstanceId && !forceRecreate) {
    const existingMaster = await prisma.funnelInstance.findUnique({
      where: {
        id: existingTemplate.sourceFunnelInstanceId,
      },
      select: {
        id: true,
        funnelId: true,
        teamId: true,
        steps: {
          select: {
            id: true,
          },
        },
      },
    });

    if (existingMaster?.funnelId) {
      let libraryAssetVersionId = existingTemplate.libraryAssetVersionId;

      if (!libraryAssetVersionId) {
        const synced = await prisma.$transaction(async (tx) => {
          const versionId = await upsertLibraryVersion(tx, {
            sourceFunnelInstanceId: existingMaster.id,
            sourceFunnelId: existingMaster.funnelId!,
            stepsCount: existingMaster.steps.length,
          });
          const template = await upsertMarketplaceTemplate(tx, {
            sourceFunnelInstanceId: existingMaster.id,
            sourceFunnelId: existingMaster.funnelId!,
            stepsCount: existingMaster.steps.length,
            libraryAssetVersionId: versionId,
          });

          return {
            template,
            libraryAssetVersionId: versionId,
          };
        });
        libraryAssetVersionId =
          synced.template.libraryAssetVersionId ??
          synced.libraryAssetVersionId;
      }

      const validation = await validateCreatedMaster(prisma, {
        funnelInstanceId: existingMaster.id,
        templateId: existingTemplate.id,
      });

      logger.log('already linked');

      return {
        status: 'already_linked',
        sourceFunnelInstanceId: null,
        masterFunnelInstanceId: existingMaster.id,
        masterFunnelId: existingMaster.funnelId,
        templateId: existingTemplate.id,
        templateKey: existingTemplate.templateKey,
        assetSlug: existingTemplate.assetSlug ?? ASSET_SLUG,
        builderUrl: buildBuilderUrl(existingMaster.teamId, existingMaster.funnelId),
        previewUrl: buildPreviewUrl(),
        stepsCount: validation.stepsCount,
        marketplaceLibraryAssetVersionId:
          validation.marketplaceLibraryAssetVersionId ?? libraryAssetVersionId,
        confirmations: validation.confirmations,
      };
    }
  }

  if (forceRecreate && existingTemplate?.sourceFunnelInstanceId) {
    await archiveExistingInternalMaster(
      prisma,
      existingTemplate.sourceFunnelInstanceId,
    );
  }

  const source = await findSourceDxnFunnelInstance(prisma, {
    ...options,
    sourceFunnelInstanceId:
      options.sourceFunnelInstanceId ??
      process.env.SOURCE_DXN_FUNNEL_INSTANCE_ID ??
      null,
    logger,
  });
  const arsenal = await ensureLeadFlowArsenalWorkspace(prisma);
  const cloner = new FunnelMasterClonerService(prisma as never);

  const created = await prisma.$transaction(async (tx) => {
    const initialInstanceCode = await findUniqueFunnelInstanceCode(
      tx,
      arsenal.teamId,
      MASTER_INSTANCE_CODE,
    );
    const clone = await cloner.cloneMasterFunnelInstanceToTeamInTransaction(
      tx,
      {
        sourceFunnelInstanceId: source.id,
        targetWorkspaceId: arsenal.workspaceId,
        targetTeamId: arsenal.teamId,
        templateKey: ASSET_SLUG,
        blueprintKey: 'blueprint.health_wellness.v1',
        templateLabel: MASTER_NAME,
        templateDescription: wellnessCopy.description,
        instanceCode: initialInstanceCode,
        createPublication: false,
      },
    );

    await updateClonedMasterCopy(tx, {
      funnelId: clone.funnelId,
      funnelInstanceId: clone.funnelInstanceId,
      workspaceId: arsenal.workspaceId,
      teamId: arsenal.teamId,
    });

    const stepsCount = await tx.funnelStep.count({
      where: {
        funnelInstanceId: clone.funnelInstanceId,
      },
    });
    const libraryAssetVersionId = await upsertLibraryVersion(tx, {
      sourceFunnelInstanceId: clone.funnelInstanceId,
      sourceFunnelId: clone.funnelId,
      stepsCount,
    });
    const template = await upsertMarketplaceTemplate(tx, {
      sourceFunnelInstanceId: clone.funnelInstanceId,
      sourceFunnelId: clone.funnelId,
      stepsCount,
      libraryAssetVersionId,
    });

    return {
      clone,
      stepsCount,
      template,
    };
  });

  const validation = await validateCreatedMaster(prisma, {
    funnelInstanceId: created.clone.funnelInstanceId,
    templateId: created.template.id,
  });

  return {
    status: forceRecreate ? 'recreated' : 'created',
    sourceFunnelInstanceId: source.id,
    masterFunnelInstanceId: created.clone.funnelInstanceId,
    masterFunnelId: created.clone.funnelId,
    templateId: created.template.id,
    templateKey: created.template.templateKey,
    assetSlug: created.template.assetSlug ?? ASSET_SLUG,
    builderUrl: buildBuilderUrl(arsenal.teamId, created.clone.funnelId),
    previewUrl: buildPreviewUrl(),
    stepsCount: validation.stepsCount,
    marketplaceLibraryAssetVersionId:
      validation.marketplaceLibraryAssetVersionId,
    confirmations: validation.confirmations,
  };
};

export {
  ASSET_SLUG,
  MASTER_FUNNEL_CODE,
  MASTER_INSTANCE_CODE,
  MASTER_NAME,
  PLACEHOLDER_COVER,
  PLACEHOLDER_COACH,
  PLACEHOLDER_PREVIEW,
  SOURCE_DOMAIN,
  applyStepOverrides,
  containsForbiddenText,
  findSourceDxnFunnelInstance,
  sanitizeJson,
};
