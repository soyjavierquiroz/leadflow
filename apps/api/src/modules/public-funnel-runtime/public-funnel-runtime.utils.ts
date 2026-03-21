export const normalizeHost = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  return trimmed.replace(/:\d+$/, '');
};

export const normalizePath = (value?: string | null) => {
  if (!value) {
    return '/';
  }

  const withoutQuery = value.split('?')[0] ?? '/';
  const withoutHash = withoutQuery.split('#')[0] ?? '/';
  const normalized = withoutHash.replace(/\/+/g, '/').replace(/\/$/, '').trim();

  if (!normalized || normalized === '.') {
    return '/';
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

export const matchesPublicationPath = (
  requestPath: string,
  publicationPathPrefix: string,
) => {
  if (publicationPathPrefix === '/') {
    return true;
  }

  return (
    requestPath === publicationPathPrefix ||
    requestPath.startsWith(`${publicationPathPrefix}/`)
  );
};

export const resolveRelativeStepPath = (
  requestPath: string,
  publicationPathPrefix: string,
) => {
  if (publicationPathPrefix === '/') {
    return requestPath;
  }

  if (requestPath === publicationPathPrefix) {
    return '/';
  }

  const relative = requestPath.slice(publicationPathPrefix.length);
  return normalizePath(relative);
};

export const buildPublicationStepPath = (
  publicationPathPrefix: string,
  stepSlug: string,
  isEntryStep: boolean,
) => {
  const publicationPath = normalizePath(publicationPathPrefix);

  if (isEntryStep) {
    return publicationPath;
  }

  const normalizedSlug = stepSlug.replace(/^\/+|\/+$/g, '');
  if (!normalizedSlug) {
    return publicationPath;
  }

  return publicationPath === '/'
    ? `/${normalizedSlug}`
    : `${publicationPath}/${normalizedSlug}`;
};
