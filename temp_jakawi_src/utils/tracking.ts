export function resolveTrackingContentId(rawSku: unknown, fallbackId: number | string): string {
  const fallback = String(fallbackId ?? '').trim()

  if (typeof rawSku !== 'string') {
    return fallback
  }

  const normalizedSku = rawSku.replace(/^\s*sku\s*:\s*/i, '').trim().replace(/\s+/g, ' ')
  return normalizedSku !== '' ? normalizedSku : fallback
}
