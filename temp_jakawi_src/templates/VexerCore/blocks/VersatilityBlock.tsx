import type { LayoutTheme, VersatilityBlockData } from './types'
import { renderHighlightedText } from './highlightHeadline'

type VersatilityBlockProps = {
  data: VersatilityBlockData
  theme?: LayoutTheme
}

function normalizeUseCases(useCases?: string[]): string[] {
  return (useCases ?? []).map((item) => item?.trim()).filter((item): item is string => Boolean(item))
}

function VersatilityBlock({ data, theme: _theme = 'light' }: VersatilityBlockProps) {
  const useCases = normalizeUseCases(data.use_cases)
  const supportingText = data.subheadline?.trim() || data.subtitle?.trim() || ''

  if (!data.headline?.trim() && !supportingText && useCases.length === 0) {
    return null
  }

  return (
    <section className="w-full py-1 text-[var(--brand-text-main)]">
      <div className="space-y-6">
        {data.headline ? <h3 className="max-w-4xl text-3xl font-black leading-tight tracking-tight md:text-4xl">{renderHighlightedText(data.headline)}</h3> : null}
        {supportingText ? <p className="max-w-3xl text-[15px] leading-relaxed text-[#111827]/80">{supportingText}</p> : null}

        {useCases.length > 0 ? (
          <ul className="space-y-3">
            {(useCases || []).map((useCase, index) => (
              <li
                key={`${useCase}-${index}`}
                className="flex items-start gap-3 rounded-2xl border border-[color:color-mix(in_srgb,var(--brand-borderColor)_60%,transparent)] bg-[color:color-mix(in_srgb,#f9fafb_72%,transparent)] px-4 py-3"
              >
                <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-base font-black" style={{ backgroundColor: 'color-mix(in srgb, var(--brand-primary) 16%, white)', color: 'var(--brand-primary)' }}>
                  ✓
                </span>
                <span className="pt-0.5 text-base font-semibold leading-snug text-[#111827]">{useCase}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}

export { VersatilityBlock }
export default VersatilityBlock
