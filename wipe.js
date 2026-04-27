const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function wipe() {
  try {
    console.log('🚀 Iniciando Tabula Rasa...');
    await prisma.domainEvent.deleteMany({});
    await prisma.leadAssignment.deleteMany({});
    await prisma.lead.deleteMany({});
    await prisma.adWheelTurn.deleteMany({});
    await prisma.adWheel.updateMany({ data: { currentTurnPosition: 1, sequenceVersion: 1 } });
    console.log('✅ Base de datos limpia. Ruletas reseteadas.');
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}
wipe();
