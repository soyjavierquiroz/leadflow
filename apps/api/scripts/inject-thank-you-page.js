const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DEFAULTS = {
  funnelCode: 'immunotec-recuperacion',
  domainHost: 'retodetransformacion.com',
  successPath: '/immuno/confirmado',
  stepType: 'thank_you',
  deactivateShadowBinding: true,
};

const parseArgs = (argv) => {
  return argv.reduce(
    (accumulator, argument) => {
      if (argument === '--keep-shadow-binding') {
        accumulator.deactivateShadowBinding = false;
        return accumulator;
      }

      if (!argument.startsWith('--')) {
        return accumulator;
      }

      const [rawKey, ...rest] = argument.slice(2).split('=');
      const value = rest.join('=').trim();

      if (!rawKey || !value) {
        return accumulator;
      }

      if (rawKey === 'funnel') {
        accumulator.funnelCode = value;
      }

      if (rawKey === 'domain') {
        accumulator.domainHost = value;
      }

      if (rawKey === 'path') {
        accumulator.successPath = value;
      }

      if (rawKey === 'step-type') {
        accumulator.stepType = value;
      }

      return accumulator;
    },
    { ...DEFAULTS },
  );
};

const normalizeHost = (value) => {
  const trimmed = String(value || '')
    .trim()
    .toLowerCase();

  if (!trimmed) {
    return '';
  }

  return trimmed
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
    .replace(/:\d+$/, '')
    .replace(/\.+$/, '');
};

