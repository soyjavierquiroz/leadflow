const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function wipe() {
  try {
    console.log("🚀 Iniciando limpieza segura de QA...");

    const result = await prisma.$transaction(async (tx) => {
      const adWheelColumns = (
        await tx.$queryRawUnsafe(
          [
            "select column_name",
            "from information_schema.columns",
            "where table_schema = 'public'",
            "and table_name = 'AdWheel'",
          ].join(" "),
        )
      ).map((row) => row.column_name);

      const canResetWheels =
        adWheelColumns.includes("currentTurnPosition") &&
        adWheelColumns.includes("sequenceVersion");

      const domainEvents = await tx.domainEvent.deleteMany({});
      const assignments = await tx.assignment.deleteMany({});
      const leads = await tx.lead.deleteMany({});
      const adWheelTurns = await tx.adWheelTurn.deleteMany({});
      const resetWheels = canResetWheels
        ? await tx.adWheel.updateMany({
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
          adWheels: resetWheels?.count ?? 0,
          skippedBecauseColumnsAreMissing: !canResetWheels,
        },
      };
    });

    console.log("✅ Limpieza completada sin borrar publicaciones base.");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

wipe();
