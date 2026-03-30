import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { SmartGallery } from '../../components/ecommerce/SmartGallery'
import { Footer } from '../../components/layout/Footer'
import { Marquee } from '../../components/marketing/Marquee'
import { PrimaryButton } from '../../components/ui/Buttons/PrimaryButton'
import { WhatsAppFloating } from '../../components/ui/Buttons/WhatsAppFloating'
import type { BovedaOferta } from '../../api/types'
import type { LandingTemplateProps, UIConfig } from '../types'
import { LayoutBlocksRenderer } from '../shared/LayoutBlocksRenderer'
import { TRANSPORT_CTA_TEXT, scrollToBovedaOffers } from '../shared/ctaFlow'
import { isLayoutBlock, type LayoutBlock } from './blocks/types'
import { THEMES, type ThemeKey } from '../../config/themes'
import { resolveMedia } from '../../utils/mediaResolver'
import styles from './styles.module.css'

const PLACEHOLDER_IMAGE = '/images/placeholder-product.svg'
const EXIT_INTENT_DELAY_MS = 10000

type TimeLeft = {
  hours: number
  minutes: number
  seconds: number
}

type ProductLike = {
  slug?: string
  media_folder?: string
  media_dictionary?: Record<string, string>
  boveda_activa?: {
    ofertas?: BovedaOferta[] | Record<string, BovedaOferta>
    oferta_salida?: BovedaOferta
  }
  template?: string
  layout_blocks?: LayoutBlock[]
  description?: string
  short_description?: string
  wc?: {
    slug?: string
    name?: string
    description?: string
    short_description?: string
    images?: unknown[]
  }
  vexer_custom?: {
    descripcion?: string
  }
}

type HeroBovedaOferta = BovedaOferta & {
  combo_key?: string
  activo?: boolean
}

export type TemplateVexerCoreProps = Partial<LandingTemplateProps> & {
  uiConfig?: UIConfig
  vexer?: unknown
  product?: unknown
  forcedThemeKey?: ThemeKey
  benefits?: string[]
  trustItems?: unknown[]
  before?: unknown
  after?: unknown
}

function formatPrice(value: string | number | null | undefined, fallback = ''): string {
  if (value === null || value === undefined) {
    return fallback
  }

  const raw = String(value).trim()
  if (!raw) {
    return fallback
  }

  if (/^(bs\.?|bob|\$|usd|eur)/i.test(raw)) {
    return raw
  }

  if (/^-?\d+([.,]\d+)?$/.test(raw)) {
    return `Bs. ${raw}`
  }

  return raw
}

function parseMoney(value: string | number | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (value === null || value === undefined) {
    return null
  }

  const raw = String(value).trim()
  if (!raw) {
    return null
  }

  const normalized = raw.replace(/[^\d.,-]/g, '')
  if (!normalized) {
    return null
  }

  let candidate = normalized
  const hasDot = candidate.includes('.')
  const hasComma = candidate.includes(',')

  if (hasDot && hasComma) {
    candidate = candidate.replace(/\./g, '').replace(',', '.')
  } else if (hasComma) {
    candidate = candidate.replace(',', '.')
  }

  const parsed = Number(candidate)
  return Number.isFinite(parsed) ? parsed : null
}

function getTimeLeftUntilEndOfDay(now = new Date()): TimeLeft {
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)

  const diffMs = Math.max(0, endOfDay.getTime() - now.getTime())
  const totalSeconds = Math.floor(diffMs / 1000)

  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

function formatTimeUnit(value: number): string {
  return String(value).padStart(2, '0')
}

function formatCountdown(timeLeft: TimeLeft): string {
  return `${formatTimeUnit(timeLeft.hours)}:${formatTimeUnit(timeLeft.minutes)}:${formatTimeUnit(timeLeft.seconds)}`
}

