import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { CheckoutDrawer } from '../components/checkout/CheckoutDrawer'
import { PageLoader } from '../components/ui/Loaders/PageLoader'
import { VexerCyber as TemplateVexerCyber } from '../templates/VexerCyber'
import TemplateVexerCore from '../templates/VexerCore'
import TemplateVexerAura from '../templates/VexerAura'
import { HighConvertVSL as TemplateHighConvertVSL } from '../templates/HighConvertVSL'
import type {
  BovedaActiva,
  BovedaOferta,
  BovedaSalida,
  LandingDataResponse,
  LandingProduct,
  LandingVexer,
} from '../api/types'
import { DRENVEX_BY_DOMAIN_ENDPOINT, getVexerRevalidationBucket } from '../api/endpoints'
import { AnalyticsBootstrap } from '../analytics/components/AnalyticsBootstrap'
import { useMetaPixel } from '../analytics/analytics/hooks/useMetaPixel'
import { useTikTokPixel } from '../analytics/analytics/hooks/useTikTokPixel'
import { useGoogleTags } from '../analytics/hooks/useGoogleTags'
import { persistStoredPixelIds } from '../analytics/pixelStorage'
import { useCustomScripts } from '../analytics'
import { useVisitor } from '../context/VisitorContext'
import { THEMES, type ThemeKey } from '../config/themes'
import type { CtaSelectionPayload } from '../templates/types'
import { resolveMedia } from '../utils/mediaResolver'
import { resolveTrackingContentId } from '../utils/tracking'

const FALLBACK_IMAGE = '/images/placeholder-product.svg'
const DEFAULT_TEMPLATE_ID = 'vexer-core'
const DEFAULT_GLOBAL_PALETTE = 'eco'

type MediaDictionary = Record<string, string>
type LooseObject = Record<string, unknown>
const EMPTY_VEXER: LandingVexer = {
  id: 0,
  display_name: '',
  nombre_comercial: '',
  dominio: '',
  whatsapp: '',
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizeSlug(value?: string): string {
  if (!value) return ''
  return value.trim().replace(/^\/+|\/+$/g, '').replace(/[,.\s]+$/, '')
}

function resolveProductSlug(product: LandingProduct): string {
  const productSlugCandidates = [product.slug, product.path, product.wc?.slug]

  for (const candidate of productSlugCandidates) {
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      return normalizeSlug(candidate)
    }
  }

  return ''
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

function normalizeMediaDictionary(rawDictionary: unknown): MediaDictionary {
  if (!rawDictionary || typeof rawDictionary !== 'object' || Array.isArray(rawDictionary)) {
    return {}
  }

  const normalized: MediaDictionary = {}
  Object.entries(rawDictionary as Record<string, unknown>).forEach(([key, value]) => {
    if (typeof value !== 'string') {
      return
    }

    const cleanKey = key.trim()
    const cleanValue = value.trim()
    if (!cleanKey || !cleanValue) {
      return
    }

    normalized[cleanKey] = cleanValue
  })

  return normalized
}

function normalizeQrVault(rawVault: unknown): Record<string, string> {
  if (!rawVault || typeof rawVault !== 'object' || Array.isArray(rawVault)) {
    return {}
  }

  const normalized: Record<string, string> = {}
  Object.entries(rawVault as Record<string, unknown>).forEach(([key, value]) => {
    if (typeof value !== 'string') {
      return
    }

    const cleanKey = key.trim()
    const cleanValue = value.trim()
    if (!cleanKey || !cleanValue) {
      return
    }

    normalized[cleanKey] = cleanValue
  })

  return normalized
}

function toSafeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const raw = String(value ?? '')
    .trim()
    .replace(',', '.')
    .replace(/[^0-9.]/g, '')
  if (!raw || raw.split('.').length > 2) {
    return null
  }

  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function toPriceKey(value: number | string): string {
  const parsed = toSafeNumber(value)
  if (!parsed || parsed <= 0) {
    return ''
  }

  const fixed = parsed.toFixed(2)
  return fixed.replace(/\.?0+$/, '')
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const clean = value.trim()
  return clean === '' ? undefined : clean
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value
  }

  if (value === 1 || value === '1') {
    return true
  }

  if (value === 0 || value === '0') {
    return false
  }

  if (typeof value !== 'string') {
    return undefined
  }

  const clean = value.trim().toLowerCase()
  if (clean === 'true') {
    return true
  }

  if (clean === 'false') {
    return false
  }

  return undefined
}

