import type { CtaClickHandler } from '../../types'
import type { LayoutTheme, RiskReversalBlockData } from './types'
import { renderHighlightedText } from './highlightHeadline'

type RiskReversalBlockProps = {
  data: RiskReversalBlockData
  theme?: LayoutTheme
  onCtaClick?: CtaClickHandler
}

function RiskReversalBlock({ data, theme: _theme = 'light' }: RiskReversalBlockProps) {
  const guaranteeBullets = (data.guarantee_bullets ?? []).filter((item): item is string => Boolean(item?.trim()))

  if (!data.headline?.trim() && !data.guarantee_body?.trim() && guaranteeBullets.length === 0) {
    return null
  }

  return (
    <section className="w-full py-1 text-[var(--brand-text-main)]">
      <div className="space-y-6">
        {data.headline ? <h3 className="max-w-4xl text-3xl font-black leading-tight tracking-tight md:text-4xl">{renderHighlightedText(data.headline)}</h3> : null}
        {data.guarantee_duration_text ? (
          <p className="mt-4 text-xs font-black uppercase tracking-[0.22em]" style={{ color: 'var(--brand-primary)' }}>
            {data.guarantee_duration_text}
          </p>
        ) : null}
        {data.guarantee_body ? <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-[var(--brand-text-main)]/80 md:text-base">{data.guarantee_body}</p> : null}

        {guaranteeBullets.length > 0 ? (
          <ul className="mt-6 space-y-3">
            {guaranteeBullets.map((item, index) => (
              <li key={`${item}-${index}`} className="flex items-start gap-3 text-[15px] leading-relaxed">
                <span
                  className="mt-1 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-sm font-black"
                  style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-cardBg)' }}
                >
                  ✓
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  )
}

export { RiskReversalBlock }
export default RiskReversalBlock
