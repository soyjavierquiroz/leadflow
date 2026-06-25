import { PrismaClient } from '@prisma/client';

const ARSENAL_WORKSPACE_SLUG = 'leadflow-arsenal';
const ARSENAL_TEAM_CODE = 'leadflow-arsenal-masters';

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
    const workspace = await prisma.workspace.upsert({
      where: {
        slug: ARSENAL_WORKSPACE_SLUG,
      },
      create: {
        name: 'LeadFlow Arsenal',
        slug: ARSENAL_WORKSPACE_SLUG,
        status: 'active',
        accountType: 'enterprise',
        timezone: 'UTC',
        defaultCurrency: 'USD',
        primaryLocale: 'es',
        primaryDomain: null,
        emailNotificationsEnabled: false,
      },
      update: {
        name: 'LeadFlow Arsenal',
        status: 'active',
        accountType: 'enterprise',
        emailNotificationsEnabled: false,
      },
      select: {
        id: true,
        slug: true,
      },
    });

    const team = await prisma.team.upsert({
      where: {
        workspaceId_code: {
          workspaceId: workspace.id,
          code: ARSENAL_TEAM_CODE,
        },
      },
      create: {
        workspaceId: workspace.id,
        name: 'LeadFlow Arsenal Masters',
        code: ARSENAL_TEAM_CODE,
        status: 'active',
        teamType: 'department',
        isActive: true,
        description:
          'Internal technical team for master funnel authoring. Not commercial ownership.',
      },
      update: {
        name: 'LeadFlow Arsenal Masters',
        status: 'active',
        teamType: 'department',
        isActive: true,
        description:
          'Internal technical team for master funnel authoring. Not commercial ownership.',
      },
      select: {
        id: true,
        code: true,
      },
    });

    console.log(
      `LeadFlow Arsenal workspace ready: workspace=${workspace.slug} (${workspace.id}), team=${team.code} (${team.id})`,
    );
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