function normalizeTemplateAlias(value: unknown): string {
  const candidate = String(value ?? '')
    .trim()
    .toLowerCase()

  switch (candidate) {
    case 'clean-health':
      return 'vexer-core'
    case 'classic-orange':
      return 'vexer-cyber'
    case 'dark-cyber':
    case 'obra-maestra':
      return 'vexer-aura'
    default:
      return candidate || DEFAULT_TEMPLATE_ID
  }
}

function resolveTemplateFamily(value: string): 'vexer-core' | 'vexer-cyber' | 'vexer-aura' {
  const normalized = normalizeTemplateAlias(value)

  if (normalized === 'vexer-cyber') {
    return 'vexer-cyber'
  }

  if (normalized === 'vexer-aura' || normalized === 'vsl-high-ticket') {
    return 'vexer-aura'
  }

  return 'vexer-core'
}

function resolveThemeKey(templateId: string, palette: string): ThemeKey {
  const family = resolveTemplateFamily(templateId)
  const safePalette = String(palette || '').trim().toLowerCase()

  const familyMap: Record<'vexer-core' | 'vexer-cyber' | 'vexer-aura', Record<string, ThemeKey>> = {
    'vexer-core': {
      eco: 'core-eco',
      fuego: 'core-fuego',
    },
    'vexer-cyber': {
      matrix: 'cyber-matrix',
      synth: 'cyber-synth',
    },
    'vexer-aura': {
      mono: 'aura-mono',
      rose: 'aura-rose',
    },
  }

  const familyThemes = familyMap[family]
  const defaultFamilyTheme: Record<'vexer-core' | 'vexer-cyber' | 'vexer-aura', ThemeKey> = {
    'vexer-core': 'core-eco',
    'vexer-cyber': 'cyber-matrix',
    'vexer-aura': 'aura-mono',
  }

  return familyThemes[safePalette] ?? defaultFamilyTheme[family]
}

function normalizeBovedaOferta(rawOferta: unknown): BovedaOferta | null {
  if (!rawOferta || typeof rawOferta !== 'object' || Array.isArray(rawOferta)) {
    return null
  }

  const source = rawOferta as LooseObject
  const cantidadValue = toSafeNumber(source.cantidad)
  const precioVentaValue = toSafeNumber(source.precio_venta)
  if (!cantidadValue || !precioVentaValue || cantidadValue <= 0 || precioVentaValue <= 0) {
    return null
  }

  const cantidad = Math.floor(cantidadValue)
  const precio_venta = Number(precioVentaValue.toFixed(2))
  const tituloRaw = toOptionalString(source.titulo)
  const qrUrlRaw = toOptionalString(source.qr_url)
  const descripcionCortaRaw = toOptionalString(source.descripcion_corta)
  const descCortaRaw = toOptionalString(source.desc_corta)
  const normalizedShortDescription = descripcionCortaRaw ?? descCortaRaw ?? ''

  const precioTachadoValue = toSafeNumber(source.precio_tachado)
  const precio_tachado = precioTachadoValue && precioTachadoValue > 0 ? Number(precioTachadoValue.toFixed(2)) : undefined

  return {
    ...source,
    cantidad,
    titulo: tituloRaw ?? `Comprar ${cantidad}`,
    etiqueta_oferta: toOptionalString(source.etiqueta_oferta),
    etiqueta_destacada: toOptionalString(source.etiqueta_destacada),
    descripcion_corta: normalizedShortDescription,
    desc_corta: normalizedShortDescription,
    combo_key: toOptionalString(source.combo_key),
    activo: toOptionalBoolean(source.activo),
    image_key: toOptionalString(source.image_key),
    precio_venta,
    precio_tachado,
    qr_url: qrUrlRaw ?? '',
    banco: toOptionalString(source.banco) ?? '',
    titular: toOptionalString(source.titular) ?? '',
    descripcion_qr: toOptionalString(source.descripcion_qr) ?? '',
    glosa_bancaria: toOptionalString(source.glosa_bancaria),
  }
}

function normalizeBovedaSalida(rawSalida: unknown): BovedaSalida | undefined {
  const base = normalizeBovedaOferta(rawSalida)
  if (!base || !rawSalida || typeof rawSalida !== 'object' || Array.isArray(rawSalida)) {
    return undefined
  }

  const source = rawSalida as LooseObject
  const activo = toOptionalBoolean(source.activo) ?? false

  return {
    ...base,
    activo,
    etiqueta_descuento: toOptionalString(source.etiqueta_descuento),
    texto_boton: toOptionalString(source.texto_boton),
  }
}

