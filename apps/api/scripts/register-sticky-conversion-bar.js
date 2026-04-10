const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const definition = {
  key: 'sticky_conversion_bar',
  name: 'Barra Sticky de Conversión',
  description:
    'Barra fija superior en desktop y CTA fijo inferior en mobile, activados por scroll.',
  category: 'conversion',
  schemaJson: {
    type: 'sticky_conversion_bar',
    key: 'string',
    desktopText: 'string',
    desktopButtonText: 'string',
    mobileButtonText: 'string',
    triggerOffsetPixels: 320,
    bgColor: '#0f172a',
    textColor: '#f8fafc',
    buttonBgColor: '#22c55e',
    buttonTextColor: '#052e16',
    borderColor: '#1e293b',
    href: '#public-capture-form',
    action: 'scroll_to_capture | open_lead_capture_modal',
  },
  exampleJson: {
    type: 'sticky_conversion_bar',
    key: 'sticky-conversion-main',
    desktopText:
      'Activa tu evaluación personalizada antes de salir de esta página.',
    desktopButtonText: 'Quiero mi evaluación',
    mobileButtonText: 'Quiero mi evaluación',
    triggerOffsetPixels: 320,
    bgColor: '#0f172a',
    textColor: '#f8fafc',
    buttonBgColor: '#22c55e',
    buttonTextColor: '#052e16',
    borderColor: '#1e293b',
    action: 'scroll_to_capture',
  },
};

async function main() {
  const record = await prisma.blockDefinition.upsert({
    where: { key: definition.key },
    update: {
      name: definition.name,
      description: definition.description,
      category: definition.category,
      schemaJson: definition.schemaJson,
      exampleJson: definition.exampleJson,
      isActive: true,
    },
    create: {
      ...definition,
      isActive: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        id: record.id,
        key: record.key,
        updatedAt: record.updatedAt,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
