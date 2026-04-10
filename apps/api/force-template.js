const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const TARGET_TEMPLATE_ID = 'jakawi-premium';
const TARGET_FUNNEL_NAME = 'Immunotec - Recuperación';
const TARGET_TEAM_CODE = 'immunotec';
const TARGET_TEAM_NAME = 'Immunotec';

async function findTargetInstanceIds() {
  const instancesByName = await prisma.funnelInstance.findMany({
    where: {
      name: TARGET_FUNNEL_NAME,
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
      `No se encontró el template ${TARGET_TEMPLATE_ID} para forzar la actualización.`,
    );
  }

  const targetInstanceIds = await findTargetInstanceIds();

  if (targetInstanceIds.length === 0) {
    throw new Error(
      `No se encontraron publicaciones o funnels de Immunotec para forzar el template ${TARGET_TEMPLATE_ID}.`,
    );
  }

  await prisma.funnelInstance.updateMany({
    where: {
      id: {
        in: targetInstanceIds,
      },
    },
    data: {
      templateId: TARGET_TEMPLATE_ID,
    },
  });

  console.log('Template Jakawi Premium forzado con éxito');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
