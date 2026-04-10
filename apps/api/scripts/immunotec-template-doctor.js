const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TARGET_TEMPLATE_ID = 'jakawi-premium';
const TARGET_STRUCTURE_ID = 'split-media-focus';
const TARGET_TEAM_CODE = 'immunotec';
const TARGET_TEAM_NAME = 'Immunotec';
const TARGET_FUNNEL_NAME = 'Immunotec - Recuperación';
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

const TEMPLATE_BLOCKS = [
  {
    type: 'hero',
    key: 'hero-main',
    eyebrow: 'Jakawi Premium',
    title:
      'Funnel editorial premium listo para captar y convertir con una capa visual unificada',
    description:
      'Plantilla oficial del sistema para experiencias premium con layout sticky, narrativa comercial y captura integrada.',
  },
  {
    type: 'hook_and_promise',
    key: 'hook-main',
    eyebrow: 'Premium Funnel Engine',
    hook: 'Convierte tráfico frío en sesiones editoriales con estructura premium, media fija y una propuesta de valor más clara.',
    promise:
      'Jakawi Premium unifica identidad visual, bloques comerciales y captura en un runtime consistente para iterar sin deuda visual.',
  },
  {
    type: 'lead_capture_form',
    key: 'template-capture-form',
    eyebrow: 'Premium Capture Block',
    headline: 'Solicita acceso a la experiencia premium',
    subheadline:
      'Bloque oficial para capturar contexto comercial dentro del sistema premium sin romper el runtime compartido.',
    button_text: 'Quiero continuar',
    helper_text:
      'Completa tu información para activar el siguiente paso del funnel premium.',
    privacy_note:
      'Usamos esta información para procesar tu solicitud y continuar la conversación comercial dentro del funnel premium.',
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
      {
        name: 'utm_source',
        label: 'UTM Source',
        type: 'hidden',
        hidden: true,
      },
    ],
    settings: {
      capture_url_context: true,
      source_channel: 'form',
      tags: ['jakawi-premium', 'lead-capture-form-v1'],
    },
  },
];

const IMMUNOTEC_BLOCKS = [
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

const DEFAULT_MEDIA_MAP = {
  heroImage:
    'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80',
};

const hasBlocksArrayShape = (value) => Array.isArray(value);

const asObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value;
};

