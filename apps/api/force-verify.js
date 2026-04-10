const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const TARGET_DOMAIN = 'retodetransformacion.com';

function normalizeHost(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
    .replace(/:\d+$/, '')
    .replace(/\.+$/, '');
}

async function main() {
  const normalizedTarget = normalizeHost(TARGET_DOMAIN);

  const domain = await prisma.domain.findFirst({
    where: {
      OR: [
        { host: normalizedTarget },
        { normalizedHost: normalizedTarget },
        { canonicalHost: normalizedTarget },
      ],
    },
  });

  if (!domain) {
    throw new Error(`No se encontró el dominio ${normalizedTarget}`);
  }

  await prisma.domain.update({
    where: { id: domain.id },
    data: {
      status: 'active',
      onboardingStatus: 'active',
      verificationStatus: 'verified',
      sslStatus: 'active',
      activatedAt: domain.activatedAt ?? new Date(),
    },
  });

  console.log('Dominio verificado con éxito');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
