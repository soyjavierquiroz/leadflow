import type { ProductLike } from '../../../api/types'
import { PrimaryButton } from '../../../components/ui/Buttons/PrimaryButton'
import { resolveProductHeroImage } from '../../../utils/productMedia'
import type { CtaClickHandler } from '../../types'
import { BOVEDA_OFERTAS_ID } from '../../shared/ctaFlow'
import { BovedaDinamicaBlock } from './BovedaDinamicaBlock'
import type { BovedaDinamicaBlockData, HookAndPromiseBlockData, LayoutTheme } from './types'
import { renderHighlightedText } from './highlightHeadline'

const PLACEHOLDER_IMAGE = '/images/placeholder-product.svg'

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }

  const raw = String(value ?? '').trim().replace(',', '.').replace(/[^0-9.]/g, '')
  if (!raw || raw.split('.').length > 2) {
    return null
  }

  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function formatBsValue(value: unknown): string {
  const numericValue = toPositiveNumber(value)
  if (numericValue) {
    return `Bs. ${Math.round(numericValue).toLocaleString('es-BO')}`
  }

  const fallback = String(value ?? '').trim()
  if (!fallback) {
    return ''
  }

  return /^bs\.?/i.test(fallback) ? fallback : `Bs. ${fallback}`
}

function hasDisplayValue(value: unknown): boolean {
  const numericValue = toPositiveNumber(value)
  if (numericValue) {
    return true
  }

  return String(value ?? '').trim() !== ''
}

type HookAndPromiseBlockProps = {
  data: HookAndPromiseBlockData
  theme?: LayoutTheme
  onCtaClick?: CtaClickHandler
  onOpenDrawer?: CtaClickHandler
  product?: ProductLike
  inlineBovedaData?: BovedaDinamicaBlockData | null
}

function HookAndPromiseBlock({
  data,
  theme: _theme = 'light',
  onCtaClick,
  onOpenDrawer,
  product,
  inlineBovedaData = null,
}: HookAndPromiseBlockProps) {
  const bullets = (data.primary_benefit_bullets ?? []).filter((item): item is string => Boolean(item?.trim()))
  const trustBadges = (data.trust_badges ?? []).filter((item): item is string => Boolean(item?.trim()))
  const heroImageUrl = resolveProductHeroImage(product, data.hero_image_url) || PLACEHOLDER_IMAGE
  const ctaText = data.primary_cta_text?.trim() || ''
  const resumen = product?.resumen_oferta_principal
  const fallbackAnchorSource = product?.wc?.price_regular || product?.regular_price || data.price_anchor_text || ''
  const fallbackMainSource = product?.vexer_custom?.precio_final || product?.wc?.price_sale || product?.price || data.price_main_text || ''
  const resolvedPriceAnchorText = hasDisplayValue(resumen?.precio_tachado)
    ? `ANTES ${formatBsValue(resumen?.precio_tachado)}`
    : fallbackAnchorSource
    ? `ANTES ${formatBsValue(fallbackAnchorSource)}`
    : ''
  const resolvedPriceMainText = hasDisplayValue(resumen?.precio_final)
    ? `HOY SOLO ${formatBsValue(resumen?.precio_final)}`
    : fallbackMainSource
    ? `HOY SOLO ${formatBsValue(fallbackMainSource)}`
    : ''

  if (!data.headline?.trim() && !data.subheadline?.trim() && bullets.length === 0) {
    return null
  }

  return (
    <section className="w-full pb-1 pt-0 text-[var(--brand-text-main)]">
      <div className="flex flex-col space-y-3 lg:-mt-6 lg:space-y-4">
        <div className="space-y-1">
          {data.eyebrow_text ? (
            <span
              className="mb-0 inline-flex px-0 py-0 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--brand-text-main)] md:text-xs"
              style={{ color: 'var(--brand-primary)' }}
            >
              {data.eyebrow_text}
            </span>
          ) : null}

          {data.headline ? <h2 className="mb-1 max-w-4xl text-3xl font-black leading-tight tracking-tight lg:text-4xl">{renderHighlightedText(data.headline)}</h2> : null}
          {data.subheadline ? <p className="mb-2 max-w-2xl text-sm text-gray-600">{data.subheadline}</p> : null}
        </div>

        {bullets.length > 0 ? (
          <ul className="space-y-1.5">
            {bullets.map((bullet, index) => (
              <li key={`${bullet}-${index}`} className="flex items-start gap-3">
                <span
                  className="mt-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-black"
                  style={{ backgroundColor: 'var(--brand-primary)', color: 'var(--brand-cardBg)' }}
                >
                  ✓
                </span>
                <span className="text-sm font-medium leading-relaxed">{bullet}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {(resolvedPriceAnchorText || resolvedPriceMainText) ? (
          <div className="mb-2 flex flex-wrap items-end gap-x-3 gap-y-1">
            {resolvedPriceAnchorText ? (
              <span className="text-xs font-semibold uppercase text-gray-400 line-through sm:text-sm lg:text-base">
                {resolvedPriceAnchorText}
              </span>
            ) : null}
            {resolvedPriceMainText ? (
              <span className="whitespace-nowrap text-[6.5vw] font-black tracking-tighter text-[#ffab23] sm:text-3xl lg:text-4xl">
                {resolvedPriceMainText}
              </span>
            ) : null}
          </div>
        ) : null}

        {trustBadges.length > 0 ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {trustBadges.map((badge, index) => (
              <span key={`${badge}-${index}`} className="text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-text-main)]/70 md:text-xs">
                {badge}
              </span>
            ))}
          </div>
        ) : null}

        {inlineBovedaData ? (
          <div id={BOVEDA_OFERTAS_ID}>
            <div className="md:hidden">
              <BovedaDinamicaBlock
                data={inlineBovedaData}
                product={product}
                theme={_theme}
                onCtaClick={onCtaClick}
                onOpenDrawer={onOpenDrawer}
                compactMode="inline-mobile-hero"
                sectionId={null}
              />
            </div>

            <div className="hidden md:block">
              <BovedaDinamicaBlock
                data={inlineBovedaData}
                product={product}
                theme={_theme}
                onCtaClick={onCtaClick}
                onOpenDrawer={onOpenDrawer}
                compactMode="embedded-sales-column"
                sectionId={null}
              />
            </div>
          </div>
        ) : null}

        {ctaText && !inlineBovedaData ? (
          <PrimaryButton onClick={() => onCtaClick?.()}>
            {ctaText}
          </PrimaryButton>
        ) : null}

        <div className="md:hidden">
          <img
            src={heroImageUrl}
            alt={data.hero_image_alt?.trim() || data.headline?.trim() || 'Imagen del producto'}
            loading="lazy"
            className="h-full min-h-[220px] w-full object-cover"
          />
        </div>
      </div>
    </section>
  )
}

export { HookAndPromiseBlock }
export default HookAndPromiseBlock
