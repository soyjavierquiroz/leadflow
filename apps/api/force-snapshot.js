const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TARGET_PUBLICATION_ID = '5d7c1b96-6a12-416a-a421-d105502e3008';
const TARGET_TEMPLATE_ID = 'jakawi-premium';
const TARGET_STRUCTURE_ID = 'split-media-focus';
const TARGET_FUNNEL_NAME = 'Immunotec - Recuperación';
const TARGET_TEAM_CODE = 'immunotec';
const TARGET_TEAM_NAME = 'Immunotec';
const DRY_RUN = process.argv.includes('--dry-run');

const TARGET_BLOCKS_JSON = [
  {
    type: 'hero',
    key: 'immunotec-recuperacion-hero',
    eyebrow: 'Immunotec',
    title: 'Recupera tu energía y vuelve a enfocarte en tu bienestar',
    description:
      'Publicación ancla de Immunotec para la etapa de recuperación con narrativa clara y captura integrada.',
  },
  {
    type: 'lead_capture_form',
    key: 'immunotec-recuperacion-form',
    eyebrow: 'Quiero más información',
    headline: 'Solicita acompañamiento para tu proceso de recuperación',
    subheadline:
      'Déjanos tus datos y te contactaremos con la siguiente recomendación.',
    button_text: 'Quiero empezar',
    helper_text:
      'Usaremos esta información para continuar tu proceso dentro de Leadflow.',
    success_mode: 'next_step',
    fields: [
      {
        name: 'fullName',
        label: 'Nombre completo',
        type: 'text',
        required: true,
        placeholder: 'Tu nombre completo',
        autocomplete: 'name',
        width: 'full',
      },
      {
        name: 'phone',
        label: 'WhatsApp',
        type: 'tel',
        required: false,
        placeholder: '+52 55 0000 0000',
        autocomplete: 'tel',
        width: 'half',
      },
      {
        name: 'email',
        label: 'Email',
        type: 'email',
        required: false,
        placeholder: 'tu@email.com',
        autocomplete: 'email',
        width: 'half',
      },
    ],
  },
];

const SNAPSHOT_COLUMN_PRIORITY = [
  'publishedData',
  'publishedJson',
  'snapshotJson',
  'snapshot',
  'contentJson',
  'payloadJson',
  'publicationJson',
  'runtimeJson',
  'renderJson',
  'blocksJson',
  'settingsJson',
];

function asObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value;
}

