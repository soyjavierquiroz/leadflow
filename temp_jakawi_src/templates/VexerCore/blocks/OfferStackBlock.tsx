import { useMemo } from 'react'
import type { LayoutTheme, OfferStackBlockData } from './types'
import type { CtaClickHandler } from '../../types'
import type { BovedaOferta } from '../../../api/types'
import styles from './OfferStackBlock.module.css'

type OfferStackBundleOption = {
  quantity: number
  price: string
  priceCompare?: string
  label: string
  subtitle?: string
  badge?: string
  selectedOffer?: BovedaOferta
}

type OfferStackBlockProps = {
  data: OfferStackBlockData
  theme?: LayoutTheme
  onCtaClick?: CtaClickHandler
  ctaClassName?: string
  ctaTitleClassName?: string
  ctaSubClassName?: string
}

function normalizeBundlePrice(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }

  const raw = String(value).trim()
  return raw === '' ? null : raw
}

function buildBundleOptions(data: OfferStackBlockData): OfferStackBundleOption[] {
  const normalized: OfferStackBundleOption[] = []
  const seenQuantities = new Set<number>()

  const pushOption = (quantity: number, price: unknown, label: string) => {
    const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0
    const normalizedPrice = normalizeBundlePrice(price)

    if (safeQuantity <= 0 || !normalizedPrice || seenQuantities.has(safeQuantity)) {
      return
    }

    seenQuantities.add(safeQuantity)
    normalized.push({
      quantity: safeQuantity,
      price: normalizedPrice,
      label,
    })
  }

  pushOption(1, data.offer_1_price ?? data.default_price, data.offer_1_label || 'Pack x1')
  pushOption(2, data.offer_2_price, data.offer_2_label || 'Pack x2')
  pushOption(3, data.offer_3_price, data.offer_3_label || 'Pack x3')

  if (Array.isArray(data.bundle_options)) {
    data.bundle_options.forEach((bundle) => {
      pushOption(
        Number(bundle?.quantity),
        bundle?.price,
        typeof bundle?.label === 'string' && bundle.label.trim() !== '' ? bundle.label.trim() : `Pack x${Number(bundle?.quantity) || 1}`,
      )
    })
  }

  return normalized
}

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

function formatBsPrice(value: number): string {
  return `Bs ${Math.round(value).toLocaleString('es-BO')}`
}

function buildBovedaOptions(data: OfferStackBlockData): OfferStackBundleOption[] {
  const ofertas = Array.isArray(data.boveda_activa?.ofertas) ? data.boveda_activa.ofertas : []
  const normalized: OfferStackBundleOption[] = []
  const seenQuantities = new Set<number>()

  ofertas.forEach((oferta) => {
    const cantidad = toPositiveNumber(oferta?.cantidad)
    const precioVenta = toPositiveNumber(oferta?.precio_venta)

    if (!cantidad || !precioVenta) {
      return
    }

    const safeQuantity = Math.floor(cantidad)
    if (safeQuantity <= 0 || seenQuantities.has(safeQuantity)) {
      return
    }

    seenQuantities.add(safeQuantity)

    const titulo = typeof oferta.titulo === 'string' && oferta.titulo.trim() !== '' ? oferta.titulo.trim() : `Pack x${safeQuantity}`
    const etiquetaOferta =
      typeof oferta.etiqueta_oferta === 'string' && oferta.etiqueta_oferta.trim() !== '' ? oferta.etiqueta_oferta.trim() : undefined
    const etiquetaDestacada =
      typeof oferta.etiqueta_destacada === 'string' && oferta.etiqueta_destacada.trim() !== '' ? oferta.etiqueta_destacada.trim() : undefined
    const descripcionCorta = typeof oferta.desc_corta === 'string' && oferta.desc_corta.trim() !== '' ? oferta.desc_corta.trim() : undefined
    const precioTachado = toPositiveNumber(oferta.precio_tachado)

    normalized.push({
      quantity: safeQuantity,
      price: formatBsPrice(precioVenta),
      priceCompare: precioTachado && precioTachado > precioVenta ? formatBsPrice(precioTachado) : undefined,
      label: titulo,
      subtitle: etiquetaOferta ?? descripcionCorta,
      badge: etiquetaDestacada,
      selectedOffer: oferta,
    })
  })

  return normalized
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <path d="M12 3 5 6v6c0 5 3 8 7 9 4-1 7-4 7-9V6l-7-3Z" />
      <path d="m9.6 12 1.8 1.8 3.4-3.5" />
    </svg>
  )
}