const normalizePath = (value) => {
  const trimmed = String(value || '/').trim();
  const withoutQuery = trimmed.split('?')[0] || '/';
  const withoutHash = withoutQuery.split('#')[0] || '/';
  const normalized = withoutHash.replace(/\/+/g, '/').replace(/\/$/, '');

  if (!normalized || normalized === '.') {
    return '/';
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

const trimOuterSlashes = (value) => String(value || '').replace(/^\/+|\/+$/g, '');

const asObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value;
};

const canStepHangFromPublication = (fullPath, publicationPath) => {
  if (publicationPath === '/') {
    return fullPath !== '/';
  }

  return fullPath.startsWith(`${publicationPath}/`);
};

const buildRelativeSlug = (fullPath, publicationPath) => {
  if (publicationPath === '/') {
    return trimOuterSlashes(fullPath);
  }

  return trimOuterSlashes(fullPath.slice(publicationPath.length));
};

const resolveStructureId = (...sources) => {
  for (const sourceValue of sources) {
    const source = asObject(sourceValue);

    if (
      typeof source.structureId === 'string' &&
      source.structureId.trim().length > 0
    ) {
      return source.structureId.trim();
    }

    const hybridEditor = asObject(source.hybridEditor);
    if (
      typeof hybridEditor.structureId === 'string' &&
      hybridEditor.structureId.trim().length > 0
    ) {
      return hybridEditor.structureId.trim();
    }
  }

  return 'split-media-focus';
};

const buildThankYouBlocks = (funnelName) => [
  {
    type: 'conversion_page_config',
    key: 'thank-you-conversion-page',
    content: {
      headline: 'Gracias. Ya recibimos tu solicitud.',
      subheadline:
        'Tu registro quedo confirmado y ahora te vamos a conectar con el asesor indicado para continuar por WhatsApp.',
      cta_text: 'Hablar con mi asesor ahora',
      redirect_delay: 4000,
      fallback_advisor: {
        name: funnelName || 'Equipo Leadflow',
        bio: 'Especialista en protocolos de recuperacion',
      },
    },
  },
];

const buildStepSettings = ({
  existingSettings,
  instanceSettings,
  template,
  funnelName,
  successPath,
  blocksJson,
}) => {
  const current = asObject(existingSettings);
  const currentSeo = asObject(current.seo);
  const structureId = resolveStructureId(
    current,
    instanceSettings,
    template.settingsJson,
  );

  return {
    ...current,
    editorSource: 'inject-thank-you-page-script',
    templateId: template.id,
    templateCode: template.code,
    structureId,
    hybridRenderer: 'jakawi-bridge',
    blocksJson,
    seo: {
      title: currentSeo.title || `${funnelName} | Confirmado`,
      metaDescription:
        currentSeo.metaDescription ||
        `Pagina de confirmacion publicada en ${successPath}.`,
    },
  };
};

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const normalizedDomainHost = normalizeHost(options.domainHost);
  const normalizedSuccessPath = normalizePath(options.successPath);

  if (normalizedSuccessPath === '/') {
    throw new Error('La ruta de confirmacion no puede ser /.');
  }

  const domain = await prisma.domain.findFirst({
    where: {
      normalizedHost: normalizedDomainHost,
    },
    select: {
      id: true,
      host: true,
      normalizedHost: true,
      status: true,
    },
  });

  if (!domain) {
    throw new Error(
      `No se encontro el dominio ${normalizedDomainHost} en la base de datos.`,
    );
  }

  const funnelInstance = await prisma.funnelInstance.findFirst({
    where: {
      code: options.funnelCode,
    },
    include: {
      template: {
        select: {
          id: true,
          code: true,
          settingsJson: true,
        },
      },
      steps: {
        orderBy: {
          position: 'asc',
        },
      },
      publications: {
        where: {
          domainId: domain.id,
        },
        orderBy: {
          pathPrefix: 'asc',
        },
      },
    },
  });

  if (!funnelInstance) {
    throw new Error(
      `No se encontro el funnelInstance con code=${options.funnelCode}.`,
    );
  }

  const basePublication = [...funnelInstance.publications]
    .filter(
      (publication) =>
        publication.status === 'active' &&
        publication.isActive &&
        canStepHangFromPublication(normalizedSuccessPath, publication.pathPrefix),
    )
    .sort((left, right) => right.pathPrefix.length - left.pathPrefix.length)[0];

  if (!basePublication) {
    const publicationList =
      funnelInstance.publications.length > 0
        ? funnelInstance.publications
            .map(
              (publication) =>
                `${publication.pathPrefix} [${publication.status}/${publication.isActive ? 'active' : 'inactive'}]`,
            )
            .join(', ')
        : 'sin publicaciones en este dominio';

    throw new Error(
      `No existe una publicacion base activa del funnel ${options.funnelCode} en ${domain.host} desde la cual colgar ${normalizedSuccessPath}. Publicaciones detectadas: ${publicationList}.`,
    );
  }

  const stepSlug = buildRelativeSlug(
    normalizedSuccessPath,
    basePublication.pathPrefix,
  );

  if (!stepSlug) {
    throw new Error(
      `No se pudo derivar un slug de step valido desde ${normalizedSuccessPath} y la publicacion base ${basePublication.pathPrefix}.`,
    );
  }

  const exactPublication = await prisma.funnelPublication.findUnique({
    where: {
      domainId_pathPrefix: {
        domainId: domain.id,
        pathPrefix: normalizedSuccessPath,
      },
    },
    select: {
      id: true,
      funnelInstanceId: true,
      status: true,
      isActive: true,
      isPrimary: true,
    },
  });

  if (
    exactPublication &&
    exactPublication.funnelInstanceId !== funnelInstance.id &&
    exactPublication.status === 'active' &&
    exactPublication.isActive
  ) {
    throw new Error(
      `La ruta ${normalizedSuccessPath} ya esta ocupada por otra publicacion activa (${exactPublication.id}).`,
    );
  }

  const existingStep =
    funnelInstance.steps.find((step) => step.slug === stepSlug) ?? null;
  const entryStep =
    funnelInstance.steps.find((step) => step.isEntryStep) ?? funnelInstance.steps[0] ?? null;
  const maxPosition = funnelInstance.steps.reduce(
    (currentMax, step) => Math.max(currentMax, step.position),
    0,
  );
  const thankYouBlocks = buildThankYouBlocks(funnelInstance.name);
  const stepSettings = buildStepSettings({
    existingSettings: existingStep?.settingsJson ?? null,
    instanceSettings: funnelInstance.settingsJson,
    template: funnelInstance.template,
    funnelName: funnelInstance.name,
    successPath: normalizedSuccessPath,
    blocksJson: thankYouBlocks,
  });
  const nextPosition = existingStep?.position ?? maxPosition + 1;
  const mediaMap =
    existingStep?.mediaMap ??
    entryStep?.mediaMap ??
    funnelInstance.mediaMap ??
    {};

  const summary = await prisma.$transaction(async (tx) => {
    let shadowBindingAction = 'none';

    if (
      options.deactivateShadowBinding &&
      exactPublication &&
      exactPublication.funnelInstanceId === funnelInstance.id &&
      exactPublication.status === 'active' &&
      exactPublication.isActive
    ) {
      await tx.funnelPublication.update({
        where: {
          id: exactPublication.id,
        },
        data: {
          status: 'draft',
          isActive: false,
          isPrimary: false,
        },
      });

      shadowBindingAction = `deactivated:${exactPublication.id}`;
    }

    const savedStep = existingStep
      ? await tx.funnelStep.update({
          where: {
            id: existingStep.id,
          },
          data: {
            stepType: options.stepType,
            position: nextPosition,
            isEntryStep: false,
            isConversionStep: false,
            blocksJson: thankYouBlocks,
            mediaMap,
            settingsJson: stepSettings,
          },
        })
      : await tx.funnelStep.create({
          data: {
            workspaceId: funnelInstance.workspaceId,
            teamId: funnelInstance.teamId,
            funnelInstanceId: funnelInstance.id,
            stepType: options.stepType,
            slug: stepSlug,
            position: nextPosition,
            isEntryStep: false,
            isConversionStep: false,
            blocksJson: thankYouBlocks,
            mediaMap,
            settingsJson: stepSettings,
          },
        });

    return {
      shadowBindingAction,
      savedStep,
    };
  });

  console.log('');
  console.log('Leadflow thank-you injection completada');
  console.log('--------------------------------------');
  console.log(`Funnel instance: ${funnelInstance.name} (${funnelInstance.code})`);
  console.log(`Dominio: ${domain.host}`);
  console.log(`Publicacion base: ${basePublication.pathPrefix}`);
  console.log(`Ruta final: ${normalizedSuccessPath}`);
  console.log(`Step slug: ${stepSlug}`);
  console.log(`Step id: ${summary.savedStep.id}`);
  console.log(`Step position: ${summary.savedStep.position}`);
  console.log(`Shadow binding: ${summary.shadowBindingAction}`);
  console.log('');
  console.log('Configura esto en el JSON de la landing principal:');
  console.log(`"success_redirect": "${normalizedSuccessPath}"`);
  console.log('');
  console.log('Importante: la pagina de gracias vive en FunnelStep.blocksJson, no en FunnelPublication.');
}

main()
  .catch((error) => {
    console.error('');
    console.error('Leadflow thank-you injection fallo');
    console.error('--------------------------------');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