function quoteIdentifier(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Identificador SQL no permitido: ${identifier}`);
  }

  return `"${identifier}"`;
}

function mergeInstanceSettings(existingSettings) {
  const safeSettings = asObject(existingSettings);
  const safeHybridEditor = asObject(safeSettings.hybridEditor);

  return {
    ...safeSettings,
    theme: TARGET_TEMPLATE_ID,
    structureId: TARGET_STRUCTURE_ID,
    hybridEditor: {
      ...safeHybridEditor,
      mode: 'data-driven-assembly',
      templateId: TARGET_TEMPLATE_ID,
      structureId: TARGET_STRUCTURE_ID,
      blocksJson: TARGET_BLOCKS_JSON,
    },
  };
}

function mergeStepSettings(existingSettings) {
  const safeSettings = asObject(existingSettings);

  return {
    ...safeSettings,
    templateId: TARGET_TEMPLATE_ID,
    templateCode: TARGET_TEMPLATE_ID,
    structureId: TARGET_STRUCTURE_ID,
    hybridRenderer: 'jakawi-bridge',
    blocksJson: TARGET_BLOCKS_JSON,
  };
}

function buildPublicationSnapshot(existingValue) {
  const safeValue = asObject(existingValue);
  const safeSeo = asObject(safeValue.seo);
  const safeContent = asObject(safeValue.content);
  const safeHybridEditor = asObject(safeValue.hybridEditor);

  return {
    ...safeValue,
    templateId: TARGET_TEMPLATE_ID,
    structureId: TARGET_STRUCTURE_ID,
    blocksJson: TARGET_BLOCKS_JSON,
    hybridEditor: {
      ...safeHybridEditor,
      mode: 'data-driven-assembly',
      templateId: TARGET_TEMPLATE_ID,
      structureId: TARGET_STRUCTURE_ID,
      blocksJson: TARGET_BLOCKS_JSON,
    },
    content: {
      ...safeContent,
      templateId: TARGET_TEMPLATE_ID,
      structureId: TARGET_STRUCTURE_ID,
      blocksJson: TARGET_BLOCKS_JSON,
    },
    seo: {
      ...safeSeo,
      title: safeSeo.title ?? TARGET_FUNNEL_NAME,
    },
  };
}

async function getPublicationJsonColumns() {
  const rows = await prisma.$queryRawUnsafe(
    `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'FunnelPublication'
        AND data_type IN ('json', 'jsonb')
      ORDER BY ordinal_position
    `,
  );

  return rows.map((row) => row.column_name);
}

async function findTargetPublication() {
  const include = {
    team: {
      select: {
        id: true,
        code: true,
        name: true,
      },
    },
    domain: {
      select: {
        id: true,
        host: true,
      },
    },
    funnelInstance: {
      include: {
        steps: {
          orderBy: {
            position: 'asc',
          },
        },
      },
    },
  };

  const publicationById = await prisma.funnelPublication.findUnique({
    where: {
      id: TARGET_PUBLICATION_ID,
    },
    include,
  });

  if (publicationById) {
    return publicationById;
  }

  return prisma.funnelPublication.findFirst({
    where: {
      status: 'active',
      isActive: true,
      team: {
        OR: [
          { code: TARGET_TEAM_CODE },
          { name: TARGET_TEAM_NAME },
        ],
      },
    },
    include,
    orderBy: [
      {
        updatedAt: 'desc',
      },
    ],
  });
}

function resolveLandingStep(publication) {
  return (
    publication.funnelInstance.steps.find((step) => step.isEntryStep) ??
    publication.funnelInstance.steps.find(
      (step) => step.stepType === 'landing' || step.slug === 'landing',
    ) ??
    publication.funnelInstance.steps[0] ??
    null
  );
}

async function injectPublicationSnapshotColumns(publicationId) {
  const publicationJsonColumns = await getPublicationJsonColumns();
  const prioritizedColumns = SNAPSHOT_COLUMN_PRIORITY.filter((columnName) =>
    publicationJsonColumns.includes(columnName),
  );

  const updatedColumns = [];

  for (const columnName of prioritizedColumns) {
    const quotedColumn = quoteIdentifier(columnName);
    const currentRows = await prisma.$queryRawUnsafe(
      `SELECT ${quotedColumn} AS value FROM "FunnelPublication" WHERE "id" = $1 LIMIT 1`,
      publicationId,
    );

    const currentValue = currentRows[0]?.value ?? null;
    const nextValue =
      columnName === 'blocksJson'
        ? TARGET_BLOCKS_JSON
        : buildPublicationSnapshot(currentValue);

    updatedColumns.push(columnName);

    if (DRY_RUN) {
      continue;
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "FunnelPublication" SET ${quotedColumn} = $1::jsonb, "updatedAt" = NOW() WHERE "id" = $2`,
      JSON.stringify(nextValue),
      publicationId,
    );
  }

  return updatedColumns;
}

async function forceRuntimeEquivalent(publication, landingStep) {
  if (DRY_RUN) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.funnelPublication.update({
      where: {
        id: publication.id,
      },
      data: {
        status: 'active',
        isActive: true,
        handoffStrategyId: publication.handoffStrategyId ?? null,
      },
    });

    await tx.funnelInstance.update({
      where: {
        id: publication.funnelInstance.id,
      },
      data: {
        templateId: TARGET_TEMPLATE_ID,
        settingsJson: mergeInstanceSettings(publication.funnelInstance.settingsJson),
      },
    });

    await tx.funnelStep.update({
      where: {
        id: landingStep.id,
      },
      data: {
        blocksJson: TARGET_BLOCKS_JSON,
        settingsJson: mergeStepSettings(landingStep.settingsJson),
      },
    });
  });
}

async function main() {
  const publication = await findTargetPublication();

  if (!publication) {
    throw new Error(
      `No se encontró la publicación ${TARGET_PUBLICATION_ID} ni una publicación activa de ${TARGET_TEAM_NAME}.`,
    );
  }

  const landingStep = resolveLandingStep(publication);

  if (!landingStep) {
    throw new Error(
      `La publicación ${publication.id} no tiene un landing step que pueda actuar como runtime target.`,
    );
  }

  const updatedPublicationSnapshotColumns =
    await injectPublicationSnapshotColumns(publication.id);

  await forceRuntimeEquivalent(publication, landingStep);

  if (DRY_RUN) {
    console.log(
      JSON.stringify(
        {
          publicationId: publication.id,
          domainHost: publication.domain.host,
          funnelInstanceId: publication.funnelInstance.id,
          landingStepId: landingStep.id,
          updatedPublicationSnapshotColumns,
          fallbackRuntimeTarget: {
            funnelInstanceTemplateId: TARGET_TEMPLATE_ID,
            landingStepStructureId: TARGET_STRUCTURE_ID,
            blocksLength: TARGET_BLOCKS_JSON.length,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log('Snapshot de Publicacion inyectado y listo');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
