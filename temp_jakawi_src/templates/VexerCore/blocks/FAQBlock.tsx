import { renderHighlightedText } from './highlightHeadline'
import type { FAQBlockData, FAQItem, LayoutTheme } from './types'

type FAQBlockProps = {
  data: FAQBlockData
  theme?: LayoutTheme
}

type NormalizedFaqItem = {
  question: string
  answer: string
}

function normalizeFaqs(faqs?: FAQItem[]): NormalizedFaqItem[] {
  return (faqs ?? [])
    .map<NormalizedFaqItem | null>((item) => {
      const question = item.question?.trim() || item.q?.trim() || ''
      const answer = item.answer?.trim() || item.a?.trim() || ''

      if (!question || !answer) {
        return null
      }

      return { question, answer }
    })
    .filter((item): item is NormalizedFaqItem => item !== null)
}

function FAQBlock({ data, theme: _theme = 'light' }: FAQBlockProps) {
  const faqs = normalizeFaqs(data.faqs)
  const supportingText = data.subheadline?.trim() || data.subtitle?.trim() || ''

  if (!data.headline?.trim() && !supportingText && faqs.length === 0) {
    return null
  }

  return (
    <section className="w-full py-1 text-[var(--brand-text-main)]">
      <div className="space-y-6">
        {data.headline ? <h3 className="max-w-4xl text-3xl font-black leading-tight tracking-tight md:text-4xl">{renderHighlightedText(data.headline)}</h3> : null}
        {supportingText ? <p className="max-w-3xl text-[15px] leading-relaxed text-[#111827]/80">{supportingText}</p> : null}

        {faqs.length > 0 ? (
          <div className="space-y-3">
            {(faqs || []).map((faq, index) => (
              <details
                key={`${faq.question}-${index}`}
                className="group overflow-hidden rounded-2xl border border-[color:color-mix(in_srgb,var(--brand-borderColor)_70%,transparent)] bg-[color:color-mix(in_srgb,#f9fafb_70%,transparent)] transition-colors open:bg-white"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 text-left text-base font-bold leading-snug text-[#111827] transition-colors hover:bg-[color:color-mix(in_srgb,#f3f4f6_85%,transparent)] [&::-webkit-details-marker]:hidden">
                  <span>{faq.question}</span>
                  <span
                    aria-hidden="true"
                    className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[color:color-mix(in_srgb,var(--brand-borderColor)_75%,transparent)] bg-white text-lg font-black text-[var(--brand-primary)] transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>

                <div className="border-t border-[color:color-mix(in_srgb,var(--brand-borderColor)_55%,transparent)] px-4 py-4">
                  <p className="text-[15px] leading-relaxed text-[#111827]/80">{faq.answer}</p>
                </div>
              </details>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export { FAQBlock }
export default FAQBlock
