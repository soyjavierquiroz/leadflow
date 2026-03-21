export const configPackageName = '@leadflow/config';

export const splitCsv = (value: string | undefined) => {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const normalizeUrl = (value: string) => value.replace(/\/+$/, '');

export const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};
