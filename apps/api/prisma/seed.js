const { PrismaClient } = require('@prisma/client');
const { randomBytes, scryptSync } = require('crypto');

const prisma = new PrismaClient();
const DEFAULT_KEY_LENGTH = 64;

const IMMUNOTEC_HOST = 'immunotec.leadflow.local';
const IMMUNOTEC_TEAM_CODE = 'immunotec';
const IMMUNOTEC_FUNNEL_CODE = 'immunotec-recuperacion';
const IMMUNOTEC_TEMPLATE_ID = 'jakawi-premium';
const IMMUNOTEC_STRUCTURE_ID = 'split-media-focus';
const IMMUNOTEC_FUNNEL_NAME = 'Immunotec - Recuperación';
const STICKY_CONVERSION_BAR_DEFINITION = {
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

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, DEFAULT_KEY_LENGTH).toString(
    'hex',
  );

  return `scrypt$${salt}$${derivedKey}`;
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

const jakawiPremiumTemplateData = {
  name: 'Jakawi Premium',
  description: 'Template visual premium oficial para funnels editoriales.',
  code: IMMUNOTEC_TEMPLATE_ID,
  status: 'active',
  version: 1,
  funnelType: 'hybrid',
  blocksJson: [
    {
      type: 'hero',
      key: 'hero-main',
      eyebrow: 'Jakawi Premium',
      title:
        'Funnel editorial premium listo para captar y convertir con una capa visual unificada',
      description:
        'Plantilla oficial del sistema para experiencias premium con layout sticky, narrativa comercial y captura integrada.',
    },
    {
      type: 'hook_and_promise',
      key: 'hook-main',
      eyebrow: 'Premium Funnel Engine',
      hook: 'Convierte tráfico frío en sesiones editoriales con estructura premium, media fija y una propuesta de valor más clara.',
      promise:
        'Jakawi Premium unifica identidad visual, bloques comerciales y captura en un runtime consistente para iterar sin deuda visual.',
    },
    {
      type: 'lead_capture_form',
      key: 'template-capture-form',
      eyebrow: 'Premium Capture Block',
      headline: 'Solicita acceso a la experiencia premium',
      subheadline:
        'Bloque oficial para capturar contexto comercial dentro del sistema premium sin romper el runtime compartido.',
      button_text: 'Quiero continuar',
      helper_text:
        'Completa tu información para activar el siguiente paso del funnel premium.',
      privacy_note:
        'Usamos esta información para procesar tu solicitud y continuar la conversación comercial dentro del funnel premium.',
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
        {
          name: 'utm_source',
          label: 'UTM Source',
          type: 'hidden',
          hidden: true,
        },
      ],
      settings: {
        capture_url_context: true,
        source_channel: 'form',
        tags: ['jakawi-premium', 'lead-capture-form-v1'],
      },
    },
  ],
  mediaMap: {
    heroImage:
      'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
  },
  settingsJson: {
    theme: 'jakawi-premium',
    locale: 'es',
    structureId: IMMUNOTEC_STRUCTURE_ID,
  },
  allowedOverridesJson: {
    editableFields: [
      'hero',
      'hook_and_promise',
      'social_proof',
      'feature_grid',
      'lead_capture_form',
      'offer_pricing',
      'faq',
      'media',
    ],
  },
};

const immunotecBlocks = [
  {
    type: 'hero',
    key: 'immunotec-recuperacion-hero',
    eyebrow: 'Immunotec',
    title: 'Recupera tu energía y vuelve a enfocarte en tu bienestar',
    description:
      'Publicación ancla de Immunotec para la etapa de recuperación con narrativa clara y captura integrada.',
  },
  {
    type: 'lead_capture_form',
    key: 'immunotec-recuperacion-form',
    eyebrow: 'Quiero más información',
    headline: 'Solicita acompañamiento para tu proceso de recuperación',
    subheadline:
      'Déjanos tus datos y te contactaremos con la siguiente recomendación.',
    button_text: 'Quiero empezar',
    helper_text:
      'Usaremos esta información para continuar tu proceso dentro de Leadflow.',
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
  },
];

async function purgeWorkspaceSeedData(workspaceId) {
  await prisma.authSession.deleteMany();
  await prisma.leadNote.deleteMany({ where: { workspaceId } });
  await prisma.automationDispatch.deleteMany({ where: { workspaceId } });
  await prisma.domainEvent.deleteMany({ where: { workspaceId } });
  await prisma.assignment.deleteMany({ where: { workspaceId } });
  await prisma.lead.deleteMany({ where: { workspaceId } });
  await prisma.visitor.deleteMany({ where: { workspaceId } });
  await prisma.funnelPublication.deleteMany({ where: { workspaceId } });
  await prisma.funnelStep.deleteMany({ where: { workspaceId } });
  await prisma.funnelInstance.deleteMany({ where: { workspaceId } });
  await prisma.domain.deleteMany({ where: { workspaceId } });
  await prisma.funnel.deleteMany({ where: { workspaceId } });
  await prisma.messagingConnection.deleteMany({ where: { workspaceId } });
  await prisma.rotationMember.deleteMany();
  await prisma.rotationPool.deleteMany({ where: { workspaceId } });
  await prisma.conversionEventMapping.deleteMany({
    where: {
      trackingProfile: {
        workspaceId,
      },
    },
  });
  await prisma.trackingProfile.deleteMany({ where: { workspaceId } });
  await prisma.sponsor.deleteMany({ where: { workspaceId } });
  await prisma.handoffStrategy.deleteMany({ where: { workspaceId } });
  await prisma.user.deleteMany({
    where: {
      workspaceId,
      role: {
        not: 'SUPER_ADMIN',
      },
    },
  });
  await prisma.team.deleteMany({ where: { workspaceId } });

  await prisma.funnelTemplate.deleteMany({
    where: {
      workspaceId: null,
      code: {
        in: ['lf-simple-capture-v1', 'lf-vsl-qualification-v1'],
      },
    },
  });
}

