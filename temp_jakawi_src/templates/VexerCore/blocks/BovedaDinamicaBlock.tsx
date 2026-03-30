import { useEffect, useId, useMemo, useState } from 'react'
import type { BovedaOferta, ProductLike } from '../../../api/types'
import { PrimaryButton } from '../../../components/ui/Buttons/PrimaryButton'
import type { CtaClickHandler } from '../../types'
import { BOVEDA_OFERTAS_ID } from '../../shared/ctaFlow'
import type { BovedaDinamicaBlockData, LayoutTheme } from './types'
import { renderHighlightedText } from './highlightHeadline'

type NormalizedOffer = {
  quantity: number
  title: string
  priceText: string
  compareText?: string
  savingsText?: string
  ribbon?: string
  description?: string
  offer: BovedaOferta
}

type BovedaDinamicaBlockProps = {
  data: BovedaDinamicaBlockData
  product?: ProductLike
  theme?: LayoutTheme
  onCtaClick?: CtaClickHandler
  onOpenDrawer?: CtaClickHandler
  compactMode?: 'default' | 'inline-mobile-hero' | 'embedded-sales-column'
  sectionId?: string | null
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

function formatPrice(value: number): string {
  return `Bs ${Math.round(value).toLocaleString('es-BO')}`
}

function getOfferTitle(quantity: number): string {
  return `Comprar ${quantity} ${quantity === 1 ? 'Unidad' : 'Unidades'}`
}

function getFloatingBadge(index: number): string | null {
  if (index === 1) {
    return 'MÁS VENDIDO'
  }

  if (index === 2) {
    return 'MÁS AHORRO'
  }

  return null
}

function isExitOffer(oferta: BovedaOferta | null | undefined): boolean {
  if (!oferta) {
    return true
  }

  const comboKey = typeof oferta.combo_key === 'string' ? oferta.combo_key.trim().toLowerCase() : ''
  const title = typeof oferta.titulo === 'string' ? oferta.titulo.trim().toLowerCase() : ''
  const featuredLabel = typeof oferta.etiqueta_destacada === 'string' ? oferta.etiqueta_destacada.trim().toLowerCase() : ''
  const offerLabel = typeof oferta.etiqueta_oferta === 'string' ? oferta.etiqueta_oferta.trim().toLowerCase() : ''

  return [comboKey, title, featuredLabel, offerLabel].some((value) => value.includes('salida'))
}

function normalizeOffers(product?: ProductLike): NormalizedOffer[] {
  const rawOfertas = product?.boveda_activa?.ofertas
  const ofertas = Array.isArray(rawOfertas)
    ? (rawOfertas as BovedaOferta[])
    : rawOfertas && typeof rawOfertas === 'object'
    ? (Object.values(rawOfertas as Record<string, BovedaOferta>) as BovedaOferta[])
    : []

  return ofertas
    .filter((oferta): oferta is BovedaOferta => Boolean(oferta) && !isExitOffer(oferta))
    .map((oferta): NormalizedOffer | null => {
      const quantity = toPositiveNumber(oferta?.cantidad)
      const price = toPositiveNumber(oferta?.precio_venta)

      if (!quantity || !price) {
        return null
      }

      const compare = toPositiveNumber(oferta?.precio_tachado)
      const savings = compare && compare > price ? compare - price : null
      const title = typeof oferta.titulo === 'string' && oferta.titulo.trim() !== '' ? oferta.titulo.trim() : `Pack x${Math.floor(quantity)}`
      const ribbon =
        typeof oferta.etiqueta_destacada === 'string' && oferta.etiqueta_destacada.trim() !== ''
          ? oferta.etiqueta_destacada.trim()
          : undefined
      const description =
        typeof oferta.descripcion_corta === 'string' && oferta.descripcion_corta.trim() !== ''
          ? oferta.descripcion_corta.trim()
          : typeof oferta.desc_corta === 'string' && oferta.desc_corta.trim() !== ''
          ? oferta.desc_corta.trim()
          : typeof oferta.etiqueta_oferta === 'string' && oferta.etiqueta_oferta.trim() !== ''
          ? oferta.etiqueta_oferta.trim()
          : undefined

      return {
        quantity: Math.floor(quantity),
        title,
        priceText: formatPrice(price),
        compareText: compare && compare > price ? formatPrice(compare) : undefined,
        savingsText: savings && savings > 0 ? `Ahorras ${formatPrice(savings)}` : undefined,
        ribbon,
        description,
        offer: oferta,
      }
    })
    .filter((item): item is NormalizedOffer => item !== null)
}

function BovedaDinamicaBlock({
  product,
  theme: _theme = 'light',
  onCtaClick,
  onOpenDrawer,
  compactMode = 'default',
  sectionId,
}: BovedaDinamicaBlockProps) {
  const offers = useMemo(() => normalizeOffers(product), [product])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [paymentFeedback, setPaymentFeedback] = useState<string | null>(null)
  const selectedOffer = offers[selectedIndex] ?? offers[0]
  const productName = product?.wc?.name?.trim() || ''
  const productSku = product?.sku?.trim() || product?.wc?.sku?.trim() || ''
  const isInlineMobileHero = compactMode === 'inline-mobile-hero'
  const isEmbeddedSalesColumn = compactMode === 'embedded-sales-column'
  const radioGroupId = useId()
  const resolvedSectionId = sectionId === undefined ? BOVEDA_OFERTAS_ID : sectionId || undefined
  const handleOpenDrawer = onOpenDrawer ?? onCtaClick

  useEffect(() => {
    if (!offers.length) {
      setSelectedIndex(0)
      return
    }

    if (selectedIndex > offers.length - 1) {
      setSelectedIndex(0)
    }
  }, [offers, selectedIndex])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    let timeoutId: ReturnType<typeof window.setTimeout> | null = null
    const handlePayment = (event: Event) => {
      const customEvent = event as CustomEvent<string>
      const nextFeedback = typeof customEvent.detail === 'string' ? customEvent.detail.trim() : ''
      if (!nextFeedback) {
        return
      }

      setPaymentFeedback(nextFeedback)
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
      timeoutId = window.setTimeout(() => {
        setPaymentFeedback(null)
        timeoutId = null
      }, 6000)
    }

    window.addEventListener('jakawi_payment_selected', handlePayment)

    return () => {
      window.removeEventListener('jakawi_payment_selected', handlePayment)
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  if (!offers.length) {
    return null
  }

  return (
    <section id={resolvedSectionId} className="w-full py-1 text-[var(--brand-text-main)]">
      <div className={isInlineMobileHero || isEmbeddedSalesColumn ? 'space-y-2' : 'space-y-6'}>
        {!isInlineMobileHero ? (
          <div className={isEmbeddedSalesColumn ? '' : 'space-y-2'}>
            {!isEmbeddedSalesColumn ? (
              <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: 'var(--brand-primary)' }}>
                Ofertas disponibles
              </p>
            ) : null}
            <h3 className={isEmbeddedSalesColumn ? 'mb-2 text-xs uppercase tracking-[0.28em] text-gray-400' : 'max-w-4xl text-2xl font-black leading-tight tracking-tight md:text-4xl'}>
              {renderHighlightedText('Elige tu pack y activa tu pedido')}
            </h3>
          </div>
        ) : null}

        {paymentFeedback ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-800 transition-all animate-pulse md:text-base">
            {'✅ Has asegurado tu '}
            <strong>{paymentFeedback}</strong>
            {'. Ahora selecciona tu pack para continuar.'}
          </div>
        ) : null}

        <div className="mx-auto flex w-full max-w-lg flex-col space-y-2">
          {offers.map((offer, index) => {
            const isSelected = selectedOffer?.offer === offer.offer
            const floatingBadge = getFloatingBadge(index)
            const inlineBadge = offer.ribbon ?? (offer.savingsText ? 'DESCUENTO' : undefined)
            const supportingText = offer.savingsText ?? offer.description ?? 'Activa tu pedido con esta oferta.'
            return (
              <label
                key={`${offer.title}-${offer.quantity}-${index}`}
                className={`relative flex items-center justify-between gap-3 rounded-lg border-2 px-3.5 py-2 transition-all duration-200 ease-in-out ${
                  isSelected
                    ? 'relative z-10 scale-[1.02] transform border-2 border-[#ffab23] bg-gradient-to-b from-[#fff8ed] to-white opacity-100 shadow-[0_8px_30px_rgb(255,171,35,0.2)] ring-1 ring-[#ffab23] transition-transform duration-300'
                    : 'border-gray-200 bg-white opacity-80 hover:border-gray-300'
                }`}
              >
                {floatingBadge ? (
                  <span className="absolute -top-2.5 right-4 rounded-sm bg-gradient-to-r from-orange-500 to-[#ffab23] px-2 py-0.5 text-[10px] font-black text-white shadow-md">
                    {floatingBadge}
                  </span>
                ) : null}

                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <input
                    type="radio"
                    name={`boveda-pack-${radioGroupId}`}
                    checked={isSelected}
                    onChange={() => setSelectedIndex(index)}
                    className="sr-only"
                  />

                  <div
                    aria-hidden="true"
                    className={`flex h-5 w-5 shrink-0 rounded-full border-2 transition-all duration-200 ease-in-out ${
                      isSelected ? 'items-center justify-center border-[#ffab23] bg-[#ffab23] ring-2 ring-[#ffab23] ring-offset-2' : 'border-gray-300 bg-white'
                    }`}
                  >
                    {isSelected ? <div className="h-3 w-3 rounded-full bg-white shadow-[0_0_12px_rgba(255,171,35,0.65)]" /> : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-black leading-tight text-gray-900 md:text-lg">
                        {getOfferTitle(offer.quantity)}
                      </p>
                      {inlineBadge ? (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">
                          {inlineBadge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">{supportingText}</p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {offer.compareText ? <p className="text-xs text-gray-400 line-through">{offer.compareText}</p> : null}
                  <p className={`text-lg font-black md:text-xl ${isSelected ? 'text-[#ffab23]' : 'text-gray-900'}`}>{offer.priceText}</p>
                  {!offer.compareText && offer.savingsText ? <p className="text-[11px] font-semibold text-green-700">{offer.savingsText}</p> : null}
                </div>
              </label>
            )
          })}
        </div>

        <div className="mx-auto w-full max-w-lg">
          <PrimaryButton
            className="!w-full !rounded-full !border-[#e63900] !bg-gradient-to-r !from-[#ff5e00] !to-[#e63900] !py-3.5 md:!py-4 !text-lg md:!text-xl !text-white !shadow-[0_4px_20px_rgba(255,94,0,0.4)] hover:!scale-[1.02] hover:!from-[#ff7a1a] hover:!to-[#ff4a00] [text-shadow:none]"
            onClick={() =>
              handleOpenDrawer?.(selectedOffer?.quantity ?? 1, selectedOffer?.offer.precio_venta, {
                selectedOffer: selectedOffer?.offer,
                source: 'boveda',
              })
            }
          >
            PEDIR AHORA MISMO
          </PrimaryButton>

          {(productName || productSku) ? (
            <div className="mt-3 flex flex-col items-center gap-0.5 px-4 text-center font-mono text-[10px] tracking-wide text-slate-400/80 md:text-xs">
              {productName ? <span className="text-center">{productName}</span> : null}
              {productSku ? <span>{`SKU: ${productSku}`}</span> : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export { BovedaDinamicaBlock }
export default BovedaDinamicaBlock
