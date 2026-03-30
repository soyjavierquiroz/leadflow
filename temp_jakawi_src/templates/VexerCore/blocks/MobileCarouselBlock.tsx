import { SmartGallery } from '../../../components/ecommerce/SmartGallery'
import { resolveMedia } from '../../../utils/mediaResolver'
import type { MobileCarouselBlockData } from './types'

const PLACEHOLDER_IMAGE = '/images/placeholder-product.svg'

type ProductLike = {
  media_dictionary?: Record<string, string>
  wc?: {
    images?: unknown[]
  }
}

type MobileCarouselBlockProps = {
  data: MobileCarouselBlockData
  product?: ProductLike
}

function extractGalleryImages(images: unknown[]): string[] {
  const urls: string[] = []

  images.forEach((item) => {
    if (typeof item === 'string' && item.trim() !== '') {
      urls.push(item.trim())
      return
    }

    if (item && typeof item === 'object') {
      const maybeSrc = (item as { src?: unknown }).src
      const maybeUrl = (item as { url?: unknown }).url

      if (typeof maybeSrc === 'string' && maybeSrc.trim() !== '') {
        urls.push(maybeSrc.trim())
        return
      }

      if (typeof maybeUrl === 'string' && maybeUrl.trim() !== '') {
        urls.push(maybeUrl.trim())
      }
    }
  })

  return Array.from(new Set(urls))
}

function resolveGalleryImages(product?: ProductLike): string[] {
  const mediaDictionary = product?.media_dictionary ?? {}
  const dictionaryImages = ['hero', 'gallery_1', 'gallery_2', 'gallery_3', 'gallery_4', 'gallery_5', 'gallery_6', 'product_box']
    .map((key) => resolveMedia(key, mediaDictionary, false))
    .filter((item): item is string => Boolean(item?.trim()))

  if (dictionaryImages.length > 0) {
    return dictionaryImages
  }

  const wcImages = extractGalleryImages(product?.wc?.images ?? [])
  if (wcImages.length > 0) {
    return wcImages
  }

  return [PLACEHOLDER_IMAGE]
}

function MobileCarouselBlock({ product }: MobileCarouselBlockProps) {
  const images = resolveGalleryImages(product)

  return (
    <div className="mb-8 block lg:hidden">
      <div className="overflow-hidden rounded-[2rem] border border-[var(--brand-borderColor)] bg-[var(--brand-cardBg)] p-3 shadow-xl">
        <SmartGallery images={images} thumbnailPosition="bottom" />
      </div>
    </div>
  )
}

export { MobileCarouselBlock }
export default MobileCarouselBlock