function OfferStackBlock({
  data,
  theme = 'light',
  onCtaClick,
  ctaClassName,
  ctaTitleClassName,
  ctaSubClassName,
}: OfferStackBlockProps) {
  const includes = (data.includes?.length ? data.includes : data.stack_items?.length ? data.stack_items : data.items ?? []).filter(
    (item): item is string => Boolean(item?.trim()),
  )
  const themeClass = theme === 'dark' ? styles.themeDark : theme === 'orange' ? styles.themeOrange : styles.themeLight
  const guaranteeTitle = data.guarantee_title || data.warranty_title || 'Garantia de satisfaccion'
  const guaranteeText = data.guarantee_text || data.warranty_text || 'Tu pedido esta respaldado para comprar con confianza.'
  const buttonText = data.button_text || data.cta_text || 'QUIERO ESTA OFERTA'
  const buttonSubtext = data.subtext || 'Reserva ahora y conserva envio prioritario.'
  const themedCtaClass =
    theme === 'dark'
      ? `${styles.ctaButton} ${styles.ctaButtonDark}`
      : theme === 'orange'
      ? `${styles.ctaButton} ${styles.ctaButtonOrange}`
      : `${styles.ctaButton} ${styles.ctaButtonLight}`
  const bovedaOptions = useMemo(() => buildBovedaOptions(data), [data])
  const bundleOptions = useMemo(() => {
    if (bovedaOptions.length > 0) {
      return bovedaOptions
    }
    return buildBundleOptions(data)
  }, [bovedaOptions, data])
  const defaultBundle = useMemo(() => {
    if (bundleOptions.length === 0) {
      return null
    }

    const defaultByQty = bundleOptions.find((bundle) => bundle.quantity === 1)
    if (defaultByQty) {
      return defaultByQty
    }

    const explicitDefault = normalizeBundlePrice(data.default_price)
    if (explicitDefault) {
      const matchedByPrice = bundleOptions.find((bundle) => bundle.price === explicitDefault)
      if (matchedByPrice) {
        return matchedByPrice
      }
    }

    return bundleOptions[0]
  }, [bundleOptions, data.default_price])

  return (
    <section className={`${styles.block} ${themeClass}`} aria-label="Offer stack block">
      <h3 className={styles.headline}>{data.headline || 'Esto es lo que incluye tu compra'}</h3>
      {data.subtitle ? <p className={styles.subtitle}>{data.subtitle}</p> : null}

      {includes.length > 0 ? (
        <ul className={styles.includesList}>
          {includes.map((item, index) => (
            <li key={`${item}-${index}`} className={styles.includesItem}>
              <span className={styles.dot} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={styles.guaranteeBox}>
        <ShieldIcon />
        <div>
          <p className={styles.guaranteeTitle}>{guaranteeTitle}</p>
          <p className={styles.guaranteeText}>{guaranteeText}</p>
        </div>
      </div>

      {data.footer_note ? <p className={styles.footer}>{data.footer_note}</p> : null}

      {bundleOptions.length > 0 ? (
        <div className={styles.bundleGrid}>
          {bundleOptions.map((bundle) => (
            <button
              key={`${bundle.quantity}-${bundle.price}`}
              type="button"
              className={styles.bundleButton}
              onClick={() =>
                onCtaClick?.(bundle.quantity, bundle.price, {
                  selectedOffer: bundle.selectedOffer,
                  source: bundle.selectedOffer ? 'boveda' : 'legacy',
                })
              }
            >
              {bundle.badge ? <span className={styles.bundleLabel}>{bundle.badge}</span> : null}
              <span className={styles.bundleLabel}>{bundle.label}</span>
              {bundle.subtitle ? <span className={styles.bundleLabel}>{bundle.subtitle}</span> : null}
              {bundle.priceCompare ? (
                <span className={styles.bundlePrice} style={{ textDecoration: 'line-through', opacity: 0.7 }}>
                  {bundle.priceCompare}
                </span>
              ) : null}
              <span className={styles.bundlePrice}>{bundle.price}</span>
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        className={ctaClassName || themedCtaClass}
        onClick={() =>
          onCtaClick?.(defaultBundle?.quantity ?? 1, defaultBundle?.price ?? undefined, {
            selectedOffer: defaultBundle?.selectedOffer,
            source: defaultBundle?.selectedOffer ? 'boveda' : 'legacy',
          })
        }
      >
        <span className={ctaTitleClassName || styles.ctaTitle}>{buttonText}</span>
        <span className={ctaSubClassName || styles.ctaSub}>{buttonSubtext}</span>
      </button>
    </section>
  )
}

export { OfferStackBlock }
export default OfferStackBlock
