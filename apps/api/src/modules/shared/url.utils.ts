export const sanitizeNullableText = (
  value: string | null | undefined,
): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizeUrl = (value: string | null | undefined) => {
  const sanitized = sanitizeNullableText(value);

  if (!sanitized) {
    return null;
  }

  try {
    return new URL(sanitized).toString();
  } catch {
    return null;
  }
};

export const normalizeBaseUrl = (value: string | null | undefined) => {
  const normalized = normalizeUrl(value);

  if (!normalized) {
    return null;
  }

  const url = new URL(normalized);
  const normalizedPath = url.pathname.replace(/\/+$/, '');
  url.pathname = normalizedPath.length > 0 ? normalizedPath : '/';
  url.search = '';
  url.hash = '';

  return url.toString();
};

export const normalizeUrlPath = (value: string | null | undefined) => {
  const sanitized = sanitizeNullableText(value);

  if (!sanitized) {
    return null;
  }

  const segments = sanitized
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  return segments.length > 0 ? segments.join('/') : null;
};

export const joinUrlPath = (baseUrl: string, pathname: string) => {
  const clean = (value: string) => value.replace(/\/+$/, '').replace(/^\/+/, '');
  const normalizedPath = normalizeUrlPath(pathname) ?? '';

  return `${clean(baseUrl)}/${clean(normalizedPath)}`;
};