const quoteIdentifier = (identifier) => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Identificador SQL no permitido: ${identifier}`);
  }

  return `"${identifier}"`;
};

const buildTemplateSettings = (currentValue) => {
  const current = asObject(currentValue);

  return {
    ...current,
    theme: TARGET_TEMPLATE_ID,
    locale: 'es',
    structureId: TARGET_STRUCTURE_ID,
  };
};

const buildAllowedOverrides = (currentValue) => {
  const current = asObject(currentValue);
  const currentEditableFields = Array.isArray(current.editableFields)
    ? current.editableFields.filter((item) => typeof item === 'string')
    : [];
  const editableFields = Array.from(
    new Set([
      ...currentEditableFields,
      'hero',
      'hook_and_promise',
      'social_proof',
      'feature_grid',
      'lead_capture_form',
      'offer_pricing',
      'faq',
      'media',
    ]),
  );

  return {
    ...current,
    editableFields,
  };
};

const buildInstanceSettings = (currentValue, funnelName) => {
  const current = asObject(currentValue);
  const currentSeo = asObject(current.seo);
  const currentHybridEditor = asObject(current.hybridEditor);

  return {
    ...current,
    theme: TARGET_TEMPLATE_ID,
    locale: 'es',
    structureId: TARGET_STRUCTURE_ID,
    hybridEditor: {
      ...currentHybridEditor,
      mode: 'data-driven-assembly',
      templateId: TARGET_TEMPLATE_ID,
      structureId: TARGET_STRUCTURE_ID,
      blocksJson: IMMUNOTEC_BLOCKS,
    },
    seo: {
      title: currentSeo.title || funnelName || TARGET_FUNNEL_NAME,
      metaDescription:
        currentSeo.metaDescription ||
        'Publicación ancla de recuperación para Immunotec dentro de Leadflow.',
    },
  };
};

const buildStepSettings = (currentValue, funnelName) => {
  const current = asObject(currentValue);
  const currentSeo = asObject(current.seo);

  return {
    ...current,
    editorSource: 'team-publications-new-vsl',
    templateId: TARGET_TEMPLATE_ID,
    templateCode: TARGET_TEMPLATE_ID,
    structureId: TARGET_STRUCTURE_ID,
    hybridRenderer: 'jakawi-bridge',
    blocksJson: IMMUNOTEC_BLOCKS,
    seo: {
      title: currentSeo.title || funnelName || TARGET_FUNNEL_NAME,
      metaDescription:
        currentSeo.metaDescription ||
        'Publicación ancla de recuperación para Immunotec dentro de Leadflow.',
    },
  };
};

const buildPublicationSnapshot = (currentValue, funnelName) => {
  const current = asObject(currentValue);
  const currentSeo = asObject(current.seo);
  const currentHybridEditor = asObject(current.hybridEditor);
  const currentContent = asObject(current.content);

  return {
    ...current,
    templateId: TARGET_TEMPLATE_ID,
    structureId: TARGET_STRUCTURE_ID,
    blocksJson: IMMUNOTEC_BLOCKS,
    hybridEditor: {
      ...currentHybridEditor,
      mode: 'data-driven-assembly',
      templateId: TARGET_TEMPLATE_ID,
      structureId: TARGET_STRUCTURE_ID,
      blocksJson: IMMUNOTEC_BLOCKS,
    },
    content: {
      ...currentContent,
      templateId: TARGET_TEMPLATE_ID,
      structureId: TARGET_STRUCTURE_ID,
      blocksJson: IMMUNOTEC_BLOCKS,
    },
    seo: {
      ...currentSeo,
      title: currentSeo.title || funnelName || TARGET_FUNNEL_NAME,
      metaDescription:
        currentSeo.metaDescription ||
        'Publicación ancla de recuperación para Immunotec dentro de Leadflow.',
    },
  };
};

async function getPublicationJsonColumns() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'FunnelPublication'
      AND data_type IN ('json', 'jsonb')
    ORDER BY ordinal_position
  `);

  return rows.map((row) => row.column_name);
}

