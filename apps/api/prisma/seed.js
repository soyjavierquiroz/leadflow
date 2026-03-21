const { PrismaClient } = require('@prisma/client');
const { randomBytes, scryptSync } = require('crypto');

const prisma = new PrismaClient();
const DEFAULT_KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, DEFAULT_KEY_LENGTH).toString(
    'hex',
  );

  return `scrypt$${salt}$${derivedKey}`;
}

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'leadflow-dev' },
    update: {
      name: 'Leadflow Dev Workspace',
      status: 'active',
      timezone: 'UTC',
      defaultCurrency: 'USD',
      primaryLocale: 'es',
      primaryDomain: 'localhost',
    },
    create: {
      name: 'Leadflow Dev Workspace',
      slug: 'leadflow-dev',
      status: 'active',
      timezone: 'UTC',
      defaultCurrency: 'USD',
      primaryLocale: 'es',
      primaryDomain: 'localhost',
    },
  });

  const team = await prisma.team.upsert({
    where: {
      workspaceId_code: {
        workspaceId: workspace.id,
        code: 'sales-core',
      },
    },
    update: {
      name: 'Sales Core',
      status: 'active',
      description: 'Equipo comercial base para desarrollo.',
    },
    create: {
      workspaceId: workspace.id,
      name: 'Sales Core',
      code: 'sales-core',
      status: 'active',
      description: 'Equipo comercial base para desarrollo.',
    },
  });

  const sponsorA = await prisma.sponsor.upsert({
    where: { id: '3be5f7f2-c6ae-47cb-a2bb-e1c869f7db11' },
    update: {
      workspaceId: workspace.id,
      teamId: team.id,
      displayName: 'Ana Sponsor',
      status: 'active',
      email: 'ana@leadflow.local',
      phone: '+52 55 5000 0099',
      availabilityStatus: 'available',
      routingWeight: 1,
      memberPortalEnabled: true,
    },
    create: {
      id: '3be5f7f2-c6ae-47cb-a2bb-e1c869f7db11',
      workspaceId: workspace.id,
      teamId: team.id,
      displayName: 'Ana Sponsor',
      status: 'active',
      email: 'ana@leadflow.local',
      phone: '+52 55 5000 0099',
      availabilityStatus: 'available',
      routingWeight: 1,
      memberPortalEnabled: true,
    },
  });

  const sponsorB = await prisma.sponsor.upsert({
    where: { id: '88623ff4-fb9c-4040-b737-fca5ae259c79' },
    update: {
      workspaceId: workspace.id,
      teamId: team.id,
      displayName: 'Bruno Sponsor',
      status: 'active',
      email: 'bruno@leadflow.local',
      phone: '+52 55 5000 0199',
      availabilityStatus: 'available',
      routingWeight: 1,
      memberPortalEnabled: true,
    },
    create: {
      id: '88623ff4-fb9c-4040-b737-fca5ae259c79',
      workspaceId: workspace.id,
      teamId: team.id,
      displayName: 'Bruno Sponsor',
      status: 'active',
      email: 'bruno@leadflow.local',
      phone: '+52 55 5000 0199',
      availabilityStatus: 'available',
      routingWeight: 1,
      memberPortalEnabled: true,
    },
  });

  await prisma.authSession.deleteMany();

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

  const teamAdminUser = await prisma.user.upsert({
    where: { email: 'team@leadflow.local' },
    update: {
      workspaceId: workspace.id,
      teamId: team.id,
      sponsorId: null,
      fullName: 'Leadflow Team Admin',
      passwordHash: hashPassword('Team123!'),
      role: 'TEAM_ADMIN',
      status: 'active',
    },
    create: {
      workspaceId: workspace.id,
      teamId: team.id,
      fullName: 'Leadflow Team Admin',
      email: 'team@leadflow.local',
      passwordHash: hashPassword('Team123!'),
      role: 'TEAM_ADMIN',
      status: 'active',
    },
  });

  await prisma.user.upsert({
    where: { email: 'ana.member@leadflow.local' },
    update: {
      workspaceId: workspace.id,
      teamId: team.id,
      sponsorId: sponsorA.id,
      fullName: 'Ana Member',
      passwordHash: hashPassword('Member123!'),
      role: 'MEMBER',
      status: 'active',
    },
    create: {
      workspaceId: workspace.id,
      teamId: team.id,
      sponsorId: sponsorA.id,
      fullName: 'Ana Member',
      email: 'ana.member@leadflow.local',
      passwordHash: hashPassword('Member123!'),
      role: 'MEMBER',
      status: 'active',
    },
  });

  await prisma.user.upsert({
    where: { email: 'bruno.member@leadflow.local' },
    update: {
      workspaceId: workspace.id,
      teamId: team.id,
      sponsorId: sponsorB.id,
      fullName: 'Bruno Member',
      passwordHash: hashPassword('Member456!'),
      role: 'MEMBER',
      status: 'active',
    },
    create: {
      workspaceId: workspace.id,
      teamId: team.id,
      sponsorId: sponsorB.id,
      fullName: 'Bruno Member',
      email: 'bruno.member@leadflow.local',
      passwordHash: hashPassword('Member456!'),
      role: 'MEMBER',
      status: 'active',
    },
  });

  await prisma.team.update({
    where: { id: team.id },
    data: {
      managerUserId: teamAdminUser.id,
    },
  });

  const rotationPool = await prisma.rotationPool.upsert({
    where: {
      workspaceId_name: {
        workspaceId: workspace.id,
        name: 'Primary Sales Pool',
      },
    },
    update: {
      teamId: team.id,
      status: 'active',
      strategy: 'round_robin',
      isFallbackPool: false,
    },
    create: {
      workspaceId: workspace.id,
      teamId: team.id,
      name: 'Primary Sales Pool',
      status: 'active',
      strategy: 'round_robin',
      isFallbackPool: false,
    },
  });

  const legacyFunnel = await prisma.funnel.upsert({
    where: {
      workspaceId_code: {
        workspaceId: workspace.id,
        code: 'core-acquisition',
      },
    },
    update: {
      name: 'Core Acquisition Legacy',
      status: 'active',
      stages: ['captured', 'qualified', 'assigned'],
      entrySources: ['manual', 'form', 'landing_page', 'api'],
      defaultTeamId: team.id,
      defaultRotationPoolId: rotationPool.id,
    },
    create: {
      workspaceId: workspace.id,
      name: 'Core Acquisition Legacy',
      code: 'core-acquisition',
      status: 'active',
      stages: ['captured', 'qualified', 'assigned'],
      entrySources: ['manual', 'form', 'landing_page', 'api'],
      defaultTeamId: team.id,
      defaultRotationPoolId: rotationPool.id,
    },
  });

  const domain = await prisma.domain.upsert({
    where: { host: 'localhost' },
    update: {
      workspaceId: workspace.id,
      teamId: team.id,
      status: 'active',
      kind: 'apex',
      isPrimary: true,
    },
    create: {
      workspaceId: workspace.id,
      teamId: team.id,
      host: 'localhost',
      status: 'active',
      kind: 'apex',
      isPrimary: true,
    },
  });

  const thankYouHandoffStrategy = await prisma.handoffStrategy.upsert({
    where: {
      workspaceId_teamId_name: {
        workspaceId: workspace.id,
        teamId: team.id,
        name: 'Thank You WhatsApp Handoff',
      },
    },
    update: {
      type: 'content_continuation',
      status: 'active',
      settingsJson: {
        mode: 'thank_you_then_whatsapp',
        channel: 'whatsapp',
        buttonLabel: 'Hablar por WhatsApp',
        autoRedirect: false,
        messageTemplate:
          'Hola {{sponsorName}}, soy {{leadName}}. Acabo de completar {{funnelName}} y quiero continuar por WhatsApp.',
      },
    },
    create: {
      workspaceId: workspace.id,
      teamId: team.id,
      name: 'Thank You WhatsApp Handoff',
      type: 'content_continuation',
      status: 'active',
      settingsJson: {
        mode: 'thank_you_then_whatsapp',
        channel: 'whatsapp',
        buttonLabel: 'Hablar por WhatsApp',
        autoRedirect: false,
        messageTemplate:
          'Hola {{sponsorName}}, soy {{leadName}}. Acabo de completar {{funnelName}} y quiero continuar por WhatsApp.',
      },
    },
  });

  const immediateWhatsappHandoffStrategy = await prisma.handoffStrategy.upsert({
    where: {
      workspaceId_teamId_name: {
        workspaceId: workspace.id,
        teamId: team.id,
        name: 'Immediate WhatsApp Handoff',
      },
    },
    update: {
      type: 'immediate_whatsapp',
      status: 'active',
      settingsJson: {
        mode: 'immediate_whatsapp',
        channel: 'whatsapp',
        buttonLabel: 'Abrir WhatsApp ahora',
        autoRedirect: true,
        autoRedirectDelayMs: 1200,
        messageTemplate:
          'Hola {{sponsorName}}, soy {{leadName}}. Acabo de enviar mis datos en {{funnelName}} ({{publicationPath}}) y quiero continuar.',
      },
    },
    create: {
      workspaceId: workspace.id,
      teamId: team.id,
      name: 'Immediate WhatsApp Handoff',
      type: 'immediate_whatsapp',
      status: 'active',
      settingsJson: {
        mode: 'immediate_whatsapp',
        channel: 'whatsapp',
        buttonLabel: 'Abrir WhatsApp ahora',
        autoRedirect: true,
        autoRedirectDelayMs: 1200,
        messageTemplate:
          'Hola {{sponsorName}}, soy {{leadName}}. Acabo de enviar mis datos en {{funnelName}} ({{publicationPath}}) y quiero continuar.',
      },
    },
  });

  const trackingProfile = await prisma.trackingProfile.upsert({
    where: {
      teamId_name: {
        teamId: team.id,
        name: 'Meta Core Tracking',
      },
    },
    update: {
      workspaceId: workspace.id,
      provider: 'meta',
      status: 'active',
      deduplicationMode: 'browser_server',
      configJson: {
        pixelId: 'META-DEV-PIXEL',
        conversionsApiEnabled: false,
      },
    },
    create: {
      workspaceId: workspace.id,
      teamId: team.id,
      name: 'Meta Core Tracking',
      provider: 'meta',
      status: 'active',
      deduplicationMode: 'browser_server',
      configJson: {
        pixelId: 'META-DEV-PIXEL',
        conversionsApiEnabled: false,
      },
    },
  });

  await prisma.conversionEventMapping.deleteMany({
    where: { trackingProfileId: trackingProfile.id },
  });

  await prisma.conversionEventMapping.createMany({
    data: [
      {
        trackingProfileId: trackingProfile.id,
        internalEventName: 'lead_created',
        providerEventName: 'Lead',
        isBrowserSide: true,
        isServerSide: true,
        isCriticalConversion: true,
      },
      {
        trackingProfileId: trackingProfile.id,
        internalEventName: 'handoff_started',
        providerEventName: 'Contact',
        isBrowserSide: true,
        isServerSide: false,
        isCriticalConversion: false,
      },
    ],
  });

  const funnelTemplate = await prisma.funnelTemplate.upsert({
    where: { code: 'lf-simple-capture-v1' },
    update: {
      name: 'Leadflow Simple Capture v1',
      status: 'active',
      version: 1,
      funnelType: 'simple_capture',
      blocksJson: {
        blocks: [
          {
            type: 'hero',
            key: 'hero-main',
            eyebrow: 'Leadflow Runtime',
            title: 'Public funnel runtime listo para crecer',
            description:
              'Este template base publica funnels por host + path y renderiza bloques JSON-driven sin acoplar la experiencia a un dominio fijo.',
          },
          {
            type: 'text',
            key: 'text-positioning',
            title: 'Base JSON-driven',
            body: 'La estructura del funnel queda en manos de plataforma, mientras el team opera dominios, tracking, pools y publicaciones.',
          },
          {
            type: 'form_placeholder',
            key: 'form-placeholder',
            title: 'Captura y assignment MVP',
            description:
              'Este bloque ya puede registrar visitante, capturar lead y ejecutar assignment simple por round robin.',
            fields: ['Nombre', 'Telefono', 'Email'],
          },
        ],
      },
      mediaMap: {
        heroImage:
          'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
      },
      settingsJson: {
        theme: 'runtime-v1',
        locale: 'es',
      },
      allowedOverridesJson: {
        editableFields: ['hero', 'text', 'faq', 'cta', 'media'],
      },
      defaultHandoffStrategyId: thankYouHandoffStrategy.id,
    },
    create: {
      name: 'Leadflow Simple Capture v1',
      code: 'lf-simple-capture-v1',
      status: 'active',
      version: 1,
      funnelType: 'simple_capture',
      blocksJson: {
        blocks: [
          {
            type: 'hero',
            key: 'hero-main',
            eyebrow: 'Leadflow Runtime',
            title: 'Public funnel runtime listo para crecer',
            description:
              'Este template base publica funnels por host + path y renderiza bloques JSON-driven sin acoplar la experiencia a un dominio fijo.',
          },
          {
            type: 'text',
            key: 'text-positioning',
            title: 'Base JSON-driven',
            body: 'La estructura del funnel queda en manos de plataforma, mientras el team opera dominios, tracking, pools y publicaciones.',
          },
          {
            type: 'form_placeholder',
            key: 'form-placeholder',
            title: 'Captura y assignment MVP',
            description:
              'Este bloque ya puede registrar visitante, capturar lead y ejecutar assignment simple por round robin.',
            fields: ['Nombre', 'Telefono', 'Email'],
          },
        ],
      },
      mediaMap: {
        heroImage:
          'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1200&q=80',
      },
      settingsJson: {
        theme: 'runtime-v1',
        locale: 'es',
      },
      allowedOverridesJson: {
        editableFields: ['hero', 'text', 'faq', 'cta', 'media'],
      },
      defaultHandoffStrategyId: thankYouHandoffStrategy.id,
    },
  });

  const funnelInstance = await prisma.funnelInstance.upsert({
    where: {
      teamId_code: {
        teamId: team.id,
        code: 'sales-core-capture',
      },
    },
    update: {
      workspaceId: workspace.id,
      templateId: funnelTemplate.id,
      legacyFunnelId: legacyFunnel.id,
      name: 'Sales Core Capture',
      status: 'active',
      rotationPoolId: rotationPool.id,
      trackingProfileId: trackingProfile.id,
      handoffStrategyId: thankYouHandoffStrategy.id,
      settingsJson: {
        theme: 'signal',
        locale: 'es',
        badge: 'Equipo Sales Core',
      },
      mediaMap: {
        heroImage:
          'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
        introVideo:
          'https://www.youtube.com/embed/dQw4w9WgXcQ?si=leadflow-runtime-v1',
      },
    },
    create: {
      workspaceId: workspace.id,
      teamId: team.id,
      templateId: funnelTemplate.id,
      legacyFunnelId: legacyFunnel.id,
      name: 'Sales Core Capture',
      code: 'sales-core-capture',
      status: 'active',
      rotationPoolId: rotationPool.id,
      trackingProfileId: trackingProfile.id,
      handoffStrategyId: thankYouHandoffStrategy.id,
      settingsJson: {
        theme: 'signal',
        locale: 'es',
        badge: 'Equipo Sales Core',
      },
      mediaMap: {
        heroImage:
          'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
        introVideo:
          'https://www.youtube.com/embed/dQw4w9WgXcQ?si=leadflow-runtime-v1',
      },
    },
  });

  await prisma.funnelStep.deleteMany({
    where: { funnelInstanceId: funnelInstance.id },
  });

  await prisma.funnelStep.createMany({
    data: [
      {
        workspaceId: workspace.id,
        teamId: team.id,
        funnelInstanceId: funnelInstance.id,
        stepType: 'landing',
        slug: 'landing',
        position: 1,
        isEntryStep: true,
        isConversionStep: false,
        blocksJson: {
          blocks: [
            {
              type: 'hero',
              key: 'hero-main',
              eyebrow: 'Leadflow Public Runtime',
              title: 'Lanza funnels publicos por host + path',
              description:
                'Este funnel demuestra resolucion publica, renderer JSON-driven y compatibilidad con el modelo Team-owned aprobado.',
              accent: 'Teal',
            },
            {
              type: 'text',
              key: 'text-main',
              title: 'Que valida esta fase',
              body: 'Resolucion de publicacion activa, renderer JSON-driven, captura de lead y assignment round robin simples sobre el pool operativo.',
              items: [
                'Runtime publico por host + path',
                'Renderer extensible para bloques JSON',
                'Lead capture y assignment v1 conectados',
              ],
            },
            {
              type: 'video',
              key: 'video-main',
              title: 'Vista previa del runtime',
              embedUrl:
                'https://www.youtube.com/embed/dQw4w9WgXcQ?si=leadflow-runtime-v1',
              caption:
                'Video placeholder para validar el bloque visual antes de integrar media real.',
            },
            {
              type: 'faq',
              key: 'faq-main',
              title: 'Preguntas rapidas',
              items: [
                {
                  question: 'Se captura el lead en esta fase?',
                  answer:
                    'Si. Esta fase registra visitor, captura lead y ejecuta assignment simple usando el rotation pool del funnel.',
                },
                {
                  question: 'Se soportan subrutas?',
                  answer:
                    'Si. El runtime resuelve host + path y elige la publicacion mas especifica activa.',
                },
              ],
            },
            {
              type: 'form_placeholder',
              key: 'form-placeholder',
              title: 'Formulario MVP',
              description:
                'Completa el formulario para registrar visitor, crear lead y asignarlo al siguiente sponsor elegible.',
              fields: ['Nombre completo', 'WhatsApp', 'Email'],
            },
            {
              type: 'cta',
              key: 'cta-next',
              label: 'Continuar al thank you',
              action: 'next_step',
              variant: 'primary',
            },
          ],
        },
        mediaMap: {
          heroImage:
            'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
        },
        settingsJson: {
          title: 'Landing principal',
          summary: 'Entrada del funnel publicado.',
        },
      },
      {
        workspaceId: workspace.id,
        teamId: team.id,
        funnelInstanceId: funnelInstance.id,
        stepType: 'thank_you',
        slug: 'gracias',
        position: 2,
        isEntryStep: false,
        isConversionStep: true,
        blocksJson: {
          blocks: [
            {
              type: 'thank_you',
              key: 'thank-you-main',
              eyebrow: 'Lead capturado',
              title: 'Tu funnel ya completo captura y assignment v1',
              description:
                'Este step revela el sponsor asignado y deja listo el CTA para continuar el handoff por WhatsApp.',
            },
            {
              type: 'sponsor_reveal_placeholder',
              key: 'sponsor-placeholder',
              title: 'Sponsor asignado en esta sesion',
              description:
                'Aqui mostramos el sponsor asignado y el siguiente paso operativo del handoff usando el contexto real de la sesion.',
            },
            {
              type: 'cta',
              key: 'cta-back-home',
              label: 'Volver al inicio del funnel',
              action: 'entry_step',
              variant: 'secondary',
            },
          ],
        },
        mediaMap: {
          confirmationIllustration:
            'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
        },
        settingsJson: {
          title: 'Gracias por visitar el funnel',
          nextAction: 'whatsapp_handoff',
        },
      },
    ],
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
      trackingProfileId: trackingProfile.id,
      handoffStrategyId: thankYouHandoffStrategy.id,
      status: 'active',
      isPrimary: true,
    },
    create: {
      workspaceId: workspace.id,
      teamId: team.id,
      domainId: domain.id,
      funnelInstanceId: funnelInstance.id,
      trackingProfileId: trackingProfile.id,
      handoffStrategyId: thankYouHandoffStrategy.id,
      pathPrefix: '/',
      status: 'active',
      isPrimary: true,
    },
  });

  await prisma.funnelPublication.upsert({
    where: {
      domainId_pathPrefix: {
        domainId: domain.id,
        pathPrefix: '/oportunidad',
      },
    },
    update: {
      workspaceId: workspace.id,
      teamId: team.id,
      funnelInstanceId: funnelInstance.id,
      trackingProfileId: trackingProfile.id,
      handoffStrategyId: immediateWhatsappHandoffStrategy.id,
      status: 'active',
      isPrimary: false,
    },
    create: {
      workspaceId: workspace.id,
      teamId: team.id,
      domainId: domain.id,
      funnelInstanceId: funnelInstance.id,
      trackingProfileId: trackingProfile.id,
      handoffStrategyId: immediateWhatsappHandoffStrategy.id,
      pathPrefix: '/oportunidad',
      status: 'active',
      isPrimary: false,
    },
  });

  await prisma.rotationMember.deleteMany({
    where: { rotationPoolId: rotationPool.id },
  });

  await prisma.rotationMember.createMany({
    data: [
      {
        rotationPoolId: rotationPool.id,
        sponsorId: sponsorA.id,
        position: 1,
        weight: 1,
        isActive: true,
      },
      {
        rotationPoolId: rotationPool.id,
        sponsorId: sponsorB.id,
        position: 2,
        weight: 1,
        isActive: true,
      },
    ],
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
