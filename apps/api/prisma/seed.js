const { PrismaClient } = require('@prisma/client');
const { randomBytes, scryptSync } = require('crypto');
const salesAuditLandingIntakePack = require('../../web/lib/public-funnel/intake-examples/sales-audit-landing.json');

const prisma = new PrismaClient();
const DEFAULT_KEY_LENGTH = 64;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

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

  await prisma.messagingConnection.upsert({
    where: { sponsorId: sponsorA.id },
    update: {
      workspaceId: workspace.id,
      teamId: team.id,
      provider: 'EVOLUTION',
      status: 'connected',
      externalInstanceId: 'leadflow-sales-core-ana-sponsor-3be5f7f2',
      phone: sponsorA.phone,
      normalizedPhone: '525550000099',
      qrCodeData: null,
      pairingCode: null,
      pairingExpiresAt: null,
      automationWebhookUrl:
        'https://n8n.exitosos.com/webhook/leadflow/leadflow-sales-core-ana-sponsor-3be5f7f2',
      automationEnabled: true,
      metadataJson: {
        seeded: true,
        providerState: 'open',
        note: 'Demo channel connection for Messaging Integrations v1.',
      },
      lastSyncedAt: new Date(),
      lastConnectedAt: new Date(),
      lastDisconnectedAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
    },
    create: {
      workspaceId: workspace.id,
      teamId: team.id,
      sponsorId: sponsorA.id,
      provider: 'EVOLUTION',
      status: 'connected',
      externalInstanceId: 'leadflow-sales-core-ana-sponsor-3be5f7f2',
      phone: sponsorA.phone,
      normalizedPhone: '525550000099',
      qrCodeData: null,
      pairingCode: null,
      pairingExpiresAt: null,
      automationWebhookUrl:
        'https://n8n.exitosos.com/webhook/leadflow/leadflow-sales-core-ana-sponsor-3be5f7f2',
      automationEnabled: true,
      metadataJson: {
        seeded: true,
        providerState: 'open',
        note: 'Demo channel connection for Messaging Integrations v1.',
      },
      lastSyncedAt: new Date(),
      lastConnectedAt: new Date(),
      lastDisconnectedAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
    },
  });

  await prisma.authSession.deleteMany();
  await prisma.leadNote.deleteMany();
  await prisma.conversationSignal.deleteMany();
  await prisma.automationDispatch.deleteMany();
  await prisma.domainEvent.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.visitor.deleteMany();

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
    where: { normalizedHost: 'localhost' },
    update: {
      workspaceId: workspace.id,
      teamId: team.id,
      host: 'localhost',
      normalizedHost: 'localhost',
      status: 'active',
      onboardingStatus: 'active',
      domainType: 'system_subdomain',
      isPrimary: true,
      canonicalHost: 'localhost',
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
      host: 'localhost',
      normalizedHost: 'localhost',
      status: 'active',
      onboardingStatus: 'active',
      domainType: 'system_subdomain',
      isPrimary: true,
      canonicalHost: 'localhost',
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

  const secondaryDomainHost = 'promo.acme.test';
  const secondaryDomain = await prisma.domain.upsert({
    where: { normalizedHost: normalizeHost(secondaryDomainHost) },
    update: {
      workspaceId: workspace.id,
      teamId: team.id,
      host: secondaryDomainHost,
      normalizedHost: normalizeHost(secondaryDomainHost),
      status: 'active',
      onboardingStatus: 'active',
      domainType: 'custom_subdomain',
      isPrimary: false,
      canonicalHost: secondaryDomainHost,
      redirectToPrimary: false,
      verificationStatus: 'verified',
      sslStatus: 'active',
      verificationMethod: 'cname',
      cloudflareCustomHostnameId: 'cf-custom-hostname-promo-acme-test',
      cloudflareStatusJson: {
        id: 'cf-custom-hostname-promo-acme-test',
        hostname: secondaryDomainHost,
        status: 'active',
        customOriginServer: 'proxy-fallback.exitosos.com',
        verificationErrors: [],
        ownershipVerification: null,
        ssl: {
          status: 'active',
          method: 'http',
          type: 'dv',
          validationErrors: [],
          validationRecords: [],
        },
        error: null,
        raw: null,
      },
      dnsTarget: 'customers.exitosos.com',
      lastCloudflareSyncAt: new Date(),
      activatedAt: new Date(),
    },
    create: {
      workspaceId: workspace.id,
      teamId: team.id,
      host: secondaryDomainHost,
      normalizedHost: normalizeHost(secondaryDomainHost),
      status: 'active',
      onboardingStatus: 'active',
      domainType: 'custom_subdomain',
      isPrimary: false,
      canonicalHost: secondaryDomainHost,
      redirectToPrimary: false,
      verificationStatus: 'verified',
      sslStatus: 'active',
      verificationMethod: 'cname',
      cloudflareCustomHostnameId: 'cf-custom-hostname-promo-acme-test',
      cloudflareStatusJson: {
        id: 'cf-custom-hostname-promo-acme-test',
        hostname: secondaryDomainHost,
        status: 'active',
        customOriginServer: 'proxy-fallback.exitosos.com',
        verificationErrors: [],
        ownershipVerification: null,
        ssl: {
          status: 'active',
          method: 'http',
          type: 'dv',
          validationErrors: [],
          validationRecords: [],
        },
        error: null,
        raw: null,
      },
      dnsTarget: 'customers.exitosos.com',
      lastCloudflareSyncAt: new Date(),
      activatedAt: new Date(),
    },
  });

  const pendingDomainHost = 'cliente-demo.acme.test';
  await prisma.domain.upsert({
    where: { normalizedHost: normalizeHost(pendingDomainHost) },
    update: {
      workspaceId: workspace.id,
      teamId: team.id,
      host: pendingDomainHost,
      normalizedHost: normalizeHost(pendingDomainHost),
      status: 'draft',
      onboardingStatus: 'pending_dns',
      domainType: 'custom_subdomain',
      isPrimary: false,
      canonicalHost: pendingDomainHost,
      redirectToPrimary: false,
      verificationStatus: 'pending',
      sslStatus: 'pending',
      verificationMethod: 'cname',
      cloudflareCustomHostnameId: null,
      cloudflareStatusJson: null,
      dnsTarget: 'customers.exitosos.com',
      lastCloudflareSyncAt: null,
      activatedAt: null,
    },
    create: {
      workspaceId: workspace.id,
      teamId: team.id,
      host: pendingDomainHost,
      normalizedHost: normalizeHost(pendingDomainHost),
      status: 'draft',
      onboardingStatus: 'pending_dns',
      domainType: 'custom_subdomain',
      isPrimary: false,
      canonicalHost: pendingDomainHost,
      redirectToPrimary: false,
      verificationStatus: 'pending',
      sslStatus: 'pending',
      verificationMethod: 'cname',
      cloudflareCustomHostnameId: null,
      cloudflareStatusJson: null,
      dnsTarget: 'customers.exitosos.com',
      lastCloudflareSyncAt: null,
      activatedAt: null,
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
            eyebrow: 'Leadflow Revenue Engine',
            title: 'Funnels públicos listos para capturar y derivar oportunidades reales',
            description:
              'Este template base publica funnels por host + path y compone bloques comerciales reutilizables sin romper el runtime estándar.',
          },
          {
            type: 'hook_and_promise',
            key: 'hook-main',
            eyebrow: 'Captación declarativa',
            hook: 'Convierte tráfico frío en conversaciones listas para handoff sin depender de páginas hechas a mano.',
            promise:
              'Leadflow deja el funnel, la captura, el assignment, el reveal y el handoff en un runtime JSON-driven listo para iterar.',
          },
          {
            type: 'lead_capture_form',
            key: 'template-capture-form',
            eyebrow: 'Lead Capture Form Block v1',
            headline: 'Solicita una demo del flujo comercial',
            subheadline:
              'Bloque real del runtime para capturar contacto, contexto y continuidad usando el motor estándar de Leadflow.',
            button_text: 'Quiero mi demo',
            helper_text:
              'Completa nombre y un medio de contacto para continuar al siguiente step.',
            privacy_note:
              'Usamos esta información para procesar tu solicitud y continuar la conversación comercial dentro del funnel.',
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
              tags: ['runtime-v1', 'lead-capture-form-v1'],
            },
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
            eyebrow: 'Leadflow Revenue Engine',
            title: 'Funnels públicos listos para capturar y derivar oportunidades reales',
            description:
              'Este template base publica funnels por host + path y compone bloques comerciales reutilizables sin romper el runtime estándar.',
          },
          {
            type: 'hook_and_promise',
            key: 'hook-main',
            eyebrow: 'Captación declarativa',
            hook: 'Convierte tráfico frío en conversaciones listas para handoff sin depender de páginas hechas a mano.',
            promise:
              'Leadflow deja el funnel, la captura, el assignment, el reveal y el handoff en un runtime JSON-driven listo para iterar.',
          },
          {
            type: 'lead_capture_form',
            key: 'template-capture-form',
            eyebrow: 'Lead Capture Form Block v1',
            headline: 'Solicita una demo del flujo comercial',
            subheadline:
              'Bloque real del runtime para capturar contacto, contexto y continuidad usando el motor estándar de Leadflow.',
            button_text: 'Quiero mi demo',
            helper_text:
              'Completa nombre y un medio de contacto para continuar al siguiente step.',
            privacy_note:
              'Usamos esta información para procesar tu solicitud y continuar la conversación comercial dentro del funnel.',
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
              tags: ['runtime-v1', 'lead-capture-form-v1'],
            },
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
        blocksJson: cloneJson(salesAuditLandingIntakePack),
        mediaMap: {
          heroImage:
            'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
        },
        settingsJson: {
          title: 'Landing principal',
          summary: 'Entrada del funnel publicado usando intake pack compatible.',
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
              type: 'thank_you_reveal',
              key: 'thank-you-reveal-main',
              eyebrow: 'Lead capturado',
              headline: 'Tu solicitud ya quedó registrada y asignada',
              subheadline:
                'Este step combina confirmación visible con reveal usando el contexto real de la sesión.',
              reveal_headline: 'Sponsor asignado para continuar contigo',
              reveal_subheadline:
                'Mostramos al sponsor real y mantenemos la continuidad del handoff sin salirnos del runtime público.',
            },
            {
              type: 'whatsapp_handoff_cta',
              key: 'whatsapp-handoff-main',
              headline: 'Continúa por WhatsApp',
              subheadline:
                'Cuando el sponsor ya está resuelto, este bloque usa el contexto del runtime para disparar la continuidad comercial.',
              button_text: 'Abrir WhatsApp ahora',
              helper_text:
                'Si el handoff no se abre automáticamente, este CTA mantiene el siguiente paso visible.',
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

  const rootPublication = await prisma.funnelPublication.upsert({
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

  const opportunityPublication = await prisma.funnelPublication.upsert({
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

  await prisma.funnelPublication.upsert({
    where: {
      domainId_pathPrefix: {
        domainId: secondaryDomain.id,
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
      domainId: secondaryDomain.id,
      funnelInstanceId: funnelInstance.id,
      trackingProfileId: trackingProfile.id,
      handoffStrategyId: thankYouHandoffStrategy.id,
      pathPrefix: '/',
      status: 'active',
      isPrimary: true,
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

  const seededVisitors = [
    {
      id: 'visitor-maria-santos',
      anonymousId: 'anon-maria-santos',
      sourceChannel: 'form',
      firstSeenAt: new Date('2026-03-24T14:00:00.000Z'),
      lastSeenAt: new Date('2026-03-24T14:01:00.000Z'),
      utmSource: 'meta',
      utmCampaign: 'warm-remarketing',
    },
    {
      id: 'visitor-carlos-rivera',
      anonymousId: 'anon-carlos-rivera',
      sourceChannel: 'form',
      firstSeenAt: new Date('2026-03-25T09:00:00.000Z'),
      lastSeenAt: new Date('2026-03-25T09:02:00.000Z'),
      utmSource: 'google',
      utmCampaign: 'intent-search',
    },
    {
      id: 'visitor-andrea-lopez',
      anonymousId: 'anon-andrea-lopez',
      sourceChannel: 'landing_page',
      firstSeenAt: new Date('2026-03-25T10:30:00.000Z'),
      lastSeenAt: new Date('2026-03-25T10:32:00.000Z'),
      utmSource: 'organic',
      utmCampaign: 'content-cold',
    },
    {
      id: 'visitor-lucia-mendez',
      anonymousId: 'anon-lucia-mendez',
      sourceChannel: 'form',
      firstSeenAt: new Date('2026-03-25T11:00:00.000Z'),
      lastSeenAt: new Date('2026-03-25T11:01:00.000Z'),
      utmSource: 'meta',
      utmCampaign: 'new-leads',
    },
  ];

  await prisma.visitor.createMany({
    data: seededVisitors.map((visitor) => ({
      id: visitor.id,
      workspaceId: workspace.id,
      anonymousId: visitor.anonymousId,
      kind: 'identified',
      status: 'converted',
      sourceChannel: visitor.sourceChannel,
      firstSeenAt: visitor.firstSeenAt,
      lastSeenAt: visitor.lastSeenAt,
      utmSource: visitor.utmSource,
      utmCampaign: visitor.utmCampaign,
    })),
  });

  const seededLeads = [
    {
      id: 'lead-maria-santos',
      visitorId: seededVisitors[0].id,
      sponsorId: sponsorA.id,
      assignmentId: 'assignment-maria-ana',
      publicationId: rootPublication.id,
      sourceChannel: 'form',
      fullName: 'Maria Santos',
      email: 'maria@empresa.co',
      phone: '+57 310 222 3000',
      companyName: 'Santos Growth',
      status: 'nurturing',
      qualificationGrade: 'warm',
      summaryText:
        'Lead con conversacion abierta. Pidio retomar cuando vuelva de una reunion interna.',
      nextActionLabel: 'Retomar WhatsApp con contexto comercial',
      followUpAt: new Date('2026-03-24T16:30:00.000Z'),
      lastContactedAt: new Date('2026-03-24T12:00:00.000Z'),
      lastQualifiedAt: new Date('2026-03-24T12:05:00.000Z'),
      tags: ['remarketing', 'follow-up'],
      createdAt: new Date('2026-03-24T11:55:00.000Z'),
      updatedAt: new Date('2026-03-24T12:05:00.000Z'),
    },
    {
      id: 'lead-carlos-rivera',
      visitorId: seededVisitors[1].id,
      sponsorId: sponsorB.id,
      assignmentId: 'assignment-carlos-bruno',
      publicationId: opportunityPublication.id,
      sourceChannel: 'form',
      fullName: 'Carlos Rivera',
      email: 'carlos@rivera.io',
      phone: '+57 300 443 9010',
      companyName: 'Rivera Studio',
      status: 'qualified',
      qualificationGrade: 'hot',
      summaryText:
        'Lead con alta intencion. Quiere propuesta y disponibilidad para demo hoy mismo.',
      nextActionLabel: 'Enviar propuesta corta y confirmar demo',
      followUpAt: new Date('2026-03-25T17:00:00.000Z'),
      lastContactedAt: new Date('2026-03-25T09:45:00.000Z'),
      lastQualifiedAt: new Date('2026-03-25T09:50:00.000Z'),
      tags: ['high-intent', 'demo'],
      createdAt: new Date('2026-03-25T09:02:00.000Z'),
      updatedAt: new Date('2026-03-25T09:50:00.000Z'),
    },
    {
      id: 'lead-andrea-lopez',
      visitorId: seededVisitors[2].id,
      sponsorId: sponsorA.id,
      assignmentId: 'assignment-andrea-ana',
      publicationId: rootPublication.id,
      sourceChannel: 'landing_page',
      fullName: 'Andrea Lopez',
      email: 'andrea@north.dev',
      phone: '+57 321 555 2200',
      companyName: 'North Dev',
      status: 'captured',
      qualificationGrade: 'cold',
      summaryText:
        'Aun no responde. Conviene reintentar con mensaje breve y validar timing.',
      nextActionLabel: 'Reintentar con mensaje corto manana',
      followUpAt: new Date('2026-03-27T15:00:00.000Z'),
      lastContactedAt: null,
      lastQualifiedAt: null,
      tags: ['cold', 'reactivation'],
      createdAt: new Date('2026-03-25T10:32:00.000Z'),
      updatedAt: new Date('2026-03-25T10:35:00.000Z'),
    },
    {
      id: 'lead-lucia-mendez',
      visitorId: seededVisitors[3].id,
      sponsorId: sponsorB.id,
      assignmentId: 'assignment-lucia-bruno',
      publicationId: rootPublication.id,
      sourceChannel: 'form',
      fullName: 'Lucia Mendez',
      email: 'lucia@mendez.mx',
      phone: '+52 55 9000 7788',
      companyName: 'Mendez Retail',
      status: 'assigned',
      qualificationGrade: null,
      summaryText:
        'Lead nuevo recien capturado. Todavia no hay contacto ni seguimiento agendado.',
      nextActionLabel: null,
      followUpAt: null,
      lastContactedAt: null,
      lastQualifiedAt: null,
      tags: ['new', 'unscheduled'],
      createdAt: new Date('2026-03-25T11:01:00.000Z'),
      updatedAt: new Date('2026-03-25T11:01:00.000Z'),
    },
  ];

  await prisma.lead.createMany({
    data: seededLeads.map((lead) => ({
      id: lead.id,
      workspaceId: workspace.id,
      funnelId: legacyFunnel.id,
      funnelInstanceId: funnelInstance.id,
      funnelPublicationId: lead.publicationId,
      visitorId: lead.visitorId,
      sourceChannel: lead.sourceChannel,
      fullName: lead.fullName,
      email: lead.email,
      phone: lead.phone,
      companyName: lead.companyName,
      status: lead.status,
      qualificationGrade: lead.qualificationGrade,
      summaryText: lead.summaryText,
      nextActionLabel: lead.nextActionLabel,
      followUpAt: lead.followUpAt,
      lastContactedAt: lead.lastContactedAt,
      lastQualifiedAt: lead.lastQualifiedAt,
      currentAssignmentId: null,
      tags: lead.tags,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    })),
  });

  await prisma.assignment.createMany({
    data: seededLeads.map((lead) => ({
      id: lead.assignmentId,
      workspaceId: workspace.id,
      leadId: lead.id,
      sponsorId: lead.sponsorId,
      teamId: team.id,
      funnelId: legacyFunnel.id,
      funnelInstanceId: funnelInstance.id,
      funnelPublicationId: lead.publicationId,
      rotationPoolId: rotationPool.id,
      status: lead.id === 'lead-lucia-mendez' ? 'assigned' : 'accepted',
      reason: 'rotation',
      assignedAt: lead.createdAt,
      resolvedAt: null,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    })),
  });

  for (const lead of seededLeads) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        currentAssignmentId: lead.assignmentId,
      },
    });
  }

  await prisma.conversationSignal.createMany({
    data: [
      {
        id: 'signal-maria-follow-up',
        workspaceId: workspace.id,
        teamId: team.id,
        sponsorId: sponsorA.id,
        leadId: 'lead-maria-santos',
        assignmentId: 'assignment-maria-ana',
        messagingConnectionId: null,
        automationDispatchId: null,
        source: 'n8n',
        signalType: 'lead_follow_up',
        processingStatus: 'applied',
        externalEventId: 'evt-maria-follow-up',
        payloadSnapshot: {
          note: 'Lead pidió retomar la conversación al día siguiente.',
        },
        errorCode: null,
        errorMessage: null,
        leadStatusAfter: 'nurturing',
        assignmentStatusAfter: 'accepted',
        occurredAt: new Date('2026-03-24T12:00:00.000Z'),
        processedAt: new Date('2026-03-24T12:00:05.000Z'),
      },
      {
        id: 'signal-carlos-qualified',
        workspaceId: workspace.id,
        teamId: team.id,
        sponsorId: sponsorB.id,
        leadId: 'lead-carlos-rivera',
        assignmentId: 'assignment-carlos-bruno',
        messagingConnectionId: null,
        automationDispatchId: null,
        source: 'evolution',
        signalType: 'lead_qualified',
        processingStatus: 'applied',
        externalEventId: 'evt-carlos-qualified',
        payloadSnapshot: {
          note: 'Lead confirmó interés y pidió propuesta.',
        },
        errorCode: null,
        errorMessage: null,
        leadStatusAfter: 'qualified',
        assignmentStatusAfter: 'accepted',
        occurredAt: new Date('2026-03-25T09:50:00.000Z'),
        processedAt: new Date('2026-03-25T09:50:03.000Z'),
      },
    ],
  });

  await prisma.leadNote.createMany({
    data: [
      {
        id: 'note-maria-context',
        workspaceId: workspace.id,
        teamId: team.id,
        leadId: 'lead-maria-santos',
        sponsorId: sponsorA.id,
        authorUserId: teamAdminUser.id,
        authorRole: 'TEAM_ADMIN',
        authorName: 'Leadflow Team Admin',
        body: 'Conviene retomar con contexto de ROI y no con pitch largo.',
      },
      {
        id: 'note-lucia-first-touch',
        workspaceId: workspace.id,
        teamId: team.id,
        leadId: 'lead-lucia-mendez',
        sponsorId: sponsorB.id,
        authorUserId: teamAdminUser.id,
        authorRole: 'TEAM_ADMIN',
        authorName: 'Leadflow Team Admin',
        body: 'Lead nuevo. Priorizar primer contacto antes del cierre del día.',
      },
    ],
  });

  await prisma.domainEvent.createMany({
    data: [
      {
        id: 'event-lead-maria-created',
        workspaceId: workspace.id,
        eventId: 'event-lead-maria-created',
        aggregateType: 'lead',
        aggregateId: 'lead-maria-santos',
        eventName: 'lead_created',
        actorType: 'visitor',
        payload: { source: 'seed' },
        occurredAt: new Date('2026-03-24T11:55:00.000Z'),
        funnelInstanceId: funnelInstance.id,
        funnelPublicationId: rootPublication.id,
        funnelStepId: null,
        visitorId: 'visitor-maria-santos',
        leadId: 'lead-maria-santos',
        assignmentId: null,
      },
      {
        id: 'event-assignment-carlos-created',
        workspaceId: workspace.id,
        eventId: 'event-assignment-carlos-created',
        aggregateType: 'assignment',
        aggregateId: 'assignment-carlos-bruno',
        eventName: 'assignment_created',
        actorType: 'system',
        payload: { source: 'seed' },
        occurredAt: new Date('2026-03-25T09:02:00.000Z'),
        funnelInstanceId: funnelInstance.id,
        funnelPublicationId: opportunityPublication.id,
        funnelStepId: null,
        visitorId: null,
        leadId: 'lead-carlos-rivera',
        assignmentId: 'assignment-carlos-bruno',
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
