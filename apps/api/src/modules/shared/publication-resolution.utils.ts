const trimOuterSlashes = (value: string) => value.replace(/^\/+|\/+$/g, '');

export const normalizeDomainHost = (value: string) => {
  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    return '';
  }

  const withoutProtocol = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  const withoutPath = withoutProtocol.split('/')[0] ?? '';
  const withoutQuery = withoutPath.split('?')[0] ?? '';
  const withoutHash = withoutQuery.split('#')[0] ?? '';
  const withoutPort = withoutHash.replace(/:\d+$/, '');

  return withoutPort.replace(/\.+$/, '');
};

export const hasNormalizedDomainHost = (value: string) =>
  normalizeDomainHost(value).length > 0;

export const normalizePath = (value?: string | null) => {
  if (!value) {
    return '/';
  }

  const trimmed = value.trim();
  const withoutQuery = trimmed.split('?')[0] ?? '/';
  const withoutHash = withoutQuery.split('#')[0] ?? '/';
  const normalized = withoutHash.replace(/\/+/g, '/').replace(/\/$/, '');

  if (!normalized || normalized === '.') {
    return '/';
  }

  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};

export const normalizePublicationPathPrefix = (value: string) =>
  normalizePath(value);

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

export const comparePublicationPathPrefix = (
  leftPathPrefix: string,
  rightPathPrefix: string,
) => rightPathPrefix.length - leftPathPrefix.length;

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

  const normalizedSlug = trimOuterSlashes(stepSlug);
  if (!normalizedSlug) {
    return publicationPath;
  }

  return publicationPath === '/'
    ? `/${normalizedSlug}`
    : `${publicationPath}/${normalizedSlug}`;
};
