import type { LayoutTheme, SocialProofBlockData, SocialProofReview } from './types'
import { renderHighlightedText } from './highlightHeadline'

type SocialProofBlockProps = {
  data: SocialProofBlockData
  theme?: LayoutTheme
}

type NormalizedReview = {
  name: string
  location: string | undefined
  stars: number
  text: string
  imageUrl: string | undefined
  imageAlt: string
}

function normalizeReviews(reviews?: SocialProofReview[]): NormalizedReview[] {
  return (reviews ?? [])
    .map<NormalizedReview | null>((review) => {
      const name = review?.name?.trim() || ''
      const text = review?.text?.trim() || ''

      if (!name && !text) {
        return null
      }

      const rawStars = typeof review?.stars === 'number' ? review.stars : Number(review?.stars ?? 5)
      const stars = Number.isFinite(rawStars) ? Math.min(5, Math.max(1, Math.round(rawStars))) : 5
      const location = review?.location?.trim()
      const imageUrl = review?.image_url?.trim()

      const normalized: NormalizedReview = {
        name: name || 'Cliente verificado',
        location: location || undefined,
        stars,
        text: text || 'La experiencia supero nuestras expectativas.',
        imageUrl: imageUrl || undefined,
        imageAlt: review?.image_alt?.trim() || name || 'Foto del cliente',
      }

      return normalized
    })
    .filter((review): review is NormalizedReview => review !== null)
}

function SocialProofBlock({ data, theme: _theme = 'light' }: SocialProofBlockProps) {
  const reviews = normalizeReviews(data.reviews)
  const supportingText = data.subheadline?.trim() || data.subtitle?.trim() || ''

  if (!data.headline?.trim() && !supportingText && reviews.length === 0) {
    return null
  }

  return (
    <section className="w-full py-1 text-[var(--brand-text-main)]">
      <div className="space-y-6">
        {data.headline ? <h3 className="max-w-4xl text-3xl font-black leading-tight tracking-tight md:text-4xl">{renderHighlightedText(data.headline)}</h3> : null}
        {supportingText ? <p className="max-w-3xl text-[15px] leading-relaxed text-[#111827]/80">{supportingText}</p> : null}

        {reviews.length > 0 ? (
          <div className="space-y-4">
            {(reviews || []).map((review, index) => (
              <article
                key={`${review.name}-${index}`}
                className="flex flex-col gap-4 rounded-2xl border border-[color:color-mix(in_srgb,var(--brand-borderColor)_70%,transparent)] bg-[color:color-mix(in_srgb,#f3f4f6_60%,transparent)] p-4"
              >
                <div className="flex items-start gap-3">
                  {review.imageUrl ? (
                    <img
                      src={review.imageUrl}
                      alt={review.imageAlt}
                      loading="lazy"
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : null}

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="text-sm font-black text-[#111827]">{review.name}</p>
                      {review.location ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#111827]/55">{review.location}</p> : null}
                    </div>

                    <div className="flex items-center gap-1 text-yellow-400" aria-label={`${review.stars} de 5 estrellas`}>
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <span key={`${review.name}-star-${starIndex}`} className={starIndex < (review.stars ?? 5) ? 'opacity-100' : 'opacity-30'}>
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <p className="text-[15px] leading-relaxed text-[#111827]/80">{review.text}</p>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export { SocialProofBlock }
export default SocialProofBlock
