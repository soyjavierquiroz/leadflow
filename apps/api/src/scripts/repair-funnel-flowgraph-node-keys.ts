import { PrismaClient } from '@prisma/client';
import { repairFunnelFlowGraphNodeKeys } from './repair-funnel-flowgraph-node-keys.lib';

const isHelp = process.argv.includes('--help') || process.argv.includes('-h');

if (isHelp) {
  console.log(
    [
      'Usage: FUNNEL_INSTANCE_ID=<id> pnpm --filter @leadflow/api repair:funnel-flowgraph-node-keys',
      '',
      'Without FUNNEL_INSTANCE_ID, scans arsenal/marketplace clone candidates and repairs FlowGraph node keys when node.stepId points at current FunnelStep ids.',
    ].join('\n'),
  );
  process.exit(0);
}

const main = async () => {
  const prisma = new PrismaClient();

  try {
    const result = await repairFunnelFlowGraphNodeKeys(prisma as never, {
      funnelInstanceId: process.env.FUNNEL_INSTANCE_ID ?? null,
    });

    console.log(
      JSON.stringify(
        {
          repairedCount: result.filter((item) => item.changed).length,
          checkedCount: result.length,
          results: result,
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
