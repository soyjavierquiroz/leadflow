import type { PrismaClient } from '@prisma/client';

export const ARSENAL_WORKSPACE_SLUG = 'leadflow-arsenal';
export const ARSENAL_TEAM_CODE = 'leadflow-arsenal-masters';

type ArsenalWorkspaceClient = Pick<PrismaClient, 'workspace' | 'team'>;

export type LeadFlowArsenalWorkspace = {
  workspaceId: string;
  teamId: string;
};

export const ensureLeadFlowArsenalWorkspace = async (
  prisma: ArsenalWorkspaceClient,
): Promise<LeadFlowArsenalWorkspace> => {
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
    },
  });

  return {
    workspaceId: workspace.id,
    teamId: team.id,
  };
};