function normalizeBovedaActiva(rawBoveda: unknown): BovedaActiva | null {
  if (!rawBoveda || typeof rawBoveda !== 'object' || Array.isArray(rawBoveda)) {
    return null
  }

  const source = rawBoveda as LooseObject
  const rawOfertas = source.ofertas
  const ofertasCandidates = Array.isArray(rawOfertas)
    ? rawOfertas
    : rawOfertas && typeof rawOfertas === 'object' && !Array.isArray(rawOfertas)
    ? Object.values(rawOfertas as Record<string, unknown>)
    : []
  const ofertas = ofertasCandidates.map((item) => normalizeBovedaOferta(item)).filter((item): item is BovedaOferta => item !== null)

  if (ofertas.length === 0) {
    return null
  }

  const oferta_salida = normalizeBovedaSalida(source.oferta_salida)
  return oferta_salida ? { ofertas, oferta_salida } : { ofertas }
}

function normalizeVexer(rawVexer: unknown): LandingVexer | null {
  if (!rawVexer || typeof rawVexer !== 'object' || Array.isArray(rawVexer)) {
    return null
  }

  const source = rawVexer as LooseObject
  const id = Number(source.id)
  const displayName = typeof source.display_name === 'string' ? source.display_name.trim() : ''
  const nombreComercial = typeof source.nombre_comercial === 'string' ? source.nombre_comercial.trim() : ''
  const dominio = typeof source.dominio === 'string' ? source.dominio.trim() : ''
  const whatsapp = typeof source.whatsapp === 'string' ? source.whatsapp.trim() : ''

  if (!Number.isFinite(id) || id <= 0 || (displayName === '' && nombreComercial === '')) {
    return null
  }

  const getOptionalString = (key: string): string | undefined => {
    const value = source[key]
    if (typeof value !== 'string') {
      return undefined
    }
    const clean = value.trim()
    return clean === '' ? undefined : clean
  }

  return {
    id,
    display_name: displayName,
    nombre_comercial: nombreComercial,
    dominio,
    whatsapp,
    pixel_meta: getOptionalString('pixel_meta'),
    pixel_tiktok: getOptionalString('pixel_tiktok'),
    google_analytics_id: getOptionalString('google_analytics_id'),
    gtm_id: getOptionalString('gtm_id'),
    script_global_head: getOptionalString('script_global_head'),
    script_global_footer: getOptionalString('script_global_footer'),
  }
}

function resolveTrackingProductId(product: LandingProduct): number {
  return product.product_id > 0 ? product.product_id : product.wc.id
}

function resolveTrackingValue(value: unknown): number {
  const parsed = toSafeNumber(value)
  return parsed && parsed > 0 ? Number(parsed.toFixed(2)) : 0
}

function injectDynamicPriceTokens(layoutBlocks: unknown, customPrice: string | number): unknown[] {
  if (!Array.isArray(layoutBlocks) || layoutBlocks.length === 0) {
    return Array.isArray(layoutBlocks) ? layoutBlocks : []
  }

  const rawBlocksString = JSON.stringify(layoutBlocks)
  if (!rawBlocksString) {
    return layoutBlocks
  }

  const dynamicBlocksString = rawBlocksString.replace(/\{\{PRECIO\}\}/g, String(customPrice))

  try {
    const dynamicBlocks = JSON.parse(dynamicBlocksString) as unknown
    return Array.isArray(dynamicBlocks) ? dynamicBlocks : layoutBlocks
  } catch {
    return layoutBlocks
  }
}

function upsertMetaTag(attr: 'property' | 'name', key: string, content: string): void {
  if (!key) {
    return
  }

  const selector = `meta[${attr}="${key}"]`
  let tag = document.head.querySelector(selector) as HTMLMetaElement | null
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attr, key)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