function extractGalleryImages(images: unknown[]): string[] {
  const urls: string[] = []

  images.forEach((item) => {
    if (typeof item === 'string' && item.trim() !== '') {
      urls.push(item.trim())
      return
    }

    if (item && typeof item === 'object') {
      const maybeSrc = (item as { src?: unknown }).src
      const maybeUrl = (item as { url?: unknown }).url

      if (typeof maybeSrc === 'string' && maybeSrc.trim() !== '') {
        urls.push(maybeSrc.trim())
        return
      }

      if (typeof maybeUrl === 'string' && maybeUrl.trim() !== '') {
        urls.push(maybeUrl.trim())
      }
    }
  })

  return Array.from(new Set(urls))
}

function normalizeExitOffer(product: ProductLike): HeroBovedaOferta | undefined {
  const rawOfertas = product?.boveda_activa?.ofertas as unknown
  const ofertasArray =
    rawOfertas && typeof rawOfertas === 'object'
      ? (Array.isArray(rawOfertas) ? rawOfertas : Object.values(rawOfertas as Record<string, unknown>))
      : []

  const directExitOffer = product?.boveda_activa?.oferta_salida as HeroBovedaOferta | undefined
  if (directExitOffer && directExitOffer.precio_venta) {
    return directExitOffer
  }

  const fallbackExitOffer = ofertasArray.find((oferta): oferta is HeroBovedaOferta => {
    if (!oferta || typeof oferta !== 'object') {
      return false
    }

    const candidate = oferta as Partial<HeroBovedaOferta>
    return Boolean(candidate.precio_venta) && (candidate.combo_key === 'salida' || candidate.combo_key === 'oferta_salida')
  })

  return fallbackExitOffer && fallbackExitOffer.precio_venta ? fallbackExitOffer : undefined
}

