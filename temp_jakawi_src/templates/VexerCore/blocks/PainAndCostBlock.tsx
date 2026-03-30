import type { CtaClickHandler } from '../../types'
import type { LayoutTheme, PainAndCostBlockData } from './types'
import { renderHighlightedText } from './highlightHeadline'

type PainAndCostBlockProps = {
  data: PainAndCostBlockData
  theme?: LayoutTheme
  onCtaClick?: CtaClickHandler
}

function normalizeList(value?: string[]): string[] {
  return (value ?? []).filter((item): item is string => Boolean(item?.trim()))
}

function PainAndCostBlock({ data, theme: _theme = 'light' }: PainAndCostBlockProps) {
  const painPoints = normalizeList(data.pain_points)
  const costPoints = normalizeList(data.cost_of_inaction_points)
  const failedSolutions = normalizeList(data.failed_solutions_list)

  if (!data.headline?.trim() && painPoints.length === 0 && costPoints.length === 0 && failedSolutions.length === 0) {
    return null
  }

  return (
    <section className="w-full py-1 text-[var(--brand-text-main)]">
      <div className="space-y-7">
        {data.headline ? <h3 className="max-w-4xl text-3xl font-black leading-tight tracking-tight md:text-4xl">{renderHighlightedText(data.headline)}</h3> : null}
        {data.problem_intro ? <p className="max-w-3xl text-[15px] leading-relaxed text-[var(--brand-text-main)]/80 md:text-base">{data.problem_intro}</p> : null}

        <div className="space-y-4">
          {painPoints.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: 'var(--brand-primary)' }}>
                Dolor diario
              </p>
              <ul className="mt-4 space-y-3">
                {painPoints.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-3 text-[15px] leading-relaxed">
                    <span className="font-black" style={{ color: 'var(--brand-primary)' }}>
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {costPoints.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: 'var(--brand-primary)' }}>
                Costo de no actuar
              </p>
              <ul className="mt-4 space-y-3">
                {costPoints.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-3 text-[15px] leading-relaxed">
                    <span className="font-black" style={{ color: 'var(--brand-primary)' }}>
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {failedSolutions.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: 'var(--brand-primary)' }}>
                Lo que ya intentaste
              </p>
              <ul className="mt-4 space-y-3">
                {failedSolutions.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-3 text-[15px] leading-relaxed">
                    <span className="font-black" style={{ color: 'var(--brand-primary)' }}>
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {data.emotional_transition_text ? (
          <div className="text-[15px] leading-relaxed text-[var(--brand-text-main)] md:text-base">
            {data.emotional_transition_text}
          </div>
        ) : null}
      </div>
    </section>
  )
}

export { PainAndCostBlock }
export default PainAndCostBlock
