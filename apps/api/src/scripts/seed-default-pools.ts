import { PrismaClient, RotationStrategy, RotationPoolStatus } from '@prisma/client';

const prisma = new PrismaClient();
const defaultRotationPoolName = 'Rotación Orgánica Principal';

async function resolveAvailableRotationPoolName(
  workspaceId: string,
  teamName: string,
) {
  const teamScopedName = `${defaultRotationPoolName} - ${teamName}`;
  const candidates = [defaultRotationPoolName, teamScopedName];

  for (const candidate of candidates) {
    const existing = await prisma.rotationPool.findFirst({
      where: {
        workspaceId,
        name: candidate,
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  let suffix = 2;

  while (true) {
    const candidate = `${teamScopedName} ${suffix}`;
    const existing = await prisma.rotationPool.findFirst({
      where: {
        workspaceId,
        name: candidate,
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    suffix += 1;
  }
}

async function main() {
  const orphanTeams = await prisma.team.findMany({
    where: {
      rotationPools: {
        none: {},
      },
    },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      sponsors: {
        where: {
          isActive: true,
          status: 'active',
        },
        orderBy: [{ createdAt: 'asc' }],
        select: { id: true },
      },
    },
    orderBy: [{ createdAt: 'asc' }],
  });

  const createdPools: Array<{
    teamId: string;
    workspaceId: string;
    name: string;
    memberCount: number;
  }> = [];

  for (const team of orphanTeams) {
    const poolName = await resolveAvailableRotationPoolName(
      team.workspaceId,
      team.name,
    );

    const pool = await prisma.rotationPool.create({
      data: {
        workspaceId: team.workspaceId,
        teamId: team.id,
        name: poolName,
        status: RotationPoolStatus.active,
        strategy: RotationStrategy.round_robin,
        isFallbackPool: true,
        members:
          team.sponsors.length > 0
            ? {
                create: team.sponsors.map((sponsor, index) => ({
                  sponsorId: sponsor.id,
                  position: index + 1,
                  weight: 1,
                  isActive: true,
                })),
              }
            : undefined,
      },
      select: {
        id: true,
      },
    });

    createdPools.push({
      teamId: team.id,
      workspaceId: team.workspaceId,
      name: poolName,
      memberCount: team.sponsors.length,
    });

    console.log(
      `Created pool ${pool.id} for team ${team.id} (${team.name}) with ${team.sponsors.length} member(s).`,
    );
  }

  console.log(
    JSON.stringify(
      {
        scannedTeams: orphanTeams.length,
        createdPools,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error('Seed default pools failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
