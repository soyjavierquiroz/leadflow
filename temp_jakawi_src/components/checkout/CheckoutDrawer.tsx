import { useEffect, useMemo, useState, type CSSProperties, type ChangeEvent, type FormEvent } from 'react'
import { DRENVEX_PRE_ORDER_ENDPOINT } from '../../api/endpoints'
import type { BovedaActiva, BovedaOferta } from '../../api/types'
import { useGoogleTags, useMetaPixel, useTikTokPixel } from '../../analytics'
import { useVisitor } from '../../context/VisitorContext'
import { getCookie } from '../../utils/cookies'
import { resolveTrackingContentId } from '../../utils/tracking'
import { buildCashOnDeliveryWhatsAppMessage, buildWhatsAppUrl } from '../../utils/whatsapp'
import { BOLIVIAN_CITIES, matchBolivianCity } from './cities'
import { SmartPhoneInput } from '../ui/SmartPhoneInput'

const PRE_ORDER_ENDPOINT = DRENVEX_PRE_ORDER_ENDPOINT

const JAKAWI_WHATSAPP_NUMBER = (
  import.meta.env.VITE_JAKAWI_WHATSAPP_NUMBER?.trim() || '59100000000'
).replace(/[^0-9]/g, '')
const SHORT_MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'] as const
const PREFERRED_PAYMENT_STORAGE_KEY = 'jakawi_preferred_payment'

type CheckoutStep = 1 | 2

type CheckoutFormData = {
  name: string
  phone: string
  city: string
  address: string
}

type CheckoutOrderData = {
  order_id: number
  magic_token: string
}

type CheckoutProduct = {
  id: number
  price: number | string
  name?: string
  sku?: string
}

type VipRedirectContext = {
  orderId: number
  cartTotal: number
  productId: number | null
  productName: string
  productImage: string
  quantity: number
  customerName: string
  phone: string
  address: string
  city: string
  sku: string
}

type VipIntentTrackingPayload = {
  content_id: string
  content_name: string
  content_type: 'product'
  currency: string
  value: number
}

type CheckoutTrackingData = {
  tt_pixel_id?: string
  tt_test_code?: string
  fb_pixel_id?: string
  fb_fbp?: string
  fb_fbc?: string
  fb_test_code?: string
  tt_client_user_agent?: string
}

type CheckoutDrawerProps = {
  isOpen: boolean
  onClose: () => void
  product: CheckoutProduct
  vexerPixelMeta?: string | null
  vexerPixelTiktok?: string | null
  vexerGoogleAnalyticsId?: string | null
  vexerGtmId?: string | null
  heroImage?: string
  quantity?: number
  basePrice?: number
  currentQty?: number
  onBundleChange?: (qty: number, price: number) => void
  vexerDomain: string
  companyWhatsapp?: string
  qrVault?: Record<string, string>
  bovedaActiva?: BovedaActiva | null
  selectedOffer?: BovedaOferta | null
  isExitOfferMode?: boolean
  ofertaSalida?: BovedaOferta | null
}

type PreOrderApiPayload = {
  success?: boolean
  order_id?: number | string
  magic_token?: string
  vip_token?: string
  error?: string
  message?: string
}

function toNumberPrice(value: number | string): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function toPriceKey(value: number | string): string {
  const parsed = toNumberPrice(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ''
  }
  const fixed = parsed.toFixed(2)
  return fixed.replace(/\.?0+$/, '')
}

function normalizeCdnMediaUrl(value: string): string {
  const raw = value.trim()
  if (!raw) {
    return ''
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw
  }

  const normalized = raw.replace(/^\/+/, '')
  if (normalized.startsWith('media/')) {
    return `https://cdn.jakawi.store/${normalized}`
  }

  return `https://cdn.jakawi.store/media/${normalized}`
}

function resolveOfferQrUrl(offer?: BovedaOferta | null): string {
  if (!offer) {
    return ''
  }

  const qrUrl = typeof offer.qr_url === 'string' ? offer.qr_url.trim() : ''
  if (qrUrl) {
    return normalizeCdnMediaUrl(qrUrl)
  }

  const rawImageKey = (offer as BovedaOferta & { image_key?: unknown }).image_key
  if (typeof rawImageKey === 'string' && rawImageKey.trim() !== '') {
    return normalizeCdnMediaUrl(rawImageKey)
  }

  return ''
}

function formatBundlePrice(value: number | string): string {
  const parsed = toNumberPrice(value)
  if (Number.isFinite(parsed) && parsed > 0) {
    return `Bs ${Math.round(parsed)}`
  }

  const fallback = String(value ?? '').trim()
  return fallback || 'Bs 0'
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-gray-400">
      <path
        d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5Z"
        fill="currentColor"
      />
    </svg>
  )
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 text-gray-400">
      <path
        d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Zm0-9a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"
        fill="currentColor"
      />
    </svg>
  )
}

function ShoppingBagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M7 8V7a5 5 0 1 1 10 0v1h2a1 1 0 0 1 1 1l-1 10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 9a1 1 0 0 1 1-1h2Zm2 0h6V7a3 3 0 1 0-6 0v1Z"
        fill="currentColor"
      />
    </svg>
  )
}

function TruckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M3 6a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v7h1.4a2 2 0 0 1 1.6.8l1.4 1.8H20a1 1 0 0 1 1 1v1h-1a2.5 2.5 0 1 1-5 0H9a2.5 2.5 0 1 1-5 0H3V6Zm13 2v5h2.5l-1.2-1.5a1 1 0 0 0-.8-.5H16Z"
        fill="currentColor"
      />
    </svg>
  )
}

function HomeCheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M12 4.2 4 10v9a1 1 0 0 0 1 1h5v-5h4v5h5a1 1 0 0 0 1-1v-9l-8-5.8Zm4.3 7.1-4.8 4.8-2.1-2.1 1.4-1.4 0.7 0.7 3.4-3.4 1.4 1.4Z"
        fill="currentColor"
      />
    </svg>
  )
}

function formatShortDate(date: Date): string {
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`
}

async function parseApiPayload(response: Response): Promise<PreOrderApiPayload> {
  const text = await response.text()
  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text) as PreOrderApiPayload
  } catch {
    return {}
  }
}

function getApiError(payload: PreOrderApiPayload, status: number): string {
  if (typeof payload.error === 'string' && payload.error.trim() !== '') {
    return payload.error
  }
  if (typeof payload.message === 'string' && payload.message.trim() !== '') {
    return payload.message
  }
  return `No se pudo reservar el pedido (HTTP ${status}).`
}

export function CheckoutDrawer({
  isOpen,
  onClose,
  product,
  vexerPixelMeta = null,
  vexerPixelTiktok = null,
  vexerGoogleAnalyticsId = null,
  vexerGtmId = null,
  heroImage,
  quantity = 1,
  basePrice,
  currentQty,
  onBundleChange,
  vexerDomain,
  companyWhatsapp,
  qrVault,
  bovedaActiva,
  selectedOffer,
  isExitOfferMode = false,
  ofertaSalida = null,
}: CheckoutDrawerProps) {
  const [step, setStep] = useState<CheckoutStep>(1)
  const [formData, setFormData] = useState<CheckoutFormData>({
    name: '',
    phone: '',
    city: '',
    address: '',
  })
  const [loading, setLoading] = useState(false)
  const [orderData, setOrderData] = useState<CheckoutOrderData | null>(null)
  const [showCodWarning, setShowCodWarning] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'vip'>('cod')
  const [submitError, setSubmitError] = useState('')
  const { visitorData } = useVisitor()
  const { track } = useMetaPixel(vexerPixelMeta)
  const { track: trackTikTok, isReady: isTikTokReady } = useTikTokPixel(vexerPixelTiktok)
  const { track: trackGoogle, isReady: isGoogleReady } = useGoogleTags(vexerGoogleAnalyticsId, vexerGtmId)

  const safeQuantity = useMemo(() => {
    return Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1
  }, [quantity])
  const canShare = typeof navigator !== 'undefined' && typeof (navigator as Navigator & { share?: unknown }).share === 'function'
  const safeBasePrice = typeof basePrice === 'number' && Number.isFinite(basePrice) ? basePrice : 0
  const customPrice = useMemo(() => toNumberPrice(product.price), [product.price])
  const skuText = product.sku?.trim() || ''
  const trackingContentId = useMemo(() => {
    return resolveTrackingContentId(product.sku, product.id)
  }, [product.id, product.sku])
  const checkoutTotalLabel = useMemo(() => {
    return formatBundlePrice(customPrice > 0 ? customPrice : product.price)
  }, [customPrice, product.price])
  const deliveryTimeline = useMemo(() => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date(today)
    dayAfter.setDate(dayAfter.getDate() + 2)

    return {
      orderDate: formatShortDate(today),
      shipDate: formatShortDate(today),
      deliveryRange: `${formatShortDate(tomorrow)} - ${formatShortDate(dayAfter)}`,
    }
  }, [])
  const availableBovedaOffers = useMemo(() => {
    if (isExitOfferMode && ofertaSalida) {
      return [ofertaSalida]
    }

    const rawOffers = Array.isArray(bovedaActiva?.ofertas) ? bovedaActiva.ofertas : []
    return rawOffers.filter((offer) => {
      return Boolean(offer) && offer.cantidad > 0 && offer.combo_key !== 'salida' && offer.activo !== false
    })
  }, [bovedaActiva, isExitOfferMode, ofertaSalida])
  const defaultSelectedOffer = useMemo(() => {
    if (availableBovedaOffers.length === 0) {
      return null
    }

    if (selectedOffer) {
      const selectedKey = toPriceKey(selectedOffer.precio_venta)
      const matchedSelected = availableBovedaOffers.find((offer) => {
        return offer.cantidad === selectedOffer.cantidad && toPriceKey(offer.precio_venta) === selectedKey
      })

      if (matchedSelected) {
        return matchedSelected
      }
    }

    const matchedByPrice = availableBovedaOffers.find((offer) => toPriceKey(offer.precio_venta) === toPriceKey(customPrice))
    return matchedByPrice ?? availableBovedaOffers[0]
  }, [availableBovedaOffers, customPrice, selectedOffer])
  const [drawerSelectedOffer, setDrawerSelectedOffer] = useState<BovedaOferta | null>(defaultSelectedOffer)
  const activeQR = useMemo(() => {
    const selectedOfferUrl = resolveOfferQrUrl(drawerSelectedOffer)
    if (selectedOfferUrl) {
      return selectedOfferUrl
    }

    const priceCandidates = [customPrice.toString(), toPriceKey(customPrice)].filter((key) => key !== '')
    if (qrVault) {
      for (const candidateKey of priceCandidates) {
        if (qrVault[candidateKey]) {
          return normalizeCdnMediaUrl(qrVault[candidateKey])
        }
      }
    }

    if (bovedaActiva && Array.isArray(bovedaActiva.ofertas)) {
      const fromBoveda = bovedaActiva.ofertas.find((oferta) => toPriceKey(oferta.precio_venta) === toPriceKey(customPrice))
      const bovedaUrl = resolveOfferQrUrl(fromBoveda)
      if (bovedaUrl) {
        return bovedaUrl
      }
    }

    return null
  }, [customPrice, qrVault, bovedaActiva, drawerSelectedOffer])

  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setFormData({
        name: '',
        phone: '',
        city: '',
        address: '',
      })
      setLoading(false)
      setOrderData(null)
      setShowCodWarning(false)
      setPaymentMethod('cod')
      setSubmitError('')
      setDrawerSelectedOffer(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setDrawerSelectedOffer(defaultSelectedOffer)
  }, [defaultSelectedOffer, isOpen])

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') {
      return
    }

    const savedMethod = window.sessionStorage.getItem(PREFERRED_PAYMENT_STORAGE_KEY)
    if (savedMethod === 'cod' || savedMethod === 'vip') {
      setPaymentMethod(savedMethod)
      setShowCodWarning(false)
      window.sessionStorage.removeItem(PREFERRED_PAYMENT_STORAGE_KEY)
    }
  }, [isOpen])

  useEffect(() => {
    if (visitorData?.city && !formData.city) {
      const matchedCity = matchBolivianCity(visitorData.city)

      if (matchedCity) {
        setFormData((prev) => ({ ...prev, city: matchedCity }))
      }
    }
  }, [visitorData?.city, formData.city])

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSelectVaultOffer = (offer: BovedaOferta) => {
    setDrawerSelectedOffer(offer)

    if (!onBundleChange) {
      return
    }

    const nextQuantity = Number.isFinite(offer.cantidad) && offer.cantidad > 0 ? Math.floor(offer.cantidad) : 1
    const nextPrice = toNumberPrice(offer.precio_venta)
    onBundleChange(nextQuantity, nextPrice)
  }

  const trackVipPaymentIntent = (payload: VipIntentTrackingPayload) => {
    if (typeof window === 'undefined') {
      return
    }

    if (window.ttq && typeof window.ttq.track === 'function') {
      window.ttq.track('Initiate_VIP_Payment', payload)
    }

    if (typeof window.fbq === 'function') {
      window.fbq('trackCustom', 'Initiate_VIP_Payment', payload)
    }
  }

  const handlePreOrderSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (loading) {
      return
    }

    setLoading(true)
    setSubmitError('')

    try {
      if (paymentMethod === 'vip') {
        const vipIntentPayload: VipIntentTrackingPayload = {
          content_id: trackingContentId,
          content_name: product.name || 'Tu producto',
          content_type: 'product',
          currency: 'BOB',
          value: customPrice > 0 ? customPrice : 0,
        }

        trackVipPaymentIntent(vipIntentPayload)
        console.log('VIP intent captured at checkout button', vipIntentPayload)
        await new Promise((resolve) => {
          window.setTimeout(resolve, 400)
        })
      }

      const trackingData: CheckoutTrackingData = {
        tt_pixel_id: vexerPixelTiktok?.trim() || undefined,
        tt_test_code:
          import.meta.env.VITE_DRENVEX_TIKTOK_TEST_CODE?.trim() ||
          import.meta.env.VITE_JAKAWI_TIKTOK_TEST_CODE?.trim() ||
          undefined,
        fb_pixel_id: vexerPixelMeta?.trim() || import.meta.env.VITE_JAKAWI_PIXEL_META?.trim() || undefined,
        fb_fbp: getCookie('_fbp') || undefined,
        fb_fbc: getCookie('_fbc') || undefined,
        fb_test_code:
          import.meta.env.VITE_DRENVEX_META_TEST_CODE?.trim() ||
          import.meta.env.VITE_JAKAWI_META_TEST_CODE?.trim() ||
          undefined,
        tt_client_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      }

      console.log('🚀 Intentando POST a:', PRE_ORDER_ENDPOINT)
      const response = await fetch(PRE_ORDER_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-DX-API-KEY': import.meta.env.VITE_DRENVEX_API_KEY?.trim() || '',
          'X-Drenvex-Api-Key': import.meta.env.VITE_DRENVEX_API_KEY?.trim() || '',
        },
        body: JSON.stringify({
          product_id: product.id,
          name: formData.name.trim(),
          phone: formData.phone,
          city: formData.city.trim(),
          address: formData.address.trim(),
          vexer_domain: vexerDomain,
          custom_price: customPrice,
          quantity: safeQuantity,
          tracking_data: trackingData,
          pixel_id: trackingData.fb_pixel_id || trackingData.tt_pixel_id,
          test_event_code: trackingData.fb_test_code || trackingData.tt_test_code,
          fbp: trackingData.fb_fbp,
          fbc: trackingData.fb_fbc,
          tt_pixel_id: trackingData.tt_pixel_id,
          tt_test_code: trackingData.tt_test_code,
          fb_pixel_id: trackingData.fb_pixel_id,
          fb_fbp: trackingData.fb_fbp,
          fb_fbc: trackingData.fb_fbc,
          fb_test_code: trackingData.fb_test_code,
          tt_client_user_agent: trackingData.tt_client_user_agent,
        }),
      })

      const payload = await parseApiPayload(response)
      if (!response.ok) {
        throw new Error(getApiError(payload, response.status))
      }

      if (!payload.success) {
        throw new Error(getApiError(payload, response.status))
      }

      const orderId = Number(payload.order_id)
      const magicToken = typeof payload.magic_token === 'string' ? payload.magic_token : ''
      const nextVipToken = typeof payload.vip_token === 'string' && payload.vip_token.trim() !== '' ? payload.vip_token.trim() : null

      if (!Number.isFinite(orderId) || orderId <= 0 || magicToken === '') {
        throw new Error('La respuesta del servidor no incluyo order_id/magic_token validos.')
      }

      setOrderData({
        order_id: orderId,
        magic_token: magicToken,
      })

      const purchaseValue = customPrice > 0 ? customPrice : 0
      const purchaseParams = {
        event_id: `order_${orderId}`,
        content_name: product.name || '',
        content_ids: [product.id.toString()],
        contents: [
          {
            id: product.id.toString(),
            quantity: safeQuantity,
          },
        ],
        currency: 'BOB' as Uppercase<string>,
        value: purchaseValue,
      }
      void track('Purchase', purchaseParams)

      if (isTikTokReady) {
        trackTikTok('CompletePayment', {
          contents: [
            {
              content_id: trackingContentId,
              content_type: 'product',
              content_name: product.name || '',
              quantity: safeQuantity,
              price: purchaseValue,
            },
          ],
          content_type: 'product',
          value: purchaseValue,
          currency: 'BOB' as Uppercase<string>,
        })
      }

      if (isGoogleReady) {
        trackGoogle('purchase', {
          transaction_id: orderId.toString(),
          currency: 'BOB',
          value: purchaseValue,
          items: [
            {
              item_id: product.id.toString(),
              item_name: product.name || '',
              price: purchaseValue,
              quantity: safeQuantity,
            },
          ],
        })
      }

      if (nextVipToken && (paymentMethod === 'vip' || paymentMethod === 'cod')) {
        const normalizedCustomerName = formData.name.trim()
        const normalizedPhone = formData.phone.trim()
        const normalizedAddressLine = formData.address.trim()
        const normalizedCity = formData.city.trim()
        const normalizedAddress = [normalizedAddressLine, normalizedCity].filter((value) => value !== '').join(', ')
        const normalizedProductId = Number.isFinite(product.id) && product.id > 0 ? Math.floor(product.id) : null
        const normalizedSku = product.sku?.trim() || ''

        const vipContext: VipRedirectContext = {
          orderId,
          cartTotal: purchaseValue,
          productId: normalizedProductId,
          productName: product.name || 'Tu Artículo',
          productImage: heroImage || '',
          quantity: safeQuantity,
          customerName: normalizedCustomerName || 'Cliente',
          phone: normalizedPhone,
          address: normalizedAddress || 'Dirección registrada',
          city: normalizedCity,
          sku: normalizedSku,
        }

        try {
          localStorage.setItem(`jakawi_vip_data_${nextVipToken}`, JSON.stringify(vipContext))
        } catch (storageError) {
          console.warn('No se pudo guardar el contexto VIP en localStorage:', storageError)
        }

        onClose()
        const targetPath =
          paymentMethod === 'vip'
            ? `/secure-qr/${encodeURIComponent(nextVipToken)}`
            : `/secure-checkout/${encodeURIComponent(nextVipToken)}`
        window.location.assign(targetPath)
        return
      }

      setStep(2)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo generar tu pre-pedido.'
      setSubmitError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleWhatsAppQR = () => {
    if (!orderData?.order_id) {
      console.warn('No hay ID de pedido disponible para el WhatsApp')
    }

    // Limpiamos el número de la empresa. Si viene vacío desde WP, usamos un fallback de emergencia boliviano.
    const targetNumber =
      companyWhatsapp && companyWhatsapp.trim() !== ''
        ? companyWhatsapp.replace(/\D/g, '')
        : '59179790873' // Fallback real al Arquitecto del sistema.

    const text = `¡Hola Jakawi! Acabo de realizar el pago de mi pedido *#${orderData?.order_id || ''}*.\n\nAdjunto mi comprobante para activar mis beneficios VIP 🚀.`
    const url = `https://wa.me/${targetNumber}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const handleWhatsAppCOD = () => {
    if (!orderData) {
      return
    }

    const message = buildCashOnDeliveryWhatsAppMessage({
      customerName: formData.name,
      orderId: orderData.order_id,
      quantity: safeQuantity,
      productName: product.name || 'Tu producto',
      total: customPrice,
      address: formData.address,
      city: formData.city,
    })
    const url = buildWhatsAppUrl(JAKAWI_WHATSAPP_NUMBER, message)
    window.open(url, '_blank', 'noopener,noreferrer')
    setShowCodWarning(false)
    onClose()
  }

  const handleDownloadQR = async () => {
    if (!activeQR) return
    try {
      // Usamos fetch para obtener la imagen como blob y forzar descarga
      const response = await fetch(activeQR)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `QR-Pedido-${orderData?.order_id || 'Jakawi'}.jpg`
      document.body.appendChild(a)
      a.click()
      // Limpieza
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error al descargar QR:', error)
      // Fallback por si falla el fetch (abre en pestaña nueva para no perder el checkout)
      window.open(activeQR, '_blank')
    }
  }

  const handleShareQR = async () => {
    if (!activeQR || !canShare) return
    try {
      await navigator.share({
        title: `Pago Pedido #${orderData?.order_id}`,
        text: 'Aquí tienes el QR para completar tu pago.',
        url: activeQR,
      })
    } catch (error) {
      console.log('Error compartiendo:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex justify-end">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative flex h-full w-full max-w-md animate-slide-in-right flex-col bg-[var(--brand-cardBg)] text-[var(--brand-text)] shadow-2xl">
        <div
          className="flex items-center justify-between border-b px-3 py-2"
          style={{ borderColor: 'var(--brand-borderColor)' }}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold leading-none text-[var(--brand-text)]">Finaliza Tu Pedido</h2>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-bold leading-none text-[var(--brand-text)] opacity-70"
              style={{ backgroundColor: 'var(--brand-bg)' }}
            >
              Paso {step} de 2
            </span>
          </div>
          <button onClick={onClose} className="p-1 text-[var(--brand-text)] opacity-70 transition-opacity hover:opacity-100" type="button">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-visible px-3 py-2">
          {step === 1 && (availableBovedaOffers.length > 0 || (safeBasePrice > 0 && onBundleChange)) ? (
            <div className="-mx-3 -mt-2 mb-3 border-b border-gray-200 bg-slate-50 px-3 py-2.5">
              {product.name && heroImage ? (
                <div className="mb-2 flex items-center gap-2.5">
                  <img
                    src={heroImage}
                    alt={product.name}
                    className="h-7 w-7 rounded object-cover"
                  />
                  <div className="min-w-0">
                    <span className="line-clamp-1 text-xs font-bold text-[var(--brand-text)]">{product.name}</span>
                    {skuText ? <div className="mt-0.5 text-xs font-mono tracking-wider text-slate-400">SKU: {skuText}</div> : null}
                  </div>
                </div>
              ) : null}
              {availableBovedaOffers.length > 0 ? (
                <div
                  role="radiogroup"
                  aria-label={isExitOfferMode ? 'Oferta desbloqueada' : 'Selecciona tu pack'}
                  className="mb-3 grid grid-cols-3 gap-2"
                >
                  {availableBovedaOffers.map((offer, index) => {
                    const offerPriceKey = toPriceKey(offer.precio_venta)
                    const offerSalePrice = toNumberPrice(offer.precio_venta)
                    const offerComparePrice = toNumberPrice(offer.precio_tachado ?? '')
                    const offerHasCompare = offerComparePrice > offerSalePrice
                    const offerSavings = offerHasCompare ? Math.max(0, Math.round(offerComparePrice - offerSalePrice)) : 0
                    const quantityLabel = `${offer.cantidad} UNIDAD${offer.cantidad > 1 ? 'ES' : ''}`
                    const isSelected =
                      Boolean(drawerSelectedOffer) &&
                      drawerSelectedOffer?.cantidad === offer.cantidad &&
                      toPriceKey(drawerSelectedOffer?.precio_venta ?? '') === offerPriceKey

                    return (
                      <button
                        key={`${offer.cantidad}-${offerPriceKey || index}`}
                        type="button"
                        onClick={() => handleSelectVaultOffer(offer)}
                        role="radio"
                        aria-checked={isSelected}
                        className={`relative cursor-pointer rounded-lg border p-2 text-center transition-colors duration-200 ${
                          isSelected
                            ? 'border-2 border-[#ffab23] bg-orange-50/40 text-gray-900 shadow-sm'
                            : 'border border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {isSelected ? (
                          <span className="absolute -right-1 -top-1 rounded-full bg-[#ffab23] p-0.5 text-[8px] font-bold leading-none text-white shadow-sm">
                            ✓
                          </span>
                        ) : null}
                        <span className="line-clamp-1 text-xs font-black uppercase leading-tight text-gray-800">
                          {quantityLabel}
                        </span>
                        <span className="mt-0.5 block text-sm font-black leading-none text-gray-900 md:text-base">
                          {formatBundlePrice(offer.precio_venta)}
                        </span>
                        {offerSavings > 0 ? (
                          <span className="mt-1 inline-block rounded-sm bg-green-100 px-1.5 py-0.5 text-[8px] font-bold leading-none text-green-700">
                            AHORRAS BS {offerSavings.toLocaleString('es-BO')}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div role="radiogroup" aria-label="Selecciona tu pack" className="mb-3 grid grid-cols-3 gap-2">
                  {[
                    { q: 1, dto: 0, label: '' },
                    { q: 2, dto: 0.1, label: '-10%' },
                    { q: 3, dto: 0.15, label: '-15%' },
                  ].map((bundle) => {
                    const regularTotal = Math.round(safeBasePrice * bundle.q)
                    const bundleTotal = Math.round(safeBasePrice * bundle.q * (1 - bundle.dto))
                    const isSelected = currentQty === bundle.q
                    const quantityLabel = `${bundle.q} UNIDAD${bundle.q > 1 ? 'ES' : ''}`
                    return (
                      <button
                        key={bundle.q}
                        type="button"
                        onClick={() => onBundleChange?.(bundle.q, bundleTotal)}
                        role="radio"
                        aria-checked={isSelected}
                        className={`relative cursor-pointer rounded-lg border p-2 text-center transition-colors duration-200 ${
                          isSelected
                            ? 'border-2 border-[#ffab23] bg-orange-50/40 text-gray-900 shadow-sm'
                            : 'border border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {isSelected ? (
                          <span className="absolute -right-1 -top-1 rounded-full bg-[#ffab23] p-0.5 text-[8px] font-bold leading-none text-white shadow-sm">
                            ✓
                          </span>
                        ) : null}
                        <span className="line-clamp-1 text-xs font-black uppercase leading-tight text-gray-800">
                          {quantityLabel}
                        </span>
                        <span className="mt-0.5 block text-sm font-black leading-none text-gray-900 md:text-base">Bs {bundleTotal}</span>
                        {bundle.dto > 0 ? (
                          <span className="mt-1 inline-block rounded-sm bg-green-100 px-1.5 py-0.5 text-[8px] font-bold leading-none text-green-700">
                            AHORRAS BS {(regularTotal - bundleTotal).toLocaleString('es-BO')}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : null}

          {step === 1 ? (
            <form onSubmit={handlePreOrderSubmit} className="overflow-visible">
              <div className="mb-3">
                <label className="mb-1 block text-xs font-semibold text-gray-600">Nombre completo</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
                    <UserIcon />
                  </span>
                  <input
                    name="name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={handleInputChange}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pl-9 text-sm text-gray-900 transition-colors focus:border-[#ffab23] focus:outline-none focus:ring-2 focus:ring-[#ffab23]/15"
                    placeholder="Ej: Maria Gomez"
                  />
                </div>
              </div>

              <div className="relative mb-3 overflow-visible">
                <label className="mb-1 block text-xs font-semibold text-gray-600">Telefono</label>
                <div
                  className="relative [&_.PhoneInput]:rounded-lg [&_.PhoneInput]:border-gray-200 [&_.PhoneInput]:bg-white [&_.PhoneInputCountry]:h-10 [&_.PhoneInputCountry]:min-w-[120px] [&_.PhoneInputCountry]:border-gray-200 [&_.PhoneInputCountry]:bg-white [&_.PhoneInputCountry]:px-2.5 [&_.PhoneInputInput]:h-10 [&_.PhoneInputInput]:text-sm [&_.PhoneInputInput]:text-gray-900 [&_.PhoneInput:focus-within]:border-[#ffab23] [&_.PhoneInput:focus-within]:ring-2 [&_.PhoneInput:focus-within]:ring-[#ffab23]/15"
                  style={
                    {
                      '--brand-primary': '#ffab23',
                      '--brand-borderColor': '#e5e7eb',
                      '--brand-cardBg': '#ffffff',
                      '--brand-text': '#111827',
                    } as CSSProperties
                  }
                >
                  <SmartPhoneInput
                    required
                    value={formData.phone}
                    onChange={(val) => setFormData({ ...formData, phone: val })}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="relative mb-3 overflow-visible">
                <label className="mb-1 block text-xs font-semibold text-gray-600">Ciudad</label>
                <div className="space-y-3">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
                      <MapPinIcon />
                    </span>
                    <select
                      required
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pl-9 text-sm text-gray-900 transition-colors focus:border-[#ffab23] focus:outline-none focus:ring-2 focus:ring-[#ffab23]/15"
                      value={BOLIVIAN_CITIES.includes(formData.city) ? formData.city : formData.city ? 'Otra...' : ''}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    >
                      <option value="" disabled>
                        Selecciona tu ciudad...
                      </option>
                      {BOLIVIAN_CITIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(!BOLIVIAN_CITIES.includes(formData.city) && formData.city !== '') || formData.city === 'Otra...' ? (
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
                        <MapPinIcon />
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="Escribe el nombre de tu ciudad/provincia..."
                        className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 pl-9 text-sm text-gray-900 transition-colors focus:border-[#ffab23] focus:outline-none focus:ring-2 focus:ring-[#ffab23]/15"
                        value={formData.city === 'Otra...' ? '' : BOLIVIAN_CITIES.includes(formData.city) ? '' : formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-xs font-semibold text-gray-600">Direccion de entrega</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-2.5 top-2.5">
                    <MapPinIcon />
                  </span>
                  <textarea
                    name="address"
                    required
                    value={formData.address}
                    onChange={handleInputChange}
                    rows={1}
                    className="h-10 w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 pl-9 text-sm leading-tight text-gray-900 transition-colors focus:border-[#ffab23] focus:outline-none focus:ring-2 focus:ring-[#ffab23]/15"
                    placeholder="Barrio, calle, ciudad y referencias"
                  />
                </div>
              </div>

              <div className="mb-3 mt-3 flex overflow-visible rounded-lg bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('cod')
                    setShowCodWarning(false)
                  }}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-bold transition-all duration-200 ${
                    paymentMethod === 'cod'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'bg-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span aria-hidden="true">{paymentMethod === 'cod' ? '✓' : '📦'}</span>
                  Pago al Recibir
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod('vip')
                    setShowCodWarning(false)
                  }}
                  className={`relative flex flex-1 items-center justify-center gap-2 overflow-visible rounded-md py-2.5 text-sm font-bold transition-all duration-200 ${
                    paymentMethod === 'vip'
                      ? 'bg-gray-900 text-[#ffab23] shadow-md ring-1 ring-gray-900'
                      : 'bg-transparent text-orange-700/80 hover:text-orange-800'
                  }`}
                >
                  <span className="absolute -right-2 -top-3 z-10 rounded-full border border-white bg-gradient-to-r from-red-500 to-[#ffab23] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-md animate-pulse">
                    🔥 RECOMENDADO
                  </span>
                  <span aria-hidden="true">{paymentMethod === 'vip' ? '✓' : '⚡'}</span>
                  Pago VIP (QR)
                </button>
              </div>

              <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-2 px-2.5 text-xs leading-tight text-gray-700">
                {paymentMethod === 'cod' ? (
                  <p>
                    📞 Confirmamos por WhatsApp. <strong>Pagas al recibir tu producto.</strong>
                  </p>
                ) : (
                  <p>
                    🚀 Fila rápida con código QR. <strong>Ganas puntos VIP.</strong>
                  </p>
                )}
              </div>

              <div className="relative z-10 mt-3 rounded-xl bg-white px-1.5 pb-1 pt-3">
                <div className="absolute left-7 right-7 top-3 -z-10 h-[2px] bg-gray-200"></div>

                <div className="flex items-start justify-between">
                  <div className="relative z-10 flex flex-col items-center bg-white px-1 text-center">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-gray-400">
                      <ShoppingBagIcon />
                    </div>
                    <span className="mt-0.5 text-[10px] font-bold leading-none text-gray-800">{deliveryTimeline.orderDate}</span>
                    <span className="text-[9px] text-gray-500">Pides hoy</span>
                  </div>

                  <div className="relative z-10 flex flex-col items-center bg-white px-1 text-center">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-gray-400">
                      <TruckIcon />
                    </div>
                    <span className="mt-0.5 text-[10px] font-bold leading-none text-gray-800">{deliveryTimeline.shipDate}</span>
                    <span className="text-[9px] text-gray-500">Lo enviamos</span>
                  </div>

                  <div className="relative z-10 flex flex-col items-center bg-white px-1 text-center">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-green-600">
                      <HomeCheckIcon />
                    </div>
                    <span className="mt-0.5 text-[10px] font-bold leading-none text-gray-800">{deliveryTimeline.deliveryRange}</span>
                    <span className="text-[9px] font-medium text-gray-600">Lo recibes</span>
                  </div>
                </div>
              </div>

              {submitError ? (
                <p className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{submitError}</p>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className={`mt-3 flex min-h-12 w-full items-center justify-center rounded-xl px-3 py-3 transition-all duration-200 hover:opacity-95 disabled:opacity-80 ${
                  paymentMethod === 'cod'
                    ? 'bg-gradient-to-r from-[#ffec64] to-[#ffab23] text-black shadow-lg'
                    : 'border border-[#ffab23]/50 bg-gray-900 text-[#ffab23] shadow-[0_0_15px_rgba(255,171,35,0.2)]'
                }`}
              >
                {loading ? (
                  <>
                    <svg
                      className="mr-2 h-4 w-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm font-black uppercase">Preparando</span>
                  </>
                ) : (
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap text-center text-sm font-black uppercase">
                    {paymentMethod === 'cod' ? `Confirmar • ${checkoutTotalLabel}` : `Seguir al QR • ${checkoutTotalLabel}`}
                  </span>
                )}
              </button>
            </form>
          ) : null}

          {step === 2 && orderData ? (
            <section>
              <div
                className="rounded-2xl border p-4"
                style={{
                  borderColor: 'var(--brand-accent)',
                  backgroundColor: 'var(--brand-bg)',
                }}
              >
                <p className="text-sm font-bold" style={{ color: 'var(--brand-primary)' }}>
                  Pedido Realizado : #{orderData.order_id}
                </p>
                {product.name ? (
                  <div className="mt-1">
                    <p className="line-clamp-2 text-sm font-semibold text-[var(--brand-text)]">{product.name}</p>
                    {skuText ? <div className="mt-0.5 text-xs font-mono tracking-wider text-slate-400">SKU: {skuText}</div> : null}
                  </div>
                ) : null}
                <p className="mt-2 text-sm font-bold text-[var(--brand-text)]">
                  Cantidad: {safeQuantity} unidad{safeQuantity > 1 ? 'es' : ''} • Total {checkoutTotalLabel}
                </p>
                <div
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg p-2.5 text-xs font-bold tracking-wide shadow-md"
                  style={{
                    backgroundColor: paymentMethod === 'vip' ? 'var(--brand-text)' : 'var(--brand-cardBg)',
                    color: paymentMethod === 'vip' ? 'var(--brand-cardBg)' : 'var(--brand-text)',
                  }}
                >
                  <span>{paymentMethod === 'vip' ? '🚀' : '📦'}</span>
                  {paymentMethod === 'vip' ? 'Beneficio Activo: Envío VIP + Puntos Jakawi' : 'Pago al recibir seleccionado para tu entrega'}
                </div>
              </div>

              {paymentMethod === 'vip' ? (
                <>
                  <div
                    className="mt-4 flex min-h-[24rem] flex-col rounded-2xl border p-4 text-center"
                    style={{
                      borderColor: 'var(--brand-borderColor)',
                      backgroundColor: 'var(--brand-bg)',
                    }}
                  >
                    <div
                      className="relative flex flex-1 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed p-2"
                      style={{
                        borderColor: 'var(--brand-borderColor)',
                        backgroundColor: 'var(--brand-cardBg)',
                      }}
                    >
                      {activeQR ? (
                        <img src={activeQR} alt={`QR para pago de ${customPrice}`} className="h-full w-full object-contain" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-[var(--brand-text)] opacity-60">
                          <span className="text-sm">QR no configurado para este precio.</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex w-full justify-center gap-6 border-t pt-4" style={{ borderColor: 'var(--brand-borderColor)' }}>
                      <button
                        type="button"
                        onClick={handleDownloadQR}
                        className="flex items-center gap-2 text-sm font-medium text-[var(--brand-text)] opacity-70 transition-opacity hover:opacity-100"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                        </svg>
                        Descargar QR
                      </button>
                      {canShare ? (
                        <button
                          type="button"
                          onClick={handleShareQR}
                          className="flex items-center gap-2 text-sm font-medium text-[var(--brand-text)] opacity-70 transition-opacity hover:opacity-100"
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                            ></path>
                          </svg>
                          Compartir
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div
                    className="sticky bottom-0 -mx-4 -mb-4 mt-4 border-t px-4 pb-4 pt-3 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)]"
                    style={{
                      borderColor: 'var(--brand-borderColor)',
                      backgroundColor: 'var(--brand-cardBg)',
                    }}
                  >
                    <p className="mb-3 text-center text-xs font-medium text-[var(--brand-text)] opacity-70">
                      Escanea el QR y envía tu comprobante para conservar tus beneficios.
                    </p>
                    <button
                      type="button"
                      onClick={handleWhatsAppQR}
                      className="w-full rounded-xl px-6 py-3.5 text-center text-[15px] font-black text-white shadow-lg transition hover:opacity-90"
                      style={{ backgroundColor: 'var(--brand-primary)' }}
                    >
                      Ya pagué, Enviar Comprobante
                    </button>
                  <div
                    className="mt-4 rounded-xl border p-4"
                    style={{
                      borderColor: 'var(--brand-accent)',
                      backgroundColor: 'var(--brand-bg)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowCodWarning(true)}
                      className="block w-full text-center text-sm font-medium text-[var(--brand-text)] opacity-70 underline transition-opacity hover:opacity-100"
                    >
                      Prefiero pagar al recibir
                    </button>

                    {showCodWarning ? (
                      <div className="mt-4">
                        <h3 className="text-sm font-black" style={{ color: 'var(--brand-accent)' }}>
                          ⚠️ ¿Seguro que quieres cambiar?
                        </h3>
                        <p className="mt-1 text-sm text-[var(--brand-text)] opacity-80">Perderás tus Puntos VIP y el envío prioritario de hoy.</p>
                        <div className="mt-4 grid gap-2">
                          <button
                            type="button"
                            onClick={handleWhatsAppCOD}
                            className="rounded-xl px-4 py-3 text-sm font-medium text-[var(--brand-text)] transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                            style={{ backgroundColor: 'var(--brand-bg)' }}
                          >
                            Cambiar a Contra Entrega
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowCodWarning(false)}
                            className="rounded-xl px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                            style={{ backgroundColor: 'var(--brand-primary)' }}
                          >
                            Mantener mis beneficios VIP
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                    <span className="text-2xl">📞</span>
                  </div>
                  <h3 className="text-lg font-black text-gray-900">Tu pedido quedó reservado</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-700">
                    Un asesor verificará tus datos y coordinará tu entrega. <strong>Pagas en efectivo al recibir en tu puerta.</strong>
                  </p>
                  <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-700">
                    Siguiente paso: confirma tu pedido por WhatsApp para acelerar la validación y asegurar tu despacho.
                  </div>
                  <button
                    type="button"
                    onClick={handleWhatsAppCOD}
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-[#ffec64] to-[#ffab23] px-6 py-3.5 text-center text-[15px] font-black text-black shadow-lg transition hover:opacity-95"
                  >
                    CONTINUAR POR WHATSAPP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('vip')
                      setStep(1)
                    }}
                    className="mt-3 w-full text-center text-sm font-medium text-gray-500 underline transition-opacity hover:opacity-80"
                  >
                    Prefiero pasar a Pago VIP con QR
                  </button>
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
