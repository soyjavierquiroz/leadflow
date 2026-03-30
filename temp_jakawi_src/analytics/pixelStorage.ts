export type StoredPixelIds = {
  meta: string | null
  tiktok: string | null
  gtm: string | null
  ga: string | null
}

const PIXEL_STORAGE_KEY = 'jakawi_pixels'

const EMPTY_PIXEL_IDS: StoredPixelIds = {
  meta: null,
  tiktok: null,
  gtm: null,
  ga: null,
}

function normalizePixelValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const clean = value.trim()
  return clean ? clean : null
}

export function persistStoredPixelIds(payload: Partial<StoredPixelIds>): void {
  if (typeof window === 'undefined') {
    return
  }

  const normalized: StoredPixelIds = {
    meta: normalizePixelValue(payload.meta),
    tiktok: normalizePixelValue(payload.tiktok),
    gtm: normalizePixelValue(payload.gtm),
    ga: normalizePixelValue(payload.ga),
  }

  const hasAnyPixel = Object.values(normalized).some((value) => value !== null)

  try {
    if (!hasAnyPixel) {
      window.localStorage.removeItem(PIXEL_STORAGE_KEY)
      return
    }

    window.localStorage.setItem(PIXEL_STORAGE_KEY, JSON.stringify(normalized))
  } catch (error) {
    console.warn('No se pudo persistir jakawi_pixels en localStorage:', error)
  }
}

export function readStoredPixelIds(): StoredPixelIds {
  if (typeof window === 'undefined') {
    return EMPTY_PIXEL_IDS
  }

  try {
    const raw = window.localStorage.getItem(PIXEL_STORAGE_KEY)
    if (!raw) {
      return EMPTY_PIXEL_IDS
    }

    const parsed = JSON.parse(raw) as Partial<StoredPixelIds>
    return {
      meta: normalizePixelValue(parsed.meta),
      tiktok: normalizePixelValue(parsed.tiktok),
      gtm: normalizePixelValue(parsed.gtm),
      ga: normalizePixelValue(parsed.ga),
    }
  } catch (error) {
    console.warn('No se pudo leer jakawi_pixels desde localStorage:', error)
    return EMPTY_PIXEL_IDS
  }
}
