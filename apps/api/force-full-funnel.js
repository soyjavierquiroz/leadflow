const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TARGET_TEMPLATE_ID = 'jakawi-premium';
const TARGET_FUNNEL_NAME = 'Immunotec - Recuperación';
const TARGET_TEAM_CODE = 'immunotec';
const TARGET_TEAM_NAME = 'Immunotec';
const TARGET_BLOCKS_JSON = [
  {
    type: 'split_hero_content',
    badge: '⚠️ !ATENCIÓN! SI NADA TE HA FUNCIONADO, ESTO ES DIFERENTE',
    headline: 'Recupera tu Vitalidad y Construye Ingresos Extra con Immunotec',
    subheadline:
      'Descubre el respaldo científico del glutatión que está cambiando vidas.',
    ctaText: 'Ver presentación en video',
    mediaKey: 'hero',
  },
  {
    type: 'lead_capture_form',
    title: 'Da el primer paso hacia tu recuperación',
    headline: 'Solicita tu asesoría personalizada',
    button_text: 'Quiero más información',
    success_action: 'next_step',
    fields: [
      {
        name: 'fullName',
        type: 'text',
        label: 'Nombre completo',
        required: true,
      },
      {
        name: 'email',
        type: 'email',
        label: 'Correo electrónico',
        required: true,
      },
      {
        name: 'phone',
        type: 'tel',
        label: 'Teléfono',
        required: true,
      },
    ],
  },
];

function asObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value;
}

function mergeInstanceSettings(existingSettings) {
  const safeSettings = asObject(existingSettings);
  const safeHybridEditor = asObject(safeSettings.hybridEditor);

  return {
    ...safeSettings,
    theme: TARGET_TEMPLATE_ID,
    hybridEditor: {
      ...safeHybridEditor,
      mode: 'data-driven-assembly',
      templateId: TARGET_TEMPLATE_ID,
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
    hybridRenderer: 'jakawi-bridge',
    blocksJson: TARGET_BLOCKS_JSON,
  };
}

async function findTargetInstanceIds() {
  const instancesByName = await prisma.funnelInstance.findMany({
    where: {
      name: TARGET_FUNNEL_NAME,
      publications: {
        some: {},
      },
    },
    select: {
      id: true,
    },
  });

  if (instancesByName.length > 0) {
    return instancesByName.map((instance) => instance.id);
  }

  const tenantInstances = await prisma.funnelInstance.findMany({
    where: {
      team: {
        OR: [{ code: TARGET_TEAM_CODE }, { name: TARGET_TEAM_NAME }],
      },
      publications: {
        some: {},
      },
    },
    select: {
      id: true,
    },
  });

  return tenantInstances.map((instance) => instance.id);
}

async function main() {
  const template = await prisma.funnelTemplate.findUnique({
    where: {
      id: TARGET_TEMPLATE_ID,
    },
    select: {
      id: true,
    },
  });

  if (!template) {
    throw new Error(
      `No se encontró el template ${TARGET_TEMPLATE_ID} para forzar el funnel completo.`,
    );
  }

  const targetInstanceIds = await findTargetInstanceIds();

  if (targetInstanceIds.length === 0) {
    throw new Error(
      `No se encontraron publicaciones o funnels para ${TARGET_FUNNEL_NAME}.`,
    );
  }

  const instances = await prisma.funnelInstance.findMany({
    where: {
      id: {
        in: targetInstanceIds,
      },
    },
    select: {
      id: true,
      workspaceId: true,
      teamId: true,
      settingsJson: true,
      publications: {
        select: {
          id: true,
          status: true,
          isActive: true,
          isPrimary: true,
          pathPrefix: true,
        },
      },
      steps: {
        select: {
          id: true,
          slug: true,
          stepType: true,
          settingsJson: true,
        },
      },
    },
  });

  if (instances.length === 0) {
    throw new Error(
      `No se pudieron cargar las instancias objetivo para ${TARGET_FUNNEL_NAME}.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const instance of instances) {
      const landingStep = instance.steps.find(
        (step) => step.stepType === 'landing' || step.slug === 'landing',
      );

      if (!landingStep) {
        throw new Error(
          `La instancia ${instance.id} no tiene un landing step para forzar blocksJson.`,
        );
      }

      await tx.funnelInstance.update({
        where: {
          id: instance.id,
        },
        data: {
          templateId: TARGET_TEMPLATE_ID,
          settingsJson: mergeInstanceSettings(instance.settingsJson),
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

      if (instance.publications.length > 0) {
        await tx.funnelPublication.updateMany({
          where: {
            id: {
              in: instance.publications.map((publication) => publication.id),
            },
          },
          data: {
            status: 'active',
            isActive: true,
          },
        });
      }
    }
  });

  console.log('Inyeccion Nuclear Exitosa');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
