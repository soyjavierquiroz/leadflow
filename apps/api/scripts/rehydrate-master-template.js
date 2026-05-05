const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULTS = {
  workspaceSlug: 'leadflow-reset',
  workspaceName: 'Leadflow Reset Workspace',
  teamCode: 'jakawi-lab',
  teamName: 'Jakawi Lab',
  templateId: 'jakawi-premium',
  templateCode: 'jakawi-premium',
  templateName: 'Jakawi Premium',
  templateDescription:
    'Template maestro oficial para rehidratar el runtime moderno de Leadflow.',
  funnelCode: 'jakawi-premium-master',
  funnelName: 'Jakawi Premium Maestro',
  structureId: 'split-media-focus',
  host: 'jakawi-premium.leadflow.local',
  pathPrefix: '/',
  locale: 'es',
};

const TEMPLATE_BLOCKS = [
  {
    type: 'hero',
    key: 'hero-main',
    eyebrow: 'Jakawi Premium',
    title: 'Template maestro listo para rehidratar funnels modernos',
    description:
      'Base editorial premium con composición mínima, compatible con el runtime JSON-driven y el builder híbrido.',
  },
  {
    type: 'hook_and_promise',
    key: 'hook-main',
    eyebrow: 'Sistema Maestro',
    hook: 'Reinicia el catálogo sin arrastrar deuda legacy innecesaria.',
    promise:
      'Este template deja una base pequeña, estable y operable para probar la nueva orquestación de punta a punta.',
  },
  {
    type: 'lead_capture_form',
    key: 'master-capture-form',
    eyebrow: 'Activa la prueba',
    headline: 'Solicita acceso al flujo maestro',
    subheadline:
      'Capturamos tus datos y avanzamos al siguiente paso del funnel rehidratado.',
    button_text: 'Continuar',
    helper_text:
      'Este formulario valida que la publicación, el runtime y el handoff básico quedaron conectados.',
    privacy_note:
      'Usamos esta información solo para validar el flujo dentro del entorno de prueba.',
    success_mode: 'next_step',
    fields: [
      {
        name: 'fullName',
        label: 'Nombre completo',
        type: 'text',
        required: true,
        placeholder: 'Tu nombre completo',
        autocomplete: 'name',
        width: 'full',
      },
      {
        name: 'phone',
        label: 'WhatsApp',
        type: 'tel',
        required: false,
        placeholder: '+52 55 0000 0000',
        autocomplete: 'tel',
        width: 'half',
      },
      {
        name: 'email',
        label: 'Email',
        type: 'email',
        required: false,
        placeholder: 'tu@email.com',
        autocomplete: 'email',
        width: 'half',
      },
    ],
    settings: {
      capture_url_context: true,
      source_channel: 'form',
      tags: ['reset-master-template', 'jakawi-premium'],
      next_step_slug: 'confirmado',
    },
  },
];

const LANDING_BLOCKS = [
  {
    type: 'hero',
    key: 'master-landing-hero',
    eyebrow: 'Jakawi Premium',
    title: 'Flujo maestro rehidratado',
    description:
      'Este landing valida que el template global, la instancia, los pasos y la publicación quedaron operativos.',
  },
  TEMPLATE_BLOCKS[2],
];

const CONFIRMATION_BLOCKS = [
  {
    type: 'hero',
    key: 'master-confirmation-hero',
    eyebrow: 'Confirmación',
    title: 'Tu registro fue recibido',
    description:
      'La orquestación básica respondió correctamente y el funnel avanzó al siguiente paso.',
  },
];

const DEFAULT_MEDIA_MAP = {
  heroImage:
    'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80',
};

function parseArgs(argv) {
  const result = {
    fullRuntime: false,
    templateOnly: true,
  };

  for (const arg of argv) {
    if (arg === '--template-only') {
      result.templateOnly = true;
      continue;
    }

    if (arg === '--full-runtime') {
      result.fullRuntime = true;
      result.templateOnly = false;
      continue;
    }

    if (!arg.startsWith('--')) {
      continue;
    }

    const trimmed = arg.slice(2);
    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      result[trimmed] = 'true';
      continue;
    }

    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);
    result[key] = value;
  }

  return result;
}

function asObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value;
}

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

