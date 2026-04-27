import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const migrationName = '20260427170000_ad_wheel_infinite_weighted_cycle_v1';
const migrationFilePath = join(
  process.cwd(),
  'prisma',
  'migrations',
  migrationName,
  'migration.sql',
);

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function main() {
  const migrationSql = readFileSync(migrationFilePath, 'utf8');
  const checksum = createHash('sha256').update(migrationSql).digest('hex');
  const statements = splitSqlStatements(migrationSql);

  const existingMigration = await prisma.$queryRawUnsafe<
    Array<{ id: string; finished_at: Date | null; rolled_back_at: Date | null }>
  >(
    `
      SELECT id, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      WHERE migration_name = $1
      ORDER BY started_at DESC
      LIMIT 1
    `,
    migrationName,
  );

  if (
    existingMigration[0] &&
    existingMigration[0].finished_at &&
    !existingMigration[0].rolled_back_at
  ) {
    console.log(
      JSON.stringify(
        {
          skipped: true,
          reason: 'migration_already_applied',
          migrationName,
        },
        null,
        2,
      ),
    );
    return;
  }

  const migrationId = randomUUID();

  await prisma.$transaction(async (tx) => {
    for (const statement of statements) {
      await tx.$executeRawUnsafe(statement);
    }

    if (existingMigration[0]) {
      await tx.$executeRawUnsafe(
        `
          UPDATE "_prisma_migrations"
          SET checksum = $2,
              finished_at = NOW(),
              logs = NULL,
              rolled_back_at = NULL,
              applied_steps_count = $3
          WHERE id = $1
        `,
        existingMigration[0].id,
        checksum,
        statements.length,
      );
      return;
    }

    await tx.$executeRawUnsafe(
      `
        INSERT INTO "_prisma_migrations" (
          id,
          checksum,
          finished_at,
          migration_name,
          logs,
          rolled_back_at,
          started_at,
          applied_steps_count
        )
        VALUES ($1, $2, NOW(), $3, NULL, NULL, NOW(), $4)
      `,
      migrationId,
      checksum,
      migrationName,
      statements.length,
    );
  });

  const columns = await prisma.$queryRawUnsafe<
    Array<{ column_name: string }>
  >(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'AdWheel'
        AND column_name IN ('currentTurnPosition', 'sequenceVersion')
      ORDER BY column_name
    `,
  );

  console.log(
    JSON.stringify(
      {
        applied: true,
        migrationName,
        statements: statements.length,
        adWheelColumns: columns.map((column) => column.column_name),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error('Force migrate failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
