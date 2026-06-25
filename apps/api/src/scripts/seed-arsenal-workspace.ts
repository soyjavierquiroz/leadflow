import { PrismaClient } from '@prisma/client';
import {
  ARSENAL_TEAM_CODE,
  ARSENAL_WORKSPACE_SLUG,
  ensureLeadFlowArsenalWorkspace,
} from '../modules/funnel-arsenal/leadflow-arsenal-workspace';

const isHelp = process.argv.includes('--help') || process.argv.includes('-h');

if (isHelp) {
  console.log(
    [
      'Usage: pnpm --filter @leadflow/api seed:arsenal-workspace',
      '',
      'Creates or reuses the internal LeadFlow Arsenal workspace/team.',
      'This is a technical location for master funnels, not commercial ownership.',
    ].join('\n'),
  );
  process.exit(0);
}

const main = async () => {
  const prisma = new PrismaClient();

  try {
    const { workspaceId, teamId } =
      await ensureLeadFlowArsenalWorkspace(prisma);

    console.log(
      `LeadFlow Arsenal workspace ready: workspace=${ARSENAL_WORKSPACE_SLUG} (${workspaceId}), team=${ARSENAL_TEAM_CODE} (${teamId})`,
    );
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