function TemplateVexerCore(props: TemplateVexerCoreProps) {
  const initialTheme =
    props.forcedThemeKey && Object.prototype.hasOwnProperty.call(THEMES, props.forcedThemeKey) ? props.forcedThemeKey : 'core-fuego'
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>(initialTheme)
  const [showExitIntent, setShowExitIntent] = useState(false)
  const [showSticky, setShowSticky] = useState(false)
  const [timeLeft, setTimeLeft] = useState(() => formatCountdown(getTimeLeftUntilEndOfDay()))
  const delayPassedRef = useRef(false)
  const modalShownRef = useRef(false)
  const historyInjectedRef = useRef(false)
  const activeTheme = THEMES[currentTheme]

  useEffect(() => {
    if (!props.forcedThemeKey || !Object.prototype.hasOwnProperty.call(THEMES, props.forcedThemeKey)) {
      return
    }

    setCurrentTheme(props.forcedThemeKey)
  }, [props.forcedThemeKey])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const root = document.documentElement
    const theme = THEMES[currentTheme]

    root.style.setProperty('--brand-primary', theme.primary)
    root.style.setProperty('--brand-accent', theme.accent)
    root.style.setProperty('--brand-bg', theme.bg)
    root.style.setProperty('--brand-text', theme.text)
    root.style.setProperty('--brand-cardBg', theme.cardBg)
    root.style.setProperty('--brand-borderColor', theme.borderColor)
    root.style.setProperty('--brand-border', theme.borderColor)
    root.style.colorScheme = currentTheme.includes('cyber') || currentTheme.includes('dark') ? 'dark' : 'light'
  }, [currentTheme])

  const marqueeConfig = props.uiConfig?.marquee ?? {
    enabled: false,
    text: '',
    bg_color: activeTheme.primary,
    text_color: activeTheme.bg,
  }
  const whatsappConfig = props.uiConfig?.whatsapp ?? {
    enabled: false,
    number: '',
    message: '',
  }
  const stickyEnabled = props.uiConfig?.sticky_cta?.enabled ?? true
  const stickyText = TRANSPORT_CTA_TEXT

  const productData = (props.product ?? {}) as ProductLike

  const rawUrlPath = typeof window !== 'undefined' ? window.location.pathname : ''
  const urlSlug = rawUrlPath.split('/').filter(Boolean).pop() || ''
  const safeLayoutBlocks = (productData.layout_blocks ?? []).filter(isLayoutBlock)
  const hasBovedaBlock = safeLayoutBlocks.some((block) => block.type === 'boveda_dinamica')

  const rawMediaFolder = productData.media_folder || productData.wc?.slug || productData.slug || urlSlug || ''
  const mediaFolder =
    String(rawMediaFolder)
      .trim()
      .replace(/[\?#].*$/, '')
      .replace(/^\/+|\/+$/g, '') || 'placeholder-product'

  const mediaDictionary = productData.media_dictionary ?? {}
  const hasMediaDictionary = Object.keys(mediaDictionary).length > 0

  const CDN_BASE = `https://cdn.jakawi.store/media/products/${mediaFolder}`
  const legacyGalleryImages = [`${CDN_BASE}/hero.webp`, `${CDN_BASE}/gallery-1.webp`, `${CDN_BASE}/gallery-2.webp`, `${CDN_BASE}/gallery-3.webp`]
  const dictionaryGalleryImages = ['hero', 'gallery_1', 'gallery_2', 'gallery_3', 'gallery_4', 'gallery_5', 'gallery_6', 'product_box']
    .map((key) => resolveMedia(key, mediaDictionary, false))
    .filter((item): item is string => Boolean(item?.trim()))
  const wcGalleryImages = extractGalleryImages(productData.wc?.images ?? [])
  const galleryImages = useMemo(() => {
    if (hasMediaDictionary && dictionaryGalleryImages.length > 0) {
      return dictionaryGalleryImages
    }

    if (wcGalleryImages.length > 0) {
      return wcGalleryImages
    }

    return legacyGalleryImages.length > 0 ? legacyGalleryImages : [PLACEHOLDER_IMAGE]
  }, [hasMediaDictionary, dictionaryGalleryImages, wcGalleryImages, legacyGalleryImages])
  const desktopStickyImage = galleryImages.find((image) => image && image !== PLACEHOLDER_IMAGE)
  const desktopStickyTitle = productData.wc?.name?.trim() || 'Oferta Especial'

  const ofertaSalida = useMemo(() => normalizeExitOffer(productData), [productData])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return
    }

    if (!ofertaSalida) {
      return
    }

    delayPassedRef.current = false
    modalShownRef.current = false
    historyInjectedRef.current = false

    const injectHistoryTrap = () => {
      if (historyInjectedRef.current) {
        return
      }

      try {
        window.history.pushState({ isFake: true }, '', window.location.href)
        historyInjectedRef.current = true
      } catch (error) {
        console.error('Failed to inject fake history state for exit intent', error)
      }
    }

    const showExitIntentModal = () => {
      if (!delayPassedRef.current || modalShownRef.current) {
        return
      }

      setShowExitIntent(true)
      modalShownRef.current = true
    }

    let interactionListenersBound = true

    const removeInteractionListeners = () => {
      if (!interactionListenersBound) {
        return
      }

      interactionListenersBound = false
      window.removeEventListener('touchstart', handleFirstInteraction)
      window.removeEventListener('click', handleFirstInteraction)
      window.removeEventListener('scroll', handleFirstInteraction)
    }

    function handleFirstInteraction() {
      injectHistoryTrap()
      removeInteractionListeners()
    }

    const handleMouseOut = (event: MouseEvent) => {
      if (event.clientY <= 50) {
        showExitIntentModal()
      }
    }

    const handlePopState = () => {
      if (delayPassedRef.current && !modalShownRef.current) {
        setShowExitIntent(true)
        modalShownRef.current = true
        window.history.pushState({ isFake: true }, '', window.location.href)
        historyInjectedRef.current = true
      } else if (!delayPassedRef.current && historyInjectedRef.current) {
        window.history.back()
      }
    }

    const armTimeoutId = window.setTimeout(() => {
      delayPassedRef.current = true
    }, EXIT_INTENT_DELAY_MS)

    document.addEventListener('mouseout', handleMouseOut)
    window.addEventListener('touchstart', handleFirstInteraction, { passive: true })
    window.addEventListener('click', handleFirstInteraction, { passive: true })
    window.addEventListener('scroll', handleFirstInteraction, { passive: true })
    window.addEventListener('popstate', handlePopState)

    return () => {
      window.clearTimeout(armTimeoutId)
      document.removeEventListener('mouseout', handleMouseOut)
      removeInteractionListeners()
      window.removeEventListener('popstate', handlePopState)
    }
  }, [ofertaSalida])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleScroll = () => {
      setShowSticky(window.scrollY > 500)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const intervalId = window.setInterval(() => {
      setTimeLeft(formatCountdown(getTimeLeftUntilEndOfDay()))
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const handleExitIntentAccept = () => {
    if (!ofertaSalida) {
      return
    }

    const parsedExitQty = Number(ofertaSalida.cantidad)
    const exitQty = Number.isFinite(parsedExitQty) && parsedExitQty > 0 ? Math.floor(parsedExitQty) : 1
    const exitSaleValue = parseMoney(ofertaSalida.precio_venta)

    setShowExitIntent(false)
    props.onCtaClick?.(exitQty, exitSaleValue ?? undefined, {
      selectedOffer: ofertaSalida,
      source: 'exit-offer',
    })
  }

  const wrapperStyle = {
    '--brand-primary': activeTheme.primary,
    '--brand-accent': activeTheme.accent,
    '--brand-bg': activeTheme.bg,
    '--brand-text': activeTheme.text,
    '--brand-text-main': '#111827',
    '--brand-cta-main': '#f59e0b',
    '--brand-cta-text': '#ffffff',
    '--brand-cardBg': activeTheme.cardBg,
    '--brand-borderColor': activeTheme.borderColor,
    backgroundColor: 'var(--brand-bg)',
    color: 'var(--brand-text-main)',
  } as CSSProperties

  const themedMarqueeConfig = {
    ...marqueeConfig,
    bg_color: activeTheme.primary,
    text_color: activeTheme.bg,
  }

  const galleryColumnStyle = {
    '--brand-primary': '#f59e0b',
    '--brand-borderColor': 'rgba(255,255,255,0.14)',
    '--brand-bg': '#111827',
    '--brand-cardBg': '#111827',
  } as CSSProperties

  const salesColumnStyle = {
    '--brand-text-main': '#111827',
    '--brand-primary': activeTheme.primary,
    '--brand-borderColor': 'rgba(17,24,39,0.12)',
    '--brand-bg': '#ffffff',
    '--brand-cardBg': '#ffffff',
  } as CSSProperties

  const handleTransportCtaClick = () => {
    if (hasBovedaBlock) {
      scrollToBovedaOffers()
      return
    }

    props.onCtaClick?.()
  }

  const handleStickyCtaClick = () => {
    scrollToBovedaOffers()
  }

  return (
    <>
      <main className={styles.page} style={wrapperStyle}>
        <Marquee {...themedMarqueeConfig} variant="clean" />

        <section className="pb-0 pt-0">
          <div className="relative left-1/2 right-1/2 -mx-[50vw] w-screen">
            <div className="relative flex flex-col lg:flex-row lg:gap-0">
              <div
                className="hidden min-h-screen bg-[#111827] lg:block lg:w-1/2 lg:flex-shrink-0"
                style={galleryColumnStyle}
              >
                <div className="h-full pt-16 lg:ml-auto lg:max-w-[min(50vw,44rem)] lg:px-8 xl:px-12">
                  <div className="sticky top-28 self-start lg:-translate-y-12" style={{ maxHeight: 'calc(100vh - 12rem)' }}>
                    <div className="bg-transparent p-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      <SmartGallery images={galleryImages} thumbnailPosition="bottom" />
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="flex w-full flex-col bg-white pb-24 pt-5 text-[#111827] lg:w-1/2 lg:pb-24 lg:pt-16"
                style={salesColumnStyle}
              >
                <div className="w-full lg:max-w-[min(50vw,44rem)] lg:px-8 xl:px-12">
                  <LayoutBlocksRenderer
                    blocks={safeLayoutBlocks}
                    product={productData}
                    onCtaClick={handleTransportCtaClick}
                    onBovedaCtaClick={props.onCtaClick}
                    theme={currentTheme.includes('cyber') ? 'dark' : 'light'}
                    mediaDictionary={mediaDictionary}
                    ctaClassName={styles.cta}
                    ctaTitleClassName={styles.ctaTitle}
                    ctaSubClassName={styles.ctaSub}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <Footer variant="dark" />
        <WhatsAppFloating {...whatsappConfig} />

        {!props.forcedThemeKey ? (
          <div
            className="fixed bottom-4 right-4 z-50 flex max-w-xs flex-col gap-3 rounded-xl border p-3 shadow-2xl"
            style={{
              backgroundColor: 'var(--brand-cardBg)',
              color: 'var(--brand-text)',
              borderColor: 'var(--brand-borderColor)',
            }}
          >
            <span className="border-b pb-1 text-[10px] font-black uppercase tracking-widest opacity-70" style={{ borderColor: 'var(--brand-borderColor)' }}>
              Paletas Curadas
            </span>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase opacity-70">Core</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentTheme('core-fuego')}
                  className="rounded border px-2 py-1 text-xs"
                  style={{ backgroundColor: THEMES['core-fuego'].primary, color: THEMES['core-fuego'].bg, borderColor: THEMES['core-fuego'].accent }}
                >
                  Fuego
                </button>
                <button
                  onClick={() => setCurrentTheme('core-eco')}
                  className="rounded border px-2 py-1 text-xs"
                  style={{ backgroundColor: THEMES['core-eco'].primary, color: THEMES['core-eco'].bg, borderColor: THEMES['core-eco'].accent }}
                >
                  Eco
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase opacity-70">Cyber</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentTheme('cyber-matrix')}
                  className="rounded border px-2 py-1 text-xs"
                  style={{ backgroundColor: THEMES['cyber-matrix'].cardBg, color: THEMES['cyber-matrix'].primary, borderColor: THEMES['cyber-matrix'].accent }}
                >
                  Matrix
                </button>
                <button
                  onClick={() => setCurrentTheme('cyber-synth')}
                  className="rounded border px-2 py-1 text-xs"
                  style={{ backgroundColor: THEMES['cyber-synth'].cardBg, color: THEMES['cyber-synth'].primary, borderColor: THEMES['cyber-synth'].accent }}
                >
                  Synth
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase opacity-70">Aura</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentTheme('aura-mono')}
                  className="rounded border px-2 py-1 text-xs"
                  style={{ backgroundColor: THEMES['aura-mono'].cardBg, color: THEMES['aura-mono'].text, borderColor: THEMES['aura-mono'].borderColor }}
                >
                  Mono
                </button>
                <button
                  onClick={() => setCurrentTheme('aura-rose')}
                  className="rounded border px-2 py-1 text-xs"
                  style={{ backgroundColor: THEMES['aura-rose'].cardBg, color: THEMES['aura-rose'].primary, borderColor: THEMES['aura-rose'].accent }}
                >
                  Rose
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {showExitIntent && ofertaSalida ? (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ color: '#111827' }}>
              <div
                className="relative rounded-t-2xl p-5 text-center"
                style={{
                  backgroundColor: '#111827',
                  color: '#ffffff',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowExitIntent(false)}
                  className="absolute right-4 top-4 p-1 text-lg font-bold text-white/80 transition hover:text-white"
                  aria-label="Cerrar oferta especial"
                >
                  ✕
                </button>
                <div className="pr-8 sm:pr-0">
                  <h2 className="text-balance text-xl font-black uppercase tracking-wide sm:text-2xl">¡ALTO AHÍ! NO CIERRES ESTA{'\u00a0'}PÁGINA...</h2>
                  <p className="mt-2 text-balance text-sm leading-tight opacity-90">Te haré una oferta tan buena que te sentirás mal si la dejas{'\u00a0'}pasar.</p>
                </div>
              </div>

              <div className="p-6 text-center">
                <span className="inline-flex rounded-full border border-teal-500 bg-teal-50 px-3 py-1 text-xs font-bold uppercase tracking-widest text-teal-700">
                  🔥 Descuento Desbloqueado
                </span>

                <h3 className="mb-2 mt-4 text-balance text-xl font-black text-gray-900 sm:text-2xl">MI OFERTA SECRETA PARA{'\u00a0'}TI</h3>

                <p className="mb-5 px-1 text-pretty text-sm leading-relaxed text-gray-700 sm:px-4 sm:text-base">
                  No te vayas con las manos vacías. Si finalizas tu pedido <span className="font-bold text-red-600">AHORA MISMO</span>, te llevas este
                  descuento oculto. Mismos beneficios y <strong>pago en casa</strong>, pero a un precio que desaparecerá si cierras esta{'\u00a0'}pestaña.
                </p>

                <div className="mb-6 mt-5 flex items-end justify-center gap-2">
                  <span className="text-4xl font-black" style={{ color: activeTheme.primary }}>
                    {formatPrice(ofertaSalida.precio_venta, 'Bs. 0')}
                  </span>
                  {ofertaSalida.precio_tachado ? <span className="mb-1 text-base text-slate-400 line-through">{formatPrice(ofertaSalida.precio_tachado)}</span> : null}
                </div>

                <PrimaryButton className="w-full" onClick={handleExitIntentAccept}>
                  SI, QUIERO ESTA OFERTA
                </PrimaryButton>
                <p className="mt-2 text-xs font-medium text-[#111827]/65">Es 100% libre de riesgo</p>

                <button
                  type="button"
                  onClick={() => setShowExitIntent(false)}
                  className="mt-5 text-sm font-medium text-gray-400 transition-colors hover:text-gray-600 hover:underline"
                >
                  No, gracias. Prefiero pagar el precio normal.
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      {stickyEnabled && hasBovedaBlock ? (
        <>
          <div
            className={`fixed bottom-0 left-0 z-50 w-full border-t border-gray-100 bg-white/90 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] backdrop-blur-sm transition-all duration-300 lg:hidden ${
              showSticky ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
            }`}
          >
            <PrimaryButton className="w-full" onClick={handleStickyCtaClick}>
              {stickyText}
            </PrimaryButton>
            <div className="mt-2 text-center text-[11px] font-medium leading-none text-black">
              Precios garantizados por:{' '}
              <span className="font-bold tracking-tight tabular-nums text-red-600">{timeLeft}</span>
            </div>
          </div>

          <div
            className={`fixed bottom-0 left-0 z-50 hidden w-full items-center justify-between border-t border-gray-200 bg-white px-8 py-3 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] transition-transform duration-300 lg:flex ${
              showSticky ? 'translate-y-0' : 'translate-y-full'
            }`}
          >
            <div className="flex items-center gap-4">
              {desktopStickyImage ? (
                <img src={desktopStickyImage} alt={desktopStickyTitle} className="h-12 w-12 rounded-md border border-gray-100 object-cover" />
              ) : null}

              <div className="flex flex-col">
                <div className="text-sm font-bold text-gray-900">{desktopStickyTitle}</div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex items-center gap-0.5 text-[#f59e0b]">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <svg key={`desktop-sticky-star-${index}`} viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4 fill-current">
                        <path d="m10 1.7 2.5 5.2 5.8.8-4.2 4.1 1 5.8-5.1-2.7-5.1 2.7 1-5.8-4.2-4.1 5.8-.8L10 1.7Z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">4.9 • +700 reseñas</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-sm font-medium text-gray-600">
                Precios garantizados por: <span className="font-bold tabular-nums text-red-600">{timeLeft}</span>
              </div>
              <button
                type="button"
                onClick={handleStickyCtaClick}
                className="rounded-full bg-gradient-to-r from-[#ffec64] to-[#ffab23] px-8 py-3 text-lg font-black text-black shadow-md transition-transform hover:scale-105 md:text-xl"
              >
                {stickyText}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}

export { TemplateVexerCore, TemplateVexerCore as VexerCore }
export default TemplateVexerCore
