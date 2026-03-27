import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DomainsService } from '../modules/domains/domains.service';
import { PrismaService } from '../prisma/prisma.service';

type CliOptions = {
  execute: boolean;
  teamId: string | null;
};

type LegacyDomainCandidate = {
  id: string;
  host: string;
  domainType: string;
  cloudflareCustomHostnameId: string | null;
  _count: {
    funnelPublications: number;
  };
};

const logger = new Logger('DomainsCleanupLegacy');

const parseCliOptions = (argv: string[]): CliOptions => {
  let execute = false;
  let teamId: string | null = null;

  for (const arg of argv) {
    if (arg === '--execute') {
      execute = true;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (teamId) {
      throw new Error(
        `Unexpected extra argument: ${arg}. Usage: pnpm --filter @leadflow/api domains:cleanup-legacy -- <teamId> [--execute]`,
      );
    }

    teamId = arg;
  }

  return {
    execute,
    teamId,
  };
};

const logCandidate = (domain: LegacyDomainCandidate, execute: boolean) => {
  const mode = execute ? 'EXECUTE' : 'DRY RUN';
  logger.log(
    `[${mode}] ${domain.host} (${domain.domainType}) id=${domain.id} cfId=${
      domain.cloudflareCustomHostnameId ?? 'none'
    } cascadePublications=${domain._count.funnelPublications}`,
  );
};

async function bootstrap() {
  const { execute, teamId } = parseCliOptions(process.argv.slice(2));

  if (!teamId) {
    throw new Error(
      'Missing teamId. Usage: pnpm --filter @leadflow/api domains:cleanup-legacy -- <teamId> [--execute]',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const domainsService = app.get(DomainsService);
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        workspaceId: true,
      },
    });

    if (!team) {
      throw new Error(`Team ${teamId} was not found.`);
    }

    logger.log(
      `Starting legacy custom domains cleanup for team "${team.name}" (${team.id}) in workspace ${team.workspaceId}. Mode: ${
        execute ? 'EXECUTE' : 'DRY RUN'
      }.`,
    );

    const targetDomains = await prisma.domain.findMany({
      where: {
        teamId: team.id,
        workspaceId: team.workspaceId,
        domainType: {
          in: ['custom_subdomain', 'custom_apex'],
        },
      },
      select: {
        id: true,
        host: true,
        domainType: true,
        cloudflareCustomHostnameId: true,
        _count: {
          select: {
            funnelPublications: true,
          },
        },
      },
      orderBy: [{ domainType: 'asc' }, { host: 'asc' }],
    });

    if (targetDomains.length === 0) {
      logger.log(
        `No custom domains were found for team "${team.name}". Nothing to clean.`,
      );
      return;
    }

    logger.log(
      `Found ${targetDomains.length} custom domains eligible for cleanup.`,
    );

    let deleted = 0;
    let failed = 0;

    for (const domain of targetDomains) {
      logCandidate(domain, execute);

      if (!execute) {
        continue;
      }

      try {
        await domainsService.deleteForTeam(
          {
            workspaceId: team.workspaceId,
            teamId: team.id,
          },
          domain.id,
        );

        deleted += 1;
        logger.log(`Deleted ${domain.host} successfully.`);
      } catch (error) {
        failed += 1;
        const message =
          error instanceof Error ? error.message : 'Unknown deletion error.';
        logger.error(`Failed to delete ${domain.host}: ${message}`);
      }
    }

    if (execute) {
      logger.log(
        `Cleanup finished. Deleted=${deleted} Failed=${failed} Total=${targetDomains.length}.`,
      );
      return;
    }

    logger.log(
      `Dry run finished. Re-run with --execute to delete ${targetDomains.length} domains.`,
    );
  } finally {
    await app.close();
  }
}

const currentEntryPoint = process.argv[1];
const isDirectExecution = currentEntryPoint
  ? /domains-cleanup-legacy\.(ts|js)$/.test(currentEntryPoint)
  : false;

if (isDirectExecution) {
  void bootstrap().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'Unexpected cleanup failure.';
    logger.error(message);
    process.exitCode = 1;
  });
}

export { parseCliOptions };
