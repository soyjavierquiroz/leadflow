import { PrismaClient } from '@prisma/client';
import { seedHealthWellnessMaster } from './seed-master-health-wellness.lib';

const isHelp = process.argv.includes('--help') || process.argv.includes('-h');

if (isHelp) {
  console.log(
    [
      'Usage: pnpm --filter @leadflow/api seed:master-health-wellness',
      '',
      'Creates or reuses the health-wellness-evaluation Master Funnel by cloning the healthiest DXN source funnel.',
      '',
      'Optional env:',
      '  SOURCE_DXN_FUNNEL_INSTANCE_ID=<id>',
      '  FORCE_RECREATE_HEALTH_WELLNESS_MASTER=true',
    ].join('\n'),
  );
  process.exit(0);
}

const main = async () => {
  const prisma = new PrismaClient();

  try {
    const result = await seedHealthWellnessMaster(prisma);

    console.log(
      JSON.stringify(
        {
          status: result.status,
          sourceFunnelInstanceId: result.sourceFunnelInstanceId,
          masterFunnelInstanceId: result.masterFunnelInstanceId,
          masterFunnelId: result.masterFunnelId,
          templateId: result.templateId,
          templateKey: result.templateKey,
          assetSlug: result.assetSlug,
          builderUrl: result.builderUrl,
          previewUrl: result.previewUrl,
          stepsCount: result.stepsCount,
          libraryAssetVersionId: result.marketplaceLibraryAssetVersionId,
          confirmations: result.confirmations,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