async function main() {
  await prisma.blockDefinition.upsert({
    where: { key: STICKY_CONVERSION_BAR_DEFINITION.key },
    update: {
      name: STICKY_CONVERSION_BAR_DEFINITION.name,
      description: STICKY_CONVERSION_BAR_DEFINITION.description,
      category: STICKY_CONVERSION_BAR_DEFINITION.category,
      schemaJson: STICKY_CONVERSION_BAR_DEFINITION.schemaJson,
      exampleJson: STICKY_CONVERSION_BAR_DEFINITION.exampleJson,
      isActive: true,
    },
    create: {
      ...STICKY_CONVERSION_BAR_DEFINITION,
      isActive: true,
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'leadflow-dev' },
    update: {
      name: 'Leadflow Dev Workspace',
      status: 'active',
      timezone: 'UTC',
      defaultCurrency: 'USD',
      primaryLocale: 'es',
      primaryDomain: IMMUNOTEC_HOST,
    },
    create: {
      name: 'Leadflow Dev Workspace',
      slug: 'leadflow-dev',
      status: 'active',
      timezone: 'UTC',
      defaultCurrency: 'USD',
      primaryLocale: 'es',
      primaryDomain: IMMUNOTEC_HOST,
    },
  });

  await purgeWorkspaceSeedData(workspace.id);

  await prisma.user.upsert({
    where: { email: 'admin@leadflow.local' },
    update: {
      workspaceId: workspace.id,
      teamId: null,
      sponsorId: null,
      fullName: 'Leadflow Super Admin',
      passwordHash: hashPassword('Admin123!'),
      role: 'SUPER_ADMIN',
      status: 'active',
    },
    create: {
      workspaceId: workspace.id,
      fullName: 'Leadflow Super Admin',
      email: 'admin@leadflow.local',
      passwordHash: hashPassword('Admin123!'),
      role: 'SUPER_ADMIN',
      status: 'active',
    },
  });

  const team = await prisma.team.upsert({
    where: {
      workspaceId_code: {
        workspaceId: workspace.id,
        code: IMMUNOTEC_TEAM_CODE,
      },
    },
    update: {
      name: 'Immunotec',
      status: 'active',
      description: 'Tenant oficial para la publicación ancla de Immunotec.',
    },
    create: {
      workspaceId: workspace.id,
      name: 'Immunotec',
      code: IMMUNOTEC_TEAM_CODE,
      status: 'active',
      description: 'Tenant oficial para la publicación ancla de Immunotec.',
    },
  });

  const funnelTemplate = await prisma.funnelTemplate.upsert({
    where: { code: IMMUNOTEC_TEMPLATE_ID },
    update: {
      ...jakawiPremiumTemplateData,
      defaultHandoffStrategyId: null,
    },
    create: {
      id: IMMUNOTEC_TEMPLATE_ID,
      ...jakawiPremiumTemplateData,
      defaultHandoffStrategyId: null,
    },
  });

  const legacyFunnel = await prisma.funnel.upsert({
    where: {
      workspaceId_code: {
        workspaceId: workspace.id,
        code: IMMUNOTEC_FUNNEL_CODE,
      },
    },
    update: {
      name: IMMUNOTEC_FUNNEL_NAME,
      status: 'active',
      config: {
        structureId: IMMUNOTEC_STRUCTURE_ID,
        templateId: IMMUNOTEC_TEMPLATE_ID,
      },
      stages: ['captured', 'qualified', 'assigned'],
      entrySources: ['manual', 'form', 'landing_page', 'api'],
      defaultTeamId: team.id,
      defaultRotationPoolId: null,
    },
    create: {
      workspaceId: workspace.id,
      name: IMMUNOTEC_FUNNEL_NAME,
      code: IMMUNOTEC_FUNNEL_CODE,
      config: {
        structureId: IMMUNOTEC_STRUCTURE_ID,
        templateId: IMMUNOTEC_TEMPLATE_ID,
      },
      status: 'active',
      stages: ['captured', 'qualified', 'assigned'],
      entrySources: ['manual', 'form', 'landing_page', 'api'],
      defaultTeamId: team.id,
      defaultRotationPoolId: null,
    },
  });

  const domain = await prisma.domain.upsert({
    where: { normalizedHost: normalizeHost(IMMUNOTEC_HOST) },
    update: {
      workspaceId: workspace.id,
      teamId: team.id,
      linkedFunnelId: legacyFunnel.id,
      host: IMMUNOTEC_HOST,
      normalizedHost: normalizeHost(IMMUNOTEC_HOST),
      status: 'active',
      onboardingStatus: 'active',
      domainType: 'system_subdomain',
      isPrimary: true,
      canonicalHost: IMMUNOTEC_HOST,
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
      workspaceId: workspace.id,
      teamId: team.id,
      linkedFunnelId: legacyFunnel.id,
      host: IMMUNOTEC_HOST,
      normalizedHost: normalizeHost(IMMUNOTEC_HOST),
      status: 'active',
      onboardingStatus: 'active',
      domainType: 'system_subdomain',
      isPrimary: true,
      canonicalHost: IMMUNOTEC_HOST,
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

  const funnelInstance = await prisma.funnelInstance.upsert({
    where: {
      teamId_code: {
        teamId: team.id,
        code: IMMUNOTEC_FUNNEL_CODE,
      },
    },
    update: {
      workspaceId: workspace.id,
      templateId: funnelTemplate.id,
      legacyFunnelId: legacyFunnel.id,
      name: IMMUNOTEC_FUNNEL_NAME,
      status: 'active',
      rotationPoolId: null,
      trackingProfileId: null,
      handoffStrategyId: null,
      settingsJson: {
        theme: 'jakawi-premium',
        locale: 'es',
        structureId: IMMUNOTEC_STRUCTURE_ID,
        hybridEditor: {
          mode: 'data-driven-assembly',
          structureId: IMMUNOTEC_STRUCTURE_ID,
          templateId: IMMUNOTEC_TEMPLATE_ID,
          blocksJson: immunotecBlocks,
        },
        seo: {
          title: IMMUNOTEC_FUNNEL_NAME,
          metaDescription:
            'Publicación ancla de recuperación para Immunotec dentro de Leadflow.',
        },
      },
      mediaMap: {
        heroImage:
          'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80',
      },
    },
    create: {
      workspaceId: workspace.id,
      teamId: team.id,
      templateId: funnelTemplate.id,
      legacyFunnelId: legacyFunnel.id,
      name: IMMUNOTEC_FUNNEL_NAME,
      code: IMMUNOTEC_FUNNEL_CODE,
      status: 'active',
      rotationPoolId: null,
      trackingProfileId: null,
      handoffStrategyId: null,
      settingsJson: {
        theme: 'jakawi-premium',
        locale: 'es',
        structureId: IMMUNOTEC_STRUCTURE_ID,
        hybridEditor: {
          mode: 'data-driven-assembly',
          structureId: IMMUNOTEC_STRUCTURE_ID,
          templateId: IMMUNOTEC_TEMPLATE_ID,
          blocksJson: immunotecBlocks,
        },
        seo: {
          title: IMMUNOTEC_FUNNEL_NAME,
          metaDescription:
            'Publicación ancla de recuperación para Immunotec dentro de Leadflow.',
        },
      },
      mediaMap: {
        heroImage:
          'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80',
      },
    },
  });

  await prisma.funnelStep.deleteMany({
    where: { funnelInstanceId: funnelInstance.id },
  });

  await prisma.funnelStep.create({
    data: {
      workspaceId: workspace.id,
      teamId: team.id,
      funnelInstanceId: funnelInstance.id,
      stepType: 'landing',
      slug: 'landing',
      position: 1,
      isEntryStep: true,
      isConversionStep: false,
      blocksJson: immunotecBlocks,
      mediaMap: {
        heroImage:
          'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80',
      },
      settingsJson: {
        editorSource: 'team-publications-new-vsl',
        templateCode: IMMUNOTEC_TEMPLATE_ID,
        hybridRenderer: 'jakawi-bridge',
        structureId: IMMUNOTEC_STRUCTURE_ID,
        blocksJson: immunotecBlocks,
        seo: {
          title: IMMUNOTEC_FUNNEL_NAME,
          metaDescription:
            'Publicación ancla de recuperación para Immunotec dentro de Leadflow.',
        },
      },
    },
  });

  await prisma.funnelPublication.upsert({
    where: {
      domainId_pathPrefix: {
        domainId: domain.id,
        pathPrefix: '/',
      },
    },
    update: {
      workspaceId: workspace.id,
      teamId: team.id,
      funnelInstanceId: funnelInstance.id,
      trackingProfileId: null,
      handoffStrategyId: null,
      status: 'active',
      isPrimary: true,
      isActive: true,
    },
    create: {
      workspaceId: workspace.id,
      teamId: team.id,
      domainId: domain.id,
      funnelInstanceId: funnelInstance.id,
      trackingProfileId: null,
      handoffStrategyId: null,
      pathPrefix: '/',
      status: 'active',
      isPrimary: true,
      isActive: true,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
