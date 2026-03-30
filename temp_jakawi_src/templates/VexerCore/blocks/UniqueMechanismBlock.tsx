import type { CtaClickHandler } from '../../types'
import type {
  LayoutTheme,
  UniqueMechanismBlockData,
  UniqueMechanismFeatureBenefitPair,
  UniqueMechanismStep,
} from './types'
import { renderHighlightedText } from './highlightHeadline'

const PLACEHOLDER_IMAGE = '/images/placeholder-product.svg'

type ProductImageLike = string | { src?: string; url?: string; id?: number | string; name?: string; key?: string }

type ProductLike = {
  images?: ProductImageLike[]
  wc?: {
    images?: ProductImageLike[]
  }
}

type UniqueMechanismBlockProps = {
  data: UniqueMechanismBlockData
  theme?: LayoutTheme
  onCtaClick?: CtaClickHandler
  product?: ProductLike
}

function normalizeSteps(steps?: UniqueMechanismStep[]): UniqueMechanismStep[] {
  return (steps ?? []).filter((step) => Boolean(step?.step_title?.trim() || step?.step_text?.trim()))
}

function normalizePairs(pairs?: UniqueMechanismFeatureBenefitPair[]): UniqueMechanismFeatureBenefitPair[] {
  return (pairs ?? []).filter((pair) => Boolean(pair?.feature?.trim() || pair?.benefit?.trim()))
}

function toEmbedUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed || trimmed === PLACEHOLDER_IMAGE) {
    return ''
  }

  if (trimmed.includes('youtube.com/embed/')) {
    return trimmed
  }

  const youtubeMatch = trimmed.match(/[?&]v=([^&]+)/)
  if (youtubeMatch?.[1]) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`
  }

  const shortYoutubeMatch = trimmed.match(/youtu\.be\/([^?&/]+)/)
  if (shortYoutubeMatch?.[1]) {
    return `https://www.youtube.com/embed/${shortYoutubeMatch[1]}`
  }

  const vimeoMatch = trimmed.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch?.[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`
  }

  return trimmed
}

function isDirectVideoUrl(rawUrl: string): boolean {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(rawUrl)
}

function resolveImageUrl(image: ProductImageLike | undefined): string {
  if (!image) {
    return ''
  }

  if (typeof image === 'string') {
    return image.trim()
  }

  if (typeof image.src === 'string' && image.src.trim() !== '') {
    return image.src.trim()
  }

  if (typeof image.url === 'string' && image.url.trim() !== '') {
    return image.url.trim()
  }

  return ''
}

function resolveMediaFromProduct(mediaKey: string, product?: ProductLike): string {
  const trimmedKey = mediaKey.trim()
  if (!trimmedKey) {
    return ''
  }

  if (/^(https?:)?\/\//i.test(trimmedKey) || trimmedKey.startsWith('/')) {
    return trimmedKey
  }

  const productImages = Array.isArray(product?.images)
    ? product.images
    : Array.isArray(product?.wc?.images)
    ? product.wc.images
    : []

  if (productImages.length === 0) {
    return ''
  }

  if (/^\d+$/.test(trimmedKey)) {
    const numericIndex = Number.parseInt(trimmedKey, 10)
    const byIndex = productImages[numericIndex]
    const resolvedByIndex = resolveImageUrl(byIndex)
    if (resolvedByIndex) {
      return resolvedByIndex
    }
  }

  const matchedImage = productImages.find((image) => {
    if (typeof image === 'string') {
      return image.includes(trimmedKey)
    }

    return [image.src, image.url, image.name, image.key, image.id != null ? String(image.id) : '']
      .filter((value): value is string => typeof value === 'string' && value.trim() !== '')
      .some((value) => value.includes(trimmedKey))
  })

  return resolveImageUrl(matchedImage)
}

function UniqueMechanismBlock({ data, theme: _theme = 'light', product }: UniqueMechanismBlockProps) {
  const steps = normalizeSteps(data.how_it_works_steps)
  const pairs = normalizePairs(data.feature_benefit_pairs)
  const mediaUrl = typeof data.media_url === 'string' ? data.media_url.trim() : ''
  const resolvedMediaUrl = resolveMediaFromProduct(mediaUrl, product)
  const rawVideoUrl = data.demo_video_url?.trim() || ''
  const embedUrl = toEmbedUrl(rawVideoUrl)
  const hasVideo = embedUrl !== '' && embedUrl !== PLACEHOLDER_IMAGE
  const hasDirectVideo = hasVideo && isDirectVideoUrl(embedUrl)
  const hasResolvedMedia = resolvedMediaUrl !== '' && resolvedMediaUrl !== PLACEHOLDER_IMAGE
  const hasResolvedMediaVideo = hasResolvedMedia && isDirectVideoUrl(resolvedMediaUrl)

  if (!data.headline?.trim() && !data.mechanism_name?.trim() && steps.length === 0 && pairs.length === 0) {
    return null
  }

  return (
    <section className="w-full py-1 text-[var(--brand-text-main)]">
      <div className="space-y-7">
        {data.headline ? <h3 className="max-w-4xl text-3xl font-black leading-tight tracking-tight md:text-4xl">{renderHighlightedText(data.headline)}</h3> : null}
        {data.mechanism_name ? (
          <div className="space-y-3">
            <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: 'var(--brand-primary)' }}>
              Mecanismo único
            </p>
            <p className="mt-3 text-lg font-bold leading-snug md:text-xl">{data.mechanism_name}</p>
          </div>
        ) : null}

        {steps.length > 0 ? (
          <div className="space-y-4">
            {steps.map((step, index) => (
              <article key={`${step.step_title || step.step_text}-${index}`} className="flex items-start gap-4">
                <span
                  className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-black"
                  style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-cardBg)' }}
                >
                  {index + 1}
                </span>
                <div>
                  {step.step_title ? <h4 className="text-base font-bold leading-snug">{step.step_title}</h4> : null}
                  {step.step_text ? <p className="mt-2 text-[15px] leading-relaxed text-[var(--brand-text-main)]/80">{step.step_text}</p> : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-2xl shadow-lg">
          {hasResolvedMediaVideo ? (
            <video src={resolvedMediaUrl} controls playsInline className="h-full min-h-[280px] w-full object-cover" />
          ) : hasResolvedMedia ? (
            <img src={resolvedMediaUrl} alt={data.headline?.trim() || 'Imagen del mecanismo'} loading="lazy" className="h-full min-h-[280px] w-full object-cover" />
          ) : hasDirectVideo ? (
            <video src={embedUrl} controls playsInline className="h-full min-h-[280px] w-full object-cover" />
          ) : hasVideo ? (
            <iframe
              src={embedUrl}
              title={data.headline?.trim() || 'Demo del producto'}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="min-h-[280px] w-full"
            />
          ) : (
            <img src={PLACEHOLDER_IMAGE} alt="Placeholder de demo" loading="lazy" className="h-full min-h-[280px] w-full object-cover" />
          )}
        </div>

        {pairs.length > 0 ? (
          <div className="space-y-4">
            {pairs.map((pair, index) => (
              <article key={`${pair.feature || pair.benefit}-${index}`} className="space-y-3">
                {pair.feature ? (
                  <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--brand-primary)' }}>
                    {pair.feature}
                  </p>
                ) : null}
                {pair.benefit ? <p className="mt-3 text-[15px] leading-relaxed text-[var(--brand-text-main)]/80">{pair.benefit}</p> : null}
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export { UniqueMechanismBlock }
export default UniqueMechanismBlock
