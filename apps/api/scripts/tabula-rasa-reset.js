const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function tableExists(client, tableName) {
  const rows = await client.$queryRawUnsafe(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS "exists"
    `,
    tableName,
  );

  return Boolean(rows?.[0]?.exists);
}

async function deleteLegacyEdgesIfPresent(client) {
  const exists = await tableExists(client, 'FunnelEdge');

  if (!exists) {
    return 0;
  }

  const deleted = await client.$executeRawUnsafe('DELETE FROM "FunnelEdge"');
  return Number(deleted ?? 0);
}

async function main() {
  const summary = await prisma.$transaction(async (tx) => {
    const deletedPublications = await tx.funnelPublication.deleteMany({});
    const deletedSteps = await tx.funnelStep.deleteMany({});
    const deletedEdges = await deleteLegacyEdgesIfPresent(tx);
    const deletedInstances = await tx.funnelInstance.deleteMany({});
    const deletedTemplates = await tx.funnelTemplate.deleteMany({});
    const deletedLegacyTemplateFunnels = await tx.funnel.deleteMany({
      where: {
        isTemplate: true,
        defaultTeamId: null,
      },
    });

    return {
      funnelPublications: deletedPublications.count,
      funnelSteps: deletedSteps.count,
      funnelEdges: deletedEdges,
      funnelInstances: deletedInstances.count,
      funnelTemplates: deletedTemplates.count,
      legacyTemplateFunnels: deletedLegacyTemplateFunnels.count,
    };
  });

  console.log(
    JSON.stringify(
      {
        mode: 'tabula-rasa',
        deleted: summary,
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
