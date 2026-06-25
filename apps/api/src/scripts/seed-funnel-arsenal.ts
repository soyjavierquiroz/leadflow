import { PrismaClient, FunnelArsenalTemplateStatus } from '@prisma/client';
import {
  funnelArsenalTemplates,
  getBusinessBlueprintByKey,
} from '@leadflow/account-model';

const isHelp = process.argv.includes('--help') || process.argv.includes('-h');

if (isHelp) {
  console.log(
    [
      'Usage: node dist/apps/api/src/scripts/seed-funnel-arsenal.js',
      '',
      'Seeds Funnel Arsenal templates into the configured production database.',
      'Requires DATABASE_URL and a generated Prisma Client in the runtime image.',
    ].join('\n'),
  );
  process.exit(0);
}

const main = async () => {
  const prisma = new PrismaClient();
  const templates = [];

  try {
    for (const template of funnelArsenalTemplates) {
      const blueprint = getBusinessBlueprintByKey(template.blueprintKey);
      const record = await prisma.funnelArsenalTemplate.upsert({
        where: {
          templateKey: template.templateKey,
        },
        create: {
          templateKey: template.templateKey,
          blueprintKey: template.blueprintKey,
          vertical: blueprint?.vertical ?? 'other',
          label: template.label,
          description: template.description,
          goal: template.goal,
          recommendedFor: template.recommendedFor,
          cta: template.cta,
          pathSuggestion: template.pathSuggestion,
          difficulty: template.difficulty,
          status: FunnelArsenalTemplateStatus.active,
          blocksPresetKey: template.blocksPresetKey ?? null,
          funnelTemplateId: null,
          sourceFunnelId: null,
          sourceFunnelInstanceId: null,
        },
        update: {
          blueprintKey: template.blueprintKey,
          vertical: blueprint?.vertical ?? 'other',
          label: template.label,
          description: template.description,
          goal: template.goal,
          recommendedFor: template.recommendedFor,
          cta: template.cta,
          pathSuggestion: template.pathSuggestion,
          difficulty: template.difficulty,
          status: FunnelArsenalTemplateStatus.active,
          blocksPresetKey: template.blocksPresetKey ?? null,
        },
      });

      templates.push(record.templateKey);
    }

    console.log(
      `Seeded ${templates.length} funnel arsenal template(s): ${templates.join(', ')}`,
    );
  } finally {
    await prisma.$disconnect();
  }
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