async function collectState() {
  const teams = await prisma.team.findMany({
    where: {
      OR: [{ code: TARGET_TEAM_CODE }, { name: TARGET_TEAM_NAME }],
    },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      code: true,
      status: true,
    },
    orderBy: [{ createdAt: 'asc' }],
  });

  const workspaceIds = Array.from(
    new Set(teams.map((team) => team.workspaceId).filter(Boolean)),
  );

  const template = await prisma.funnelTemplate.findFirst({
    where: {
      OR: [{ id: TARGET_TEMPLATE_ID }, { code: TARGET_TEMPLATE_ID }],
    },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      code: true,
      status: true,
      funnelType: true,
      version: true,
      blocksJson: true,
      mediaMap: true,
      settingsJson: true,
      allowedOverridesJson: true,
      defaultHandoffStrategyId: true,
      updatedAt: true,
    },
  });

  const domains = teams.length
    ? await prisma.domain.findMany({
        where: {
          teamId: {
            in: teams.map((team) => team.id),
          },
        },
        select: {
          id: true,
          teamId: true,
          host: true,
          status: true,
          linkedFunnelId: true,
          isPrimary: true,
        },
        orderBy: [{ createdAt: 'asc' }],
      })
    : [];

  const instances = teams.length
    ? await prisma.funnelInstance.findMany({
        where: {
          teamId: {
            in: teams.map((team) => team.id),
          },
        },
        include: {
          template: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          publications: {
            select: {
              id: true,
              domainId: true,
              pathPrefix: true,
              status: true,
              isPrimary: true,
              isActive: true,
            },
            orderBy: [{ updatedAt: 'desc' }],
          },
          steps: {
            select: {
              id: true,
              slug: true,
              stepType: true,
              position: true,
              isEntryStep: true,
              blocksJson: true,
              mediaMap: true,
              settingsJson: true,
            },
            orderBy: [{ position: 'asc' }],
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
      })
    : [];

  const publications = instances.flatMap((instance) =>
    instance.publications.map((publication) => ({
      ...publication,
      funnelInstanceId: instance.id,
      instanceName: instance.name,
      templateId: instance.templateId,
    })),
  );

  const publicationJsonColumns = await getPublicationJsonColumns();

  return {
    teams,
    workspaceIds,
    template,
    domains,
    instances,
    publications,
    publicationJsonColumns,
  };
}

function buildSummary(state) {
  const teamWorkspaceIds = new Set(state.workspaceIds);
  const templateAvailableForTeams =
    state.template &&
    (state.template.workspaceId === null ||
      teamWorkspaceIds.has(state.template.workspaceId));

  return {
    target: {
      templateId: TARGET_TEMPLATE_ID,
      structureId: TARGET_STRUCTURE_ID,
      funnelName: TARGET_FUNNEL_NAME,
      teamCode: TARGET_TEAM_CODE,
    },
    checks: {
      teamFound: state.teams.length > 0,
      templateFound: Boolean(state.template),
      templateAvailableForTeams: Boolean(templateAvailableForTeams),
      templateBlocksAreArray: hasBlocksArrayShape(state.template?.blocksJson),
      activePublicationFound: state.publications.some(
        (publication) =>
          publication.status === 'active' && publication.isActive,
      ),
      publicationSnapshotColumns: state.publicationJsonColumns,
    },
    teams: state.teams,
    template: state.template
      ? {
          id: state.template.id,
          workspaceId: state.template.workspaceId,
          name: state.template.name,
          code: state.template.code,
          status: state.template.status,
          funnelType: state.template.funnelType,
          version: state.template.version,
          blocksShape: Array.isArray(state.template.blocksJson)
            ? `array:${state.template.blocksJson.length}`
            : typeof state.template.blocksJson,
          updatedAt: state.template.updatedAt.toISOString(),
        }
      : null,
    domains: state.domains,
    instances: state.instances.map((instance) => ({
      id: instance.id,
      teamId: instance.teamId,
      name: instance.name,
      code: instance.code,
      status: instance.status,
      templateId: instance.templateId,
      templateCode: instance.template?.code ?? null,
      templateName: instance.template?.name ?? null,
      publicationCount: instance.publications.length,
      entryStepBlocksShape: Array.isArray(
        instance.steps.find((step) => step.isEntryStep)?.blocksJson,
      )
        ? `array:${instance.steps.find((step) => step.isEntryStep).blocksJson.length}`
        : typeof instance.steps.find((step) => step.isEntryStep)?.blocksJson,
    })),
  };
}

async function repairTemplate(state) {
  if (state.teams.length === 0) {
    throw new Error(
      `No se encontró el tenant ${TARGET_TEAM_NAME} (${TARGET_TEAM_CODE}) para aplicar la reparación.`,
    );
  }

  const existingByCode = state.template;

  if (
    existingByCode &&
    existingByCode.code === TARGET_TEMPLATE_ID &&
    existingByCode.id !== TARGET_TEMPLATE_ID
  ) {
    throw new Error(
      `Existe un FunnelTemplate con code=${TARGET_TEMPLATE_ID} pero id=${existingByCode.id}. Corrige ese conflicto manualmente antes de continuar.`,
    );
  }

  await prisma.funnelTemplate.upsert({
    where: { id: TARGET_TEMPLATE_ID },
    update: {
      workspaceId: null,
      name: 'Jakawi Premium',
      description: 'Template visual premium oficial para funnels editoriales.',
      code: TARGET_TEMPLATE_ID,
      status: 'active',
      version: existingByCode?.version ?? 1,
      funnelType: 'hybrid',
      blocksJson: TEMPLATE_BLOCKS,
      mediaMap: {
        ...asObject(existingByCode?.mediaMap),
        ...DEFAULT_MEDIA_MAP,
      },
      settingsJson: buildTemplateSettings(existingByCode?.settingsJson),
      allowedOverridesJson: buildAllowedOverrides(
        existingByCode?.allowedOverridesJson,
      ),
      defaultHandoffStrategyId:
        existingByCode?.defaultHandoffStrategyId ?? null,
    },
    create: {
      id: TARGET_TEMPLATE_ID,
      workspaceId: null,
      name: 'Jakawi Premium',
      description: 'Template visual premium oficial para funnels editoriales.',
      code: TARGET_TEMPLATE_ID,
      status: 'active',
      version: 1,
      funnelType: 'hybrid',
      blocksJson: TEMPLATE_BLOCKS,
      mediaMap: DEFAULT_MEDIA_MAP,
      settingsJson: buildTemplateSettings({}),
      allowedOverridesJson: buildAllowedOverrides({}),
      defaultHandoffStrategyId: null,
    },
  });
}

async function repairImmunotecInstances(state) {
  for (const instance of state.instances) {
    const entryStep =
      instance.steps.find((step) => step.isEntryStep) ??
      instance.steps[0] ??
      null;

    await prisma.$transaction(async (tx) => {
      await tx.funnelInstance.update({
        where: { id: instance.id },
        data: {
          templateId: TARGET_TEMPLATE_ID,
          status: 'active',
          settingsJson: buildInstanceSettings(
            instance.settingsJson,
            instance.name,
          ),
          mediaMap: {
            ...asObject(instance.mediaMap),
            ...DEFAULT_MEDIA_MAP,
          },
        },
      });

      if (instance.legacyFunnelId) {
        await tx.funnel.update({
          where: { id: instance.legacyFunnelId },
          data: {
            status: 'active',
            config: {
              structureId: TARGET_STRUCTURE_ID,
              templateId: TARGET_TEMPLATE_ID,
            },
          },
        });
      }

      if (entryStep) {
        await tx.funnelStep.update({
          where: { id: entryStep.id },
          data: {
            blocksJson: Array.isArray(entryStep.blocksJson)
              ? entryStep.blocksJson
              : IMMUNOTEC_BLOCKS,
            mediaMap: {
              ...asObject(entryStep.mediaMap),
              ...DEFAULT_MEDIA_MAP,
            },
            settingsJson: buildStepSettings(
              entryStep.settingsJson,
              instance.name,
            ),
          },
        });
      }

      for (const publication of instance.publications) {
        await tx.funnelPublication.update({
          where: { id: publication.id },
          data: {
            status: 'active',
            isActive: true,
          },
        });
      }
    });
  }
}

async function repairPublicationSnapshots(state) {
  const eligibleColumns = SNAPSHOT_COLUMN_PRIORITY.filter((columnName) =>
    state.publicationJsonColumns.includes(columnName),
  );

  for (const publication of state.publications) {
    for (const columnName of eligibleColumns) {
      const quotedColumn = quoteIdentifier(columnName);
      const currentRows = await prisma.$queryRawUnsafe(
        `SELECT ${quotedColumn} AS value FROM "FunnelPublication" WHERE "id" = $1 LIMIT 1`,
        publication.id,
      );

      const currentValue = currentRows[0]?.value ?? null;
      const nextValue =
        columnName === 'blocksJson'
          ? IMMUNOTEC_BLOCKS
          : buildPublicationSnapshot(currentValue, publication.instanceName);

      await prisma.$executeRawUnsafe(
        `UPDATE "FunnelPublication" SET ${quotedColumn} = $1::jsonb, "updatedAt" = NOW() WHERE "id" = $2`,
        JSON.stringify(nextValue),
        publication.id,
      );
    }
  }
}

async function main() {
  const shouldRepair = process.argv.includes('--repair');

  const initialState = await collectState();
  const initialSummary = buildSummary(initialState);

  console.log(
    JSON.stringify(
      {
        mode: shouldRepair ? 'repair' : 'diagnostic',
        before: initialSummary,
      },
      null,
      2,
    ),
  );

  if (!shouldRepair) {
    return;
  }

  await repairTemplate(initialState);
  const stateAfterTemplate = await collectState();
  await repairImmunotecInstances(stateAfterTemplate);
  const stateAfterInstances = await collectState();
  await repairPublicationSnapshots(stateAfterInstances);
  const finalState = await collectState();

  console.log(
    JSON.stringify(
      {
        mode: 'repair',
        after: buildSummary(finalState),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
