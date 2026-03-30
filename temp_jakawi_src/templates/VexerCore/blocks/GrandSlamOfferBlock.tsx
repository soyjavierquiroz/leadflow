import type { CtaClickHandler } from '../../types'
import type {
  GrandSlamOfferBlockData,
  GrandSlamOfferBonusItem,
  GrandSlamOfferItem,
  LayoutTheme,
} from './types'
import { renderHighlightedText } from './highlightHeadline'

type GrandSlamOfferBlockProps = {
  data: GrandSlamOfferBlockData
  theme?: LayoutTheme
  onCtaClick?: CtaClickHandler
  product?: {
    resumen_oferta_principal?: {
      precio_final?: string | number
      precio_tachado?: string | number
      ahorro_neto?: string | number
    }
  }
}

function normalizeIncludedItems(items?: GrandSlamOfferItem[]): GrandSlamOfferItem[] {
  return (items ?? []).filter((item) => Boolean(item?.item_name?.trim() || item?.item_description?.trim() || item?.item_value_text?.trim()))
}

function normalizeBonusItems(items?: GrandSlamOfferBonusItem[]): GrandSlamOfferBonusItem[] {
  return (items ?? []).filter((item) => Boolean(item?.bonus_name?.trim() || item?.bonus_description?.trim()))
}

function GrandSlamOfferBlock({ data, theme: _theme = 'light', product }: GrandSlamOfferBlockProps) {
  const block = data
  const includedItems = normalizeIncludedItems(data.what_is_included)
  const bonusItems = normalizeBonusItems(data.bonus_items)
  const resumen = product?.resumen_oferta_principal
  const finalPriceText = resumen?.precio_final ? `Bs. ${resumen.precio_final}` : block.price_stack?.final_price_text
  const savingsText = resumen?.ahorro_neto ? `ahorras Bs. ${resumen.ahorro_neto}` : block.price_stack?.savings_text

  if (!data.headline?.trim() && !data.offer_name?.trim() && includedItems.length === 0 && bonusItems.length === 0) {
    return null
  }

  return (
    <section className="w-full py-1 text-[var(--brand-text-main)]">
      <div className="space-y-7">
        {data.headline ? <h3 className="max-w-4xl text-3xl font-black leading-tight tracking-tight md:text-4xl">{renderHighlightedText(data.headline)}</h3> : null}
        {data.offer_name ? <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--brand-text-main)]/80">{data.offer_name}</p> : null}

        {includedItems.length > 0 ? (
          <div className="space-y-4">
            {includedItems.map((item, index) => (
              <article key={`${item.item_name || item.item_value_text}-${index}`} className="space-y-3">
                <div className="space-y-3">
                  <div>
                    {item.item_name ? <h4 className="text-base font-bold leading-snug">{item.item_name}</h4> : null}
                    {item.item_description ? <p className="mt-2 text-[15px] leading-relaxed text-[var(--brand-text-main)]/80">{item.item_description}</p> : null}
                  </div>
                  {item.item_value_text ? (
                    <span
                      className="inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide"
                      style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-cardBg)' }}
                    >
                      {item.item_value_text}
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {bonusItems.length > 0 ? (
          <div className="space-y-4">
            {bonusItems.map((item, index) => (
              <article key={`${item.bonus_name}-${index}`} className="space-y-3">
                {item.bonus_name ? (
                  <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--brand-primary)' }}>
                    {item.bonus_name}
                  </p>
                ) : null}
                {item.bonus_description ? <p className="mt-3 text-[15px] leading-relaxed text-[var(--brand-text-main)]/80">{item.bonus_description}</p> : null}
              </article>
            ))}
          </div>
        ) : null}

        <div className="space-y-3">
          <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: 'var(--brand-primary)' }}>
            Resumen de la oferta
          </p>
          {finalPriceText ? <p className="mt-5 text-3xl font-black tracking-tight md:text-4xl">{finalPriceText}</p> : null}
          {savingsText ? <p className="mt-3 text-[15px] font-semibold text-[var(--brand-text-main)]/80">{savingsText}</p> : null}
        </div>
      </div>
    </section>
  )
}

export { GrandSlamOfferBlock }
export default GrandSlamOfferBlock