export function UniversalProductPage() {
  const { visitorData } = useVisitor()
  const location = useLocation()
  const { category, slug } = useParams<{ category?: string; slug?: string }>()
  const hostname = useMemo(() => window.location.hostname.trim().toLowerCase(), [])
  const locationState =
    location.state && typeof location.state === 'object' && !Array.isArray(location.state)
      ? (location.state as { fromStorefront?: boolean })
      : null
  const fromStorefront = locationState?.fromStorefront === true
  const cleanSlug = useMemo(() => normalizeSlug(slug), [slug])
  const cleanCategory = useMemo(() => normalizeSlug(category), [category])
  const querySlug = useMemo(() => {
    return cleanCategory && cleanSlug ? `${cleanCategory}/${cleanSlug}` : cleanSlug || ''
  }, [cleanCategory, cleanSlug])

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<LandingDataResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedQty, setSelectedQty] = useState<number>(1)
  const [selectedBundlePrice, setSelectedBundlePrice] = useState<string>('')
  const [selectedVaultOffer, setSelectedVaultOffer] = useState<BovedaOferta | null>(null)
  const [isExitOfferMode, setIsExitOfferMode] = useState(false)
  const vexerData = useMemo(() => {
    if (!data) {
      return null
    }
    return normalizeVexer(data.vexer) ?? normalizeVexer(data.product?.vexer)
  }, [data])
  const vexerGA = vexerData?.google_analytics_id || null
  const vexerGTM = vexerData?.gtm_id || null
  const headScripts = vexerData?.script_global_head || null
  const footerScripts = vexerData?.script_global_footer || null
  const vexerPixelMeta = vexerData?.pixel_meta || null
  const vexerPixelTiktok = vexerData?.pixel_tiktok || null
  const { track: trackGoogle, isReady: isGoogleReady } = useGoogleTags(vexerGA, vexerGTM)
  const { track, isReady: isPixelReady } = useMetaPixel(vexerPixelMeta)
  const { track: trackTikTok, isReady: isTikTokReady } = useTikTokPixel(vexerPixelTiktok)
  useCustomScripts(headScripts, footerScripts)

  useEffect(() => {
    persistStoredPixelIds({
      meta: vexerPixelMeta,
      tiktok: vexerPixelTiktok,
      gtm: vexerGTM,
      ga: vexerGA,
    })
  }, [vexerGA, vexerGTM, vexerPixelMeta, vexerPixelTiktok])
  const hasTrackedPageView = useRef(false)
  const hasTrackedCheckout = useRef(false)

  useEffect(() => {
    hasTrackedPageView.current = false
    hasTrackedCheckout.current = false

    if (!querySlug) {
      setLoading(false)
      setData(null)
      setError('Producto no encontrado')
      return
    }

    const controller = new AbortController()
    const params = new URLSearchParams({
      domain: hostname,
      path: querySlug,
    })
    params.set('__revalidate', getVexerRevalidationBucket())
    const url = `${DRENVEX_BY_DOMAIN_ENDPOINT}?${params.toString()}`

    setLoading(true)
    setData(null)
    setError(null)

    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(response.status === 404 ? 'Producto no encontrado' : `Error ${response.status}`)
        }
        return response.json() as Promise<LandingDataResponse>
      })
      .then((payload) => {
        setData(payload)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return
        }
        if (err instanceof Error && err.message) {
          setError(err.message)
          return
        }
        setError('Producto no encontrado')
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [hostname, querySlug])

  const products: LandingProduct[] = useMemo(() => {
    if (!data) {
      return []
    }

    return Array.isArray(data.products) && data.products.length > 0 ? data.products : [data.product]
  }, [data])

  const currentProduct = useMemo(() => {
    if (!data || products.length === 0) {
      return null
    }

    return (
      products.find((productCandidate) => {
        const productSlug = resolveProductSlug(productCandidate)

        if (!productSlug) {
          return false
        }

        if (productSlug === querySlug) {
          return true
        }

        return cleanSlug !== '' && (productSlug === cleanSlug || productSlug.endsWith(`/${cleanSlug}`))
      }) || null
    )
  }, [data, products, querySlug, cleanSlug])

  const userCity = useMemo(() => {
    const city = (visitorData?.city || '').trim()
    return city !== '' ? city : 'toda Bolivia'
  }, [visitorData?.city])

  const processedBlocks = useMemo(() => {
    if (!currentProduct?.layout_blocks) return []
    const rawJson = JSON.stringify(currentProduct.layout_blocks)
    const personalizedJson = rawJson.replace(/\{\{CIUDAD\}\}/g, userCity)

    try {
      return JSON.parse(personalizedJson)
    } catch {
      return currentProduct.layout_blocks
    }
  }, [currentProduct?.layout_blocks, userCity])

  const bovedaActiva = useMemo(() => {
    if (!data || !currentProduct) {
      return null
    }

    return (
      normalizeBovedaActiva(currentProduct.boveda_activa) ??
      normalizeBovedaActiva(data.boveda_activa) ??
      normalizeBovedaActiva(currentProduct.qr_vault) ??
      normalizeBovedaActiva(data.qr_vault)
    )
  }, [currentProduct, data])
  const normalizedExitOffer = useMemo(() => {
    return normalizeBovedaOferta(bovedaActiva?.oferta_salida)
  }, [bovedaActiva])
  const trackingProductId = useMemo(() => {
    return currentProduct ? resolveTrackingProductId(currentProduct) : 0
  }, [currentProduct])
  const trackingContentId = useMemo(() => {
    if (!currentProduct) {
      return ''
    }

    return resolveTrackingContentId(currentProduct.wc.sku || currentProduct.sku || '', trackingProductId)
  }, [currentProduct, trackingProductId])
  const viewContentValue = useMemo(() => {
    if (!currentProduct) {
      return 0
    }

    return resolveTrackingValue(
      currentProduct.vexer_custom.precio_final || currentProduct.wc.price_sale || currentProduct.wc.price_regular || '0',
    )
  }, [currentProduct])
  const checkoutTrackingQuantity = useMemo(() => {
    const selectedOfferQuantity = toSafeNumber(selectedVaultOffer?.cantidad)
    if (selectedOfferQuantity && selectedOfferQuantity > 0) {
      return Math.floor(selectedOfferQuantity)
    }

    return Number.isFinite(selectedQty) && selectedQty > 0 ? Math.floor(selectedQty) : 1
  }, [selectedVaultOffer, selectedQty])
  const checkoutTrackingValue = useMemo(() => {
    const selectedOfferValue = resolveTrackingValue(selectedVaultOffer?.precio_venta)
    if (selectedOfferValue > 0) {
      return selectedOfferValue
    }

    const selectedBundleValue = resolveTrackingValue(selectedBundlePrice)
    if (selectedBundleValue > 0) {
      return selectedBundleValue
    }

    return viewContentValue
  }, [selectedVaultOffer, selectedBundlePrice, viewContentValue])

  const dynamicLayoutBlocks = useMemo(() => {
    const customPrice =
      currentProduct?.vexer_custom?.precio_final || currentProduct?.wc?.price_sale || currentProduct?.wc?.price_regular || ''
    const injected = injectDynamicPriceTokens(processedBlocks, customPrice)

    if (!Array.isArray(injected) || !bovedaActiva) {
      return Array.isArray(injected) ? injected : []
    }

    return injected.map((block) => {
      if (!block || typeof block !== 'object' || Array.isArray(block)) {
        return block
      }

      const candidate = block as Record<string, unknown>
      if (candidate.type !== 'offer_stack') {
        return block
      }

      return {
        ...candidate,
        boveda_activa: bovedaActiva,
      }
    })
  }, [processedBlocks, currentProduct?.vexer_custom?.precio_final, currentProduct?.wc?.price_sale, currentProduct?.wc?.price_regular, bovedaActiva])

  const mediaDictionary = useMemo(() => {
    return normalizeMediaDictionary(currentProduct?.media_dictionary ?? data?.media_dictionary)
  }, [currentProduct, data])

  const hasMediaDictionary = Object.keys(mediaDictionary).length > 0
  const dictionaryGalleryImages = useMemo(() => {
    return ['hero', 'gallery_1', 'gallery_2', 'gallery_3', 'gallery_4', 'gallery_5', 'gallery_6', 'product_box']
      .map((key) => resolveMedia(key, mediaDictionary, false))
      .filter((item) => Boolean(item?.trim()))
  }, [mediaDictionary])

  const wcGalleryImages = useMemo(() => {
    return currentProduct ? extractGalleryImages(currentProduct.wc.images ?? []) : []
  }, [currentProduct])

  const galleryImages = useMemo(() => {
    if (hasMediaDictionary && dictionaryGalleryImages.length > 0) {
      return dictionaryGalleryImages
    }

    if (wcGalleryImages.length > 0) {
      return wcGalleryImages
    }

    return [FALLBACK_IMAGE]
  }, [hasMediaDictionary, dictionaryGalleryImages, wcGalleryImages])

  const heroImage = useMemo(() => {
    if (hasMediaDictionary) {
      return resolveMedia('hero', mediaDictionary)
    }

    return galleryImages[0] ?? FALLBACK_IMAGE
  }, [hasMediaDictionary, mediaDictionary, galleryImages])

  const seoCoverImage = useMemo(() => {
    if (hasMediaDictionary) {
      return resolveMedia('seo_cover', mediaDictionary)
    }

    const directSeoImage = String(currentProduct?.seo_data?.og_image || data?.seo_data?.og_image || '').trim()
    if (directSeoImage) {
      return resolveMedia(directSeoImage, mediaDictionary)
    }

    return heroImage || FALLBACK_IMAGE
  }, [hasMediaDictionary, mediaDictionary, currentProduct, data, heroImage])

  useEffect(() => {
    if (!data || !currentProduct) {
      return
    }

    const seoTitle = (currentProduct.seo_data?.title || data.seo_data?.title || currentProduct.wc.name || '').trim()
    const seoDescription = (
      currentProduct.seo_data?.description ||
      data.seo_data?.description ||
      stripHtml(currentProduct.vexer_custom.descripcion || currentProduct.wc.description || '')
    ).trim()

    if (seoTitle) {
      document.title = seoTitle
      upsertMetaTag('property', 'og:title', seoTitle)
      upsertMetaTag('name', 'twitter:title', seoTitle)
    }

    if (seoDescription) {
      upsertMetaTag('name', 'description', seoDescription)
      upsertMetaTag('property', 'og:description', seoDescription)
      upsertMetaTag('name', 'twitter:description', seoDescription)
    }

    upsertMetaTag('property', 'og:image', seoCoverImage)
    upsertMetaTag('name', 'twitter:image', seoCoverImage)
  }, [data, currentProduct, seoCoverImage])

  useEffect(() => {
    if ((isPixelReady || isTikTokReady || isGoogleReady) && data && !hasTrackedPageView.current) {
      let hasTrackedAnyEvent = false

      if (isPixelReady) {
        void track('PageView', {
          page_title: document.title,
          page_path: window.location.pathname,
        })
        hasTrackedAnyEvent = true
      }

      if (isTikTokReady && currentProduct) {
        trackTikTok('ViewContent', {
          contents: [
            {
              content_id: trackingContentId,
              content_type: 'product',
              content_name: currentProduct.wc.name || '',
              quantity: 1,
              price: viewContentValue,
            },
          ],
          content_type: 'product',
          value: viewContentValue,
          currency: 'BOB' as Uppercase<string>,
        })
        hasTrackedAnyEvent = true
      }

      if (isGoogleReady && currentProduct) {
        trackGoogle('view_item', {
          currency: 'BOB',
          value: viewContentValue,
          items: [
            {
              item_id: trackingProductId.toString(),
              item_name: currentProduct.wc.name || '',
              price: viewContentValue,
              quantity: 1,
            },
          ],
        })
        hasTrackedAnyEvent = true
      }

      if (hasTrackedAnyEvent) {
        hasTrackedPageView.current = true
      }
    }
  }, [
    isPixelReady,
    isTikTokReady,
    isGoogleReady,
    data,
    currentProduct,
    track,
    trackTikTok,
    trackGoogle,
    trackingContentId,
    trackingProductId,
    viewContentValue,
  ])

  useEffect(() => {
    if (!isDrawerOpen) {
      hasTrackedCheckout.current = false
    }
  }, [isDrawerOpen])

  useEffect(() => {
    // Disparar solo si el drawer está abierto, el pixel está listo, hay un producto y no lo hemos rastreado aún.
    if (isDrawerOpen && (isPixelReady || isTikTokReady || isGoogleReady) && currentProduct && !hasTrackedCheckout.current) {
      if (isPixelReady) {
        void track('InitiateCheckout', {
          content_name: currentProduct.wc.name,
          content_ids: [trackingProductId.toString()],
          contents: [
            {
              id: trackingProductId.toString(),
              quantity: checkoutTrackingQuantity,
            },
          ],
          currency: 'BOB' as Uppercase<string>,
          value: checkoutTrackingValue > 0 ? checkoutTrackingValue : undefined,
        })
      }

      if (isTikTokReady) {
        trackTikTok('InitiateCheckout', {
          contents: [
            {
              content_id: trackingContentId,
              content_type: 'product',
              content_name: currentProduct.wc.name || '',
              quantity: checkoutTrackingQuantity,
              price: checkoutTrackingValue,
            },
          ],
          content_type: 'product',
          value: checkoutTrackingValue,
          currency: 'BOB' as Uppercase<string>,
        })
      }

      if (isGoogleReady) {
        trackGoogle('begin_checkout', {
          currency: 'BOB',
          value: checkoutTrackingValue,
          items: [
            {
              item_id: trackingProductId.toString(),
              item_name: currentProduct.wc.name || '',
              price: checkoutTrackingValue,
              quantity: checkoutTrackingQuantity,
            },
          ],
        })
      }

      hasTrackedCheckout.current = true
    }
  }, [
    isDrawerOpen,
    isPixelReady,
    isTikTokReady,
    isGoogleReady,
    currentProduct,
    track,
    trackTikTok,
    trackGoogle,
    trackingProductId,
    trackingContentId,
    checkoutTrackingQuantity,
    checkoutTrackingValue,
  ])

  useEffect(() => {
    setIsDrawerOpen(false)
    setSelectedQty(1)
    setSelectedBundlePrice('')
    setSelectedVaultOffer(null)
  }, [querySlug])

  const globalTheme = useMemo(() => {
    return normalizeTemplateAlias(data?.global_config?.theme || DEFAULT_TEMPLATE_ID)
  }, [data?.global_config?.theme])

  const globalPalette = useMemo(() => {
    const candidate = String(data?.global_config?.palette || DEFAULT_GLOBAL_PALETTE)
      .trim()
      .toLowerCase()
    return candidate || DEFAULT_GLOBAL_PALETTE
  }, [data?.global_config?.palette])

  const funnelTemplate = useMemo(() => {
    return String(data?.template || '').trim().toLowerCase()
  }, [data?.template])

  const effectiveTemplateId = useMemo(() => {
    if (fromStorefront) {
      return globalTheme
    }

    const candidate = funnelTemplate || globalTheme
    return candidate || DEFAULT_TEMPLATE_ID
  }, [fromStorefront, funnelTemplate, globalTheme])

  const effectivePalette = useMemo(() => {
    const smartPaletteMap: Record<string, string> = {
      'vexer-core': 'eco',
      'vexer-cyber': 'matrix',
      'vexer-aura': 'mono',
      'vsl-high-ticket': 'mono',
    }

    if (fromStorefront) {
      return globalPalette
    }

    const templateFamily = resolveTemplateFamily(effectiveTemplateId)
    return smartPaletteMap[templateFamily] || smartPaletteMap[effectiveTemplateId] || globalPalette
  }, [fromStorefront, globalPalette, effectiveTemplateId])

  const effectiveThemeKey = useMemo(() => {
    return resolveThemeKey(effectiveTemplateId, effectivePalette)
  }, [effectiveTemplateId, effectivePalette])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const theme = THEMES[effectiveThemeKey]
    const root = document.documentElement

    root.style.setProperty('--brand-primary', theme.primary)
    root.style.setProperty('--brand-accent', theme.accent)
    root.style.setProperty('--brand-bg', theme.bg)
    root.style.setProperty('--brand-text', theme.text)
    root.style.setProperty('--brand-cardBg', theme.cardBg)
    root.style.setProperty('--brand-borderColor', theme.borderColor)
    root.style.setProperty('--brand-border', theme.borderColor)
    root.style.colorScheme = effectiveThemeKey.includes('cyber') || effectiveThemeKey.includes('dark') ? 'dark' : 'light'
  }, [effectiveThemeKey])

  if (loading) {
    return <PageLoader bgColor="#FFFFFF" spinnerColor="#FF5722" />
  }

  if (error || !data) {
    return (
      <div style={{ padding: '50px', background: 'red', color: 'white' }}>
        <h1>🚨 Error 404: Producto no encontrado en la API</h1>
        <p>
          Slug buscado en PHP: <strong>{querySlug}</strong>
        </p>
      </div>
    )
  }

  const { ui_config } = data
  const vexer = vexerData || EMPTY_VEXER

  if (!currentProduct) {
    return (
      <div style={{ padding: '50px', background: '#dc2626', color: 'white', textAlign: 'center' }}>
        <h1>🚨 Error 404: Producto no encontrado</h1>
        <p>
          Buscamos el slug: <strong>{querySlug}</strong> pero no está en la base de datos o no está asignado a este
          Vexer.
        </p>
      </div>
    )
  }

  const customPrice = currentProduct.vexer_custom.precio_final || currentProduct.wc.price_sale || currentProduct.wc.price_regular || ''
  const basePrice = Number(customPrice || currentProduct.wc.price_regular || 0)
  const defaultCheckoutPrice = customPrice || currentProduct.wc.price_regular || '0'
  const rawMediaDictionary = currentProduct.media_dictionary
  const heroFromMediaDictionary = (() => {
    if (!rawMediaDictionary) return ''

    if (Array.isArray(rawMediaDictionary)) {
      const heroEntry = rawMediaDictionary.find((item) => {
        if (!item || typeof item !== 'object') return false
        const candidate = item as { key?: unknown }
        return candidate.key === 'hero'
      }) as { url?: unknown } | undefined

      return typeof heroEntry?.url === 'string' ? heroEntry.url.trim() : ''
    }

    if (typeof rawMediaDictionary === 'object') {
      const mediaMap = rawMediaDictionary as Record<string, unknown>
      return typeof mediaMap.hero === 'string' ? mediaMap.hero.trim() : ''
    }

    return ''
  })()
  const drawerHeroImage = heroFromMediaDictionary || String(currentProduct.seo_data?.og_image || data.seo_data?.og_image || '').trim() || ''
  const companyWhatsapp = (data.company_whatsapp || currentProduct.company_whatsapp || '').trim()
  const legacyQrVault = normalizeQrVault(currentProduct.qr_vault ?? data.qr_vault)
  const bovedaQrVault: Record<string, string> = {}
  if (bovedaActiva) {
    bovedaActiva.ofertas.forEach((oferta) => {
      const url = String(oferta.qr_url || '').trim()
      if (!url) {
        return
      }

      const canonicalKey = toPriceKey(oferta.precio_venta)
      if (canonicalKey) {
        bovedaQrVault[canonicalKey] = url
      }
      bovedaQrVault[String(oferta.precio_venta)] = url
    })
  }
  const qrVault = { ...legacyQrVault, ...bovedaQrVault }
  const currentProductWithMedia = {
    ...currentProduct,
    media_dictionary: currentProduct.media_dictionary ?? data.media_dictionary ?? {},
    layout_blocks: dynamicLayoutBlocks,
    boveda_activa: bovedaActiva ?? undefined,
    qr_vault: qrVault,
  }
  const subtitleSource = currentProduct.vexer_custom.descripcion || currentProduct.wc.description || ''
  const subtitle = stripHtml(subtitleSource)
  const sellerName = vexer.nombre_comercial || vexer.display_name
  const effectiveDrawerPrice = selectedBundlePrice || String(defaultCheckoutPrice)
  const handleOpenDrawer = (qty = 1, price: string | number = defaultCheckoutPrice, selection?: CtaSelectionPayload) => {
    const selectedOffer = normalizeBovedaOferta(selection?.selectedOffer)
    const nextExitOfferMode = selection?.source === 'exit-offer'
    const normalizedQty = selectedOffer ? Math.max(1, Math.floor(selectedOffer.cantidad)) : Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1
    const normalizedPrice = selectedOffer
      ? String(selectedOffer.precio_venta)
      : String(price ?? '').trim() !== ''
      ? String(price ?? '').trim()
      : String(defaultCheckoutPrice)

    setIsExitOfferMode(nextExitOfferMode)
    setSelectedQty(normalizedQty)
    setSelectedBundlePrice(normalizedPrice)
    setSelectedVaultOffer(selectedOffer)
    setIsDrawerOpen(true)
  }

  const templateProps = {
    uiConfig: ui_config,
    vexer,
    product: currentProductWithMedia,
    badge: sellerName,
    title: currentProduct.wc.name || '',
    subtitle,
    price: customPrice || '',
    priceHint: sellerName ? `Vendido por ${sellerName}` : '',
    ctaText: ui_config?.sticky_cta?.text || '',
    onCtaClick: handleOpenDrawer,
    heroImage,
    heroImageAlt: currentProduct.wc.name || '',
    galleryImages: galleryImages.length ? galleryImages : heroImage ? [heroImage] : [],
    features: [],
    testimonials: [],
    faq: [],
    forcedThemeKey: effectiveThemeKey,
  }

  const drawerProductId = trackingProductId
  const drawerVexerDomain = typeof vexer.dominio === 'string' && vexer.dominio.trim() !== '' ? vexer.dominio.trim() : hostname

  let templateElement: ReactNode
  switch (effectiveTemplateId) {
    case 'vexer-cyber':
    case 'classic-orange':
      templateElement = <TemplateVexerCyber {...templateProps} />
      break
    case 'vexer-aura':
    case 'dark-cyber':
      templateElement = <TemplateVexerAura {...templateProps} />
      break
    case 'vexer-core':
    case 'clean-health':
      templateElement = <TemplateVexerCore {...templateProps} />
      break
    case 'vsl-high-ticket':
      templateElement = <TemplateHighConvertVSL {...templateProps} />
      break
    default:
      templateElement = <TemplateVexerCore {...templateProps} />
      break
  }

  return (
    <>
      <AnalyticsBootstrap />
      {templateElement}
      <CheckoutDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false)
          setIsExitOfferMode(false)
        }}
        product={{
          id: drawerProductId,
          price: effectiveDrawerPrice,
          name: currentProduct.wc.name,
          sku: currentProduct.wc.sku || currentProduct.sku || '',
        }}
        vexerPixelMeta={vexer.pixel_meta || null}
        vexerPixelTiktok={vexer.pixel_tiktok || null}
        vexerGoogleAnalyticsId={vexer.google_analytics_id || null}
        vexerGtmId={vexer.gtm_id || null}
        heroImage={drawerHeroImage}
        quantity={selectedQty}
        basePrice={basePrice}
        currentQty={selectedQty}
        onBundleChange={(newQty, newPrice) => {
          setSelectedQty(newQty)
          setSelectedBundlePrice(newPrice.toString())
          setSelectedVaultOffer(isExitOfferMode ? normalizedExitOffer : null)
        }}
        vexerDomain={drawerVexerDomain}
        companyWhatsapp={companyWhatsapp}
        qrVault={qrVault}
        bovedaActiva={bovedaActiva}
        selectedOffer={isExitOfferMode ? normalizedExitOffer ?? selectedVaultOffer : selectedVaultOffer}
        isExitOfferMode={isExitOfferMode}
        ofertaSalida={normalizedExitOffer}
      />
    </>
  )
}
