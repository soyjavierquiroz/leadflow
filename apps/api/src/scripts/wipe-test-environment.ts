import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const adWheelColumns = (await tx.$queryRawUnsafe<
      Array<{ column_name: string }>
    >(
      [
        'select column_name',
        'from information_schema.columns',
        "where table_schema = 'public'",
        "and table_name = 'AdWheel'",
      ].join(' '),
    )).map((row) => row.column_name);
    const canResetActiveWheels =
      adWheelColumns.includes('currentTurnPosition') &&
      adWheelColumns.includes('sequenceVersion');

    const domainEvents = await tx.domainEvent.deleteMany({});
    const assignments = await tx.assignment.deleteMany({});
    const leads = await tx.lead.deleteMany({});
    const adWheelTurns = await tx.adWheelTurn.deleteMany({});
    const activeAdWheels = await tx.adWheel.count({
      where: {
        status: 'ACTIVE',
      },
    });
    const adWheels = canResetActiveWheels
      ? await tx.adWheel.updateMany({
          where: {
            status: 'ACTIVE',
          },
          data: {
            currentTurnPosition: 1,
            sequenceVersion: 1,
          },
        })
      : null;

    return {
      deleted: {
        domainEvents: domainEvents.count,
        assignments: assignments.count,
        leads: leads.count,
        adWheelTurns: adWheelTurns.count,
      },
      reset: {
        activeAdWheels,
        wheelsReset: adWheels?.count ?? 0,
        skippedBecauseColumnsAreMissing: !canResetActiveWheels,
      },
    };
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error('Wipe failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