function sanitizePathPrefix(value) {
  const trimmed = (value || '/').trim();

  if (!trimmed || trimmed === '/') {
    return '/';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function buildTemplateSettings(settings, options) {
  return {
    ...asObject(settings),
    theme: options.templateId,
    locale: options.locale,
    structureId: options.structureId,
  };
}

function buildAllowedOverrides(value) {
  const current = asObject(value);
  const editableFields = Array.isArray(current.editableFields)
    ? current.editableFields.filter((item) => typeof item === 'string')
    : [];

  return {
    ...current,
    editableFields: Array.from(
      new Set([
        ...editableFields,
        'hero',
        'hook_and_promise',
        'lead_capture_form',
        'media',
      ]),
    ),
  };
}

function buildInstanceSettings(options) {
  return {
    theme: options.templateId,
    locale: options.locale,
    structureId: options.structureId,
    hybridEditor: {
      mode: 'data-driven-assembly',
      templateId: options.templateId,
      structureId: options.structureId,
      blocksJson: LANDING_BLOCKS,
    },
    seo: {
      title: options.funnelName,
      metaDescription:
        'Funnel maestro rehidratado para validar la nueva orquestación.',
    },
  };
}

function buildLandingStepSettings(options) {
  return {
    editorSource: 'reset-master-template-script',
    templateId: options.templateId,
    templateCode: options.templateCode,
    structureId: options.structureId,
    hybridRenderer: 'jakawi-bridge',
    blocksJson: LANDING_BLOCKS,
    seo: {
      title: options.funnelName,
      metaDescription:
        'Landing principal del funnel maestro rehidratado para pruebas.',
    },
  };
}

function buildConfirmationStepSettings(options) {
  return {
    editorSource: 'reset-master-template-script',
    templateId: options.templateId,
    templateCode: options.templateCode,
    structureId: options.structureId,
    hybridRenderer: 'jakawi-bridge',
    blocksJson: CONFIRMATION_BLOCKS,
    seo: {
      title: `${options.funnelName} - Confirmación`,
      metaDescription:
        'Paso de confirmación del funnel maestro rehidratado para pruebas.',
    },
  };
}

async function upsertWorkspace(options) {
  return prisma.workspace.upsert({
    where: { slug: options.workspaceSlug },
    update: {
      name: options.workspaceName,
      status: 'active',
      timezone: 'UTC',
      defaultCurrency: 'USD',
      primaryLocale: options.locale,
      primaryDomain: options.host,
    },
    create: {
      name: options.workspaceName,
      slug: options.workspaceSlug,
      status: 'active',
      timezone: 'UTC',
      defaultCurrency: 'USD',
      primaryLocale: options.locale,
      primaryDomain: options.host,
    },
  });
}

async function upsertTeam(workspaceId, options) {
  return prisma.team.upsert({
    where: {
      workspaceId_code: {
        workspaceId,
        code: options.teamCode,
      },
    },
    update: {
      name: options.teamName,
      status: 'active',
      description: `Tenant de prueba para ${options.templateName}.`,
    },
    create: {
      workspaceId,
      name: options.teamName,
      code: options.teamCode,
      status: 'active',
      description: `Tenant de prueba para ${options.templateName}.`,
    },
  });
}

async function upsertTemplate(options) {
  const existingByCode = await prisma.funnelTemplate.findUnique({
    where: { code: options.templateCode },
  });

  if (existingByCode && existingByCode.id !== options.templateId) {
    throw new Error(
      `Ya existe un FunnelTemplate con code=${options.templateCode} e id=${existingByCode.id}. Resuelve ese conflicto antes de rehidratar.`,
    );
  }

  return prisma.funnelTemplate.upsert({
    where: { id: options.templateId },
    update: {
      workspaceId: null,
      name: options.templateName,
      description: options.templateDescription,
      code: options.templateCode,
      status: 'active',
      funnelType: 'hybrid',
      blocksJson: TEMPLATE_BLOCKS,
      mediaMap: {
        ...asObject(existingByCode?.mediaMap),
        ...DEFAULT_MEDIA_MAP,
      },
      settingsJson: buildTemplateSettings(existingByCode?.settingsJson, options),
      allowedOverridesJson: buildAllowedOverrides(
        existingByCode?.allowedOverridesJson,
      ),
      defaultHandoffStrategyId:
        existingByCode?.defaultHandoffStrategyId ?? null,
    },
    create: {
      id: options.templateId,
      workspaceId: null,
      name: options.templateName,
      description: options.templateDescription,
      code: options.templateCode,
      status: 'active',
      version: 1,
      funnelType: 'hybrid',
      blocksJson: TEMPLATE_BLOCKS,
      mediaMap: DEFAULT_MEDIA_MAP,
      settingsJson: buildTemplateSettings({}, options),
      allowedOverridesJson: buildAllowedOverrides({}),
      defaultHandoffStrategyId: null,
    },
  });
}

async function upsertFunnel(workspaceId, teamId, options) {
  return prisma.funnel.upsert({
    where: {
      workspaceId_code: {
        workspaceId,
        code: options.funnelCode,
      },
    },
    update: {
      name: options.funnelName,
      status: 'active',
      config: {
        source: 'reset-master-template-script',
        structureId: options.structureId,
        templateId: options.templateId,
        templateCode: options.templateCode,
      },
      stages: ['captured', 'qualified', 'assigned'],
      entrySources: ['manual', 'form', 'landing_page', 'api'],
      defaultTeamId: teamId,
      defaultRotationPoolId: null,
      isTemplate: false,
    },
    create: {
      workspaceId,
      name: options.funnelName,
      code: options.funnelCode,
      config: {
        source: 'reset-master-template-script',
        structureId: options.structureId,
        templateId: options.templateId,
        templateCode: options.templateCode,
      },
      status: 'active',
      isTemplate: false,
      stages: ['captured', 'qualified', 'assigned'],
      entrySources: ['manual', 'form', 'landing_page', 'api'],
      defaultTeamId: teamId,
      defaultRotationPoolId: null,
    },
  });
}

async function upsertDomain(workspaceId, teamId, linkedFunnelId, options) {
  const normalizedHost = normalizeHost(options.host);

  return prisma.domain.upsert({
    where: { normalizedHost },
    update: {
      workspaceId,
      teamId,
      linkedFunnelId,
      host: options.host,
      normalizedHost,
      status: 'active',
      onboardingStatus: 'active',
      domainType: 'system_subdomain',
      isPrimary: true,
      canonicalHost: options.host,
      redirectToPrimary: false,
      verificationStatus: 'verified',
      sslStatus: 'active',
      verificationMethod: 'none',
      cloudflareCustomHostnameId: null,
      cloudflareStatusJson: null,
      dnsTarget: null,
      lastCloudflareSyncAt: null,
      activatedAt: new Date(),
    },
    create: {
      workspaceId,
      teamId,
      linkedFunnelId,
      host: options.host,
      normalizedHost,
      status: 'active',
      onboardingStatus: 'active',
      domainType: 'system_subdomain',
      isPrimary: true,
      canonicalHost: options.host,
      redirectToPrimary: false,
      verificationStatus: 'verified',
      sslStatus: 'active',
      verificationMethod: 'none',
      cloudflareCustomHostnameId: null,
      cloudflareStatusJson: null,
      dnsTarget: null,
      lastCloudflareSyncAt: null,
      activatedAt: new Date(),
    },
  });
}

async function upsertInstance(workspaceId, teamId, templateId, funnelId, options) {
  return prisma.funnelInstance.upsert({
    where: {
      teamId_code: {
        teamId,
        code: options.funnelCode,
      },
    },
    update: {
      workspaceId,
      templateId,
      funnelId,
      name: options.funnelName,
      status: 'active',
      rotationPoolId: null,
      trackingProfileId: null,
      handoffStrategyId: null,
      settingsJson: buildInstanceSettings(options),
      mediaMap: DEFAULT_MEDIA_MAP,
    },
    create: {
      workspaceId,
      teamId,
      templateId,
      funnelId,
      name: options.funnelName,
      code: options.funnelCode,
      status: 'active',
      rotationPoolId: null,
      trackingProfileId: null,
      handoffStrategyId: null,
      settingsJson: buildInstanceSettings(options),
      mediaMap: DEFAULT_MEDIA_MAP,
    },
  });
}

async function replaceSteps(workspaceId, teamId, funnelInstanceId, options) {
  await prisma.funnelStep.deleteMany({
    where: { funnelInstanceId },
  });

  await prisma.funnelStep.createMany({
    data: [
      {
        workspaceId,
        teamId,
        funnelInstanceId,
        stepType: 'landing',
        slug: 'captura',
        position: 1,
        isEntryStep: true,
        isConversionStep: true,
        blocksJson: LANDING_BLOCKS,
        mediaMap: DEFAULT_MEDIA_MAP,
        settingsJson: buildLandingStepSettings(options),
      },
      {
        workspaceId,
        teamId,
        funnelInstanceId,
        stepType: 'confirmation',
        slug: 'confirmado',
        position: 2,
        isEntryStep: false,
        isConversionStep: false,
        blocksJson: CONFIRMATION_BLOCKS,
        mediaMap: DEFAULT_MEDIA_MAP,
        settingsJson: buildConfirmationStepSettings(options),
      },
    ],
  });
}

async function upsertPublication(workspaceId, teamId, domainId, funnelInstanceId, options) {
  return prisma.funnelPublication.upsert({
    where: {
      domainId_pathPrefix: {
        domainId,
        pathPrefix: options.pathPrefix,
      },
    },
    update: {
      workspaceId,
      teamId,
      funnelInstanceId,
      trackingProfileId: null,
      handoffStrategyId: null,
      seoTitle: options.funnelName,
      seoDescription:
        'Publicación maestro para validar el runtime moderno después del reset.',
      status: 'active',
      isPrimary: true,
      isActive: true,
      runtimeHealthStatus: 'healthy',
    },
    create: {
      workspaceId,
      teamId,
      domainId,
      funnelInstanceId,
      trackingProfileId: null,
      handoffStrategyId: null,
      seoTitle: options.funnelName,
      seoDescription:
        'Publicación maestro para validar el runtime moderno después del reset.',
      pathPrefix: options.pathPrefix,
      status: 'active',
      isPrimary: true,
      isActive: true,
      runtimeHealthStatus: 'healthy',
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const options = {
    ...DEFAULTS,
    workspaceSlug: args['workspace-slug'] || DEFAULTS.workspaceSlug,
    workspaceName: args['workspace-name'] || DEFAULTS.workspaceName,
    teamCode: args['team-code'] || DEFAULTS.teamCode,
    teamName: args['team-name'] || DEFAULTS.teamName,
    templateId: args['template-id'] || DEFAULTS.templateId,
    templateCode: args['template-code'] || DEFAULTS.templateCode,
    templateName: args['template-name'] || DEFAULTS.templateName,
    templateDescription:
      args['template-description'] || DEFAULTS.templateDescription,
    funnelCode: args['funnel-code'] || DEFAULTS.funnelCode,
    funnelName: args['funnel-name'] || DEFAULTS.funnelName,
    structureId: args['structure-id'] || DEFAULTS.structureId,
    host: args.host || DEFAULTS.host,
    pathPrefix: sanitizePathPrefix(args['path-prefix'] || DEFAULTS.pathPrefix),
    locale: args.locale || DEFAULTS.locale,
  };

  const template = await upsertTemplate(options);

  if (args.templateOnly) {
    console.log(
      JSON.stringify(
        {
          mode: 'template-only',
          template: {
            id: template.id,
            code: template.code,
            status: template.status,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  const workspace = await upsertWorkspace(options);
  const team = await upsertTeam(workspace.id, options);
  const funnel = await upsertFunnel(workspace.id, team.id, options);
  const domain = await upsertDomain(
    workspace.id,
    team.id,
    funnel.id,
    options,
  );
  const instance = await upsertInstance(
    workspace.id,
    team.id,
    template.id,
    funnel.id,
    options,
  );

  await replaceSteps(workspace.id, team.id, instance.id, options);

  const publication = await upsertPublication(
    workspace.id,
    team.id,
    domain.id,
    instance.id,
    options,
  );

  console.log(
    JSON.stringify(
      {
        mode: 'full-runtime',
        workspace: {
          id: workspace.id,
          slug: workspace.slug,
        },
        team: {
          id: team.id,
          code: team.code,
        },
        template: {
          id: template.id,
          code: template.code,
          status: template.status,
        },
        funnel: {
          id: funnel.id,
          code: funnel.code,
        },
        funnelInstance: {
          id: instance.id,
          code: instance.code,
          templateId: instance.templateId,
        },
        publication: {
          id: publication.id,
          domainId: publication.domainId,
          pathPrefix: publication.pathPrefix,
        },
        domain: {
          id: domain.id,
          host: domain.host,
        },
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
