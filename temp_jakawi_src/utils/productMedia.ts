import type { ProductLike } from '../api/types'
import { resolveMedia } from './mediaResolver'

const ORDERED_PRODUCT_MEDIA_KEYS = ['hero', 'gallery_1', 'gallery_2', 'gallery_3', 'gallery_4', 'gallery_5', 'gallery_6', 'product_box'] as const
const PLACEHOLDER_IMAGE = '/images/placeholder-product.svg'

function isUsableImage(value: string): boolean {
  const normalized = value.trim()
  return normalized !== '' && normalized !== PLACEHOLDER_IMAGE
}

function isLiteralMediaPath(value: string): boolean {
  return /^(https?:)?\/\//i.test(value) || value.startsWith('/') || value.startsWith('./') || value.startsWith('../')
}

function extractGalleryImages(images: unknown[]): string[] {
  const urls: string[] = []

  images.forEach((item) => {
    if (typeof item === 'string' && isUsableImage(item)) {
      urls.push(item.trim())
      return
    }

    if (!item || typeof item !== 'object') {
      return
    }

    const maybeSrc = (item as { src?: unknown }).src
    const maybeUrl = (item as { url?: unknown }).url

    if (typeof maybeSrc === 'string' && isUsableImage(maybeSrc)) {
      urls.push(maybeSrc.trim())
      return
    }

    if (typeof maybeUrl === 'string' && isUsableImage(maybeUrl)) {
      urls.push(maybeUrl.trim())
    }
  })

  return Array.from(new Set(urls))
}

function resolveDictionaryCandidate(candidate: string | undefined, dictionary?: Record<string, string>): string {
  const resolved = resolveMedia(candidate, dictionary, false)
  return isUsableImage(resolved) ? resolved.trim() : ''
}

function resolvePreferredImageCandidate(candidate: string | undefined, dictionary?: Record<string, string>): string {
  const normalized = candidate?.trim() ?? ''
  if (!normalized) {
    return ''
  }

  if (isLiteralMediaPath(normalized)) {
    return isUsableImage(normalized) ? normalized : ''
  }

  return resolveDictionaryCandidate(normalized, dictionary)
}

export function resolveProductHeroImage(product?: ProductLike, preferredHeroImage?: string): string {
  const mediaDictionary = product?.media_dictionary ?? {}
  const explicitImage = resolvePreferredImageCandidate(preferredHeroImage, mediaDictionary)

  if (explicitImage) {
    return explicitImage
  }

  const primaryHero = resolveDictionaryCandidate('hero', mediaDictionary)
  if (primaryHero) {
    return primaryHero
  }

  for (const key of ORDERED_PRODUCT_MEDIA_KEYS) {
    const resolved = resolveDictionaryCandidate(key, mediaDictionary)
    if (resolved) {
      return resolved
    }
  }

  const wcImages = extractGalleryImages(product?.wc?.images ?? [])
  return wcImages[0] ?? ''
}
