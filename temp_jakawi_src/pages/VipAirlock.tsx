import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGoogleTags, useMetaPixel, useTikTokPixel } from '../analytics'
import { readStoredPixelIds } from '../analytics/pixelStorage'
import { KurukinPlayer } from '../components/ui/kurukin-video-player/KurukinPlayer'
import { resolveTrackingContentId } from '../utils/tracking'
import { buildCashOnDeliveryWhatsAppMessage, buildWhatsAppUrl } from '../utils/whatsapp'

type VipVisualContext = {
  orderId: number | null
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

const DEFAULT_VIDEO_ID = 'AlYoOdA4qDg'

const DEFAULT_VIP_CONTEXT: VipVisualContext = {
  orderId: null,
  cartTotal: 150,
  productId: null,
  productName: 'Tu Artículo Especial',
  productImage: '',
  quantity: 1,
  customerName: '',
  phone: '',
  address: '',
  city: '',
  sku: '',
}

function sanitizeStoredImage(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  const cleaned = value.trim()
  if (!cleaned) {
    return ''
  }

  const lowered = cleaned.toLowerCase()
  if (lowered === 'null' || lowered === 'undefined' || lowered === 'false') {
    return ''
  }

  return cleaned
}

function extractYoutubeId(url: string): string | null {
  if (!url) return null
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim()

  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/
  const match = url.match(regExp)
  return match && match[2].length === 11 ? match[2] : null
}

function parseVipContext(token: string): VipVisualContext {
  if (!token) {
    return DEFAULT_VIP_CONTEXT
  }

  const storageKey = `jakawi_vip_data_${token}`

  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      return DEFAULT_VIP_CONTEXT
    }

    const parsed = JSON.parse(raw) as Partial<VipVisualContext>
    const maybeOrderId = Number(parsed.orderId)
    const maybeCartTotal = Number(parsed.cartTotal)
    const maybeProductId = Number(parsed.productId)
    const maybeQuantity = Number(parsed.quantity)

    return {
      orderId: Number.isFinite(maybeOrderId) && maybeOrderId > 0 ? Math.floor(maybeOrderId) : null,
      cartTotal: Number.isFinite(maybeCartTotal) && maybeCartTotal > 0 ? maybeCartTotal : DEFAULT_VIP_CONTEXT.cartTotal,
      productId: Number.isFinite(maybeProductId) && maybeProductId > 0 ? Math.floor(maybeProductId) : null,
      productName:
        typeof parsed.productName === 'string' && parsed.productName.trim() !== ''
          ? parsed.productName.trim()
          : DEFAULT_VIP_CONTEXT.productName,
      productImage: sanitizeStoredImage(parsed.productImage),
      quantity: Number.isFinite(maybeQuantity) && maybeQuantity > 0 ? Math.floor(maybeQuantity) : DEFAULT_VIP_CONTEXT.quantity,
      customerName: typeof parsed.customerName === 'string' ? parsed.customerName.trim() : '',
      phone: typeof parsed.phone === 'string' ? parsed.phone.trim() : '',
      address: typeof parsed.address === 'string' ? parsed.address.trim() : '',
      city: typeof parsed.city === 'string' ? parsed.city.trim() : '',
      sku: typeof parsed.sku === 'string' ? parsed.sku.trim() : '',
    }
  } catch (error) {
    console.error('Error leyendo VIP data', error)
    return DEFAULT_VIP_CONTEXT
  }
}

function getRemainingUrgencyTime(currentToken: string): number {
  if (!currentToken) {
    return 1800
  }

  const timerKey = `jakawi_timer_start_${currentToken}`
  const storedStartTime = localStorage.getItem(timerKey)

  if (!storedStartTime) {
    localStorage.setItem(timerKey, Date.now().toString())
    return 1800
  }

  const elapsedSeconds = Math.floor((Date.now() - parseInt(storedStartTime, 10)) / 1000)
  const remaining = 1800 - elapsedSeconds
  return remaining > 0 ? remaining : 0
}

type VipTrackingPayload = {
  content_id: string
  content_name: string
  currency: string
  value: number
}

type VipPaymentIntentPayload = {
  content_id: string
  content_name: string
  content_type: 'product'
  currency: string
  value: number
}

function trackVipAddPaymentInfo(payload: VipTrackingPayload): void {
  if (typeof window === 'undefined') {
    return
  }

  const ttq = window.ttq
  const fbq = window.fbq

  if (ttq && typeof ttq.track === 'function') {
    ttq.track('AddPaymentInfo', {
      contents: [payload],
      value: payload.value,
      currency: payload.currency,
    })
  }

  if (typeof fbq === 'function') {
    fbq('track', 'AddPaymentInfo', payload)
  }
}

function trackVipPaymentIntent(payload: VipPaymentIntentPayload): void {
  if (typeof window === 'undefined') {
    return
  }

  const ttq = window.ttq
  const fbq = window.fbq

  if (ttq && typeof ttq.track === 'function') {
    ttq.track('Initiate_VIP_Payment', payload)
  }

  if (typeof fbq === 'function') {
    fbq('trackCustom', 'Initiate_VIP_Payment', payload)
  }
}

export function VipAirlock() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const safeToken = typeof token === 'string' ? token.trim() : ''
  const savedPixels = useMemo(() => readStoredPixelIds(), [])

  useMetaPixel(savedPixels.meta)
  useTikTokPixel(savedPixels.tiktok)
  useGoogleTags(savedPixels.ga, savedPixels.gtm)

  const [vipData, setVipData] = useState<VipVisualContext>(() => parseVipContext(safeToken))
  const [urgencyTimer, setUrgencyTimer] = useState(() => getRemainingUrgencyTime(safeToken))
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [isProductImageBroken, setIsProductImageBroken] = useState(false)
  const [videoUrl, setVideoUrl] = useState('')
  const hasTrackedAddPaymentInfo = useRef(false)
  const vipRedirectTimeoutRef = useRef<number | null>(null)
  const isShortVideo = videoUrl?.includes('shorts/') || false
  const clubUrl = useMemo(() => {
    if (!safeToken) {
      return ''
    }

    return `https://jakawi.club/?token=${encodeURIComponent(safeToken)}`
  }, [safeToken])

  const minutes = Math.floor(Math.max(0, urgencyTimer) / 60)
    .toString()
    .padStart(2, '0')
  const seconds = (Math.max(0, urgencyTimer) % 60).toString().padStart(2, '0')

  const orderId = vipData.orderId ?? '--'
  const cartTotal = Math.floor(vipData.cartTotal || 150)
  const productName = vipData.productName || 'Tu Artículo Especial'
  const productImage = sanitizeStoredImage(vipData.productImage)
  const trackingContentId = resolveTrackingContentId(vipData.sku, vipData.productId ?? orderId)
  const skuText = vipData.sku.trim()
  const customerName = vipData.customerName.trim()
  const customerPhone = vipData.phone.trim()
  const customerAddress = vipData.address.trim()
  const customerCity = vipData.city.trim()
  const playerVideoId = useMemo(() => {
    const extractedId = extractYoutubeId(videoUrl)
    console.log('🎬 Extracción de YouTube ID:', { videoUrl, extractedId, fallback: DEFAULT_VIDEO_ID })
    return extractedId || DEFAULT_VIDEO_ID
  }, [videoUrl])
  const storePhone = (import.meta.env.VITE_JAKAWI_WHATSAPP_NUMBER || '59170000000').replace(/[^0-9]/g, '')

  const waMessage = buildCashOnDeliveryWhatsAppMessage({
    customerName,
    orderId,
    quantity: vipData.quantity,
    productName,
    total: cartTotal,
    address: customerAddress,
    city: customerCity,
  })

  const waLink = buildWhatsAppUrl(storePhone, waMessage)

  useEffect(() => {
    if (!safeToken) {
      navigate('/', { replace: true })
      return
    }

    hasTrackedAddPaymentInfo.current = false
    setUrgencyTimer(getRemainingUrgencyTime(safeToken))
    setIsRedirecting(false)
    setVipData(parseVipContext(safeToken))
  }, [safeToken, navigate])

  useEffect(() => {
    if (hasTrackedAddPaymentInfo.current) {
      return
    }

    if (!safeToken || vipData.orderId === null) {
      return
    }

    const payload: VipTrackingPayload = {
      content_id: trackingContentId,
      content_name: productName || 'Upsell VIP',
      currency: 'BOB',
      value: Number(vipData.cartTotal || 0),
    }

    hasTrackedAddPaymentInfo.current = true
    trackVipAddPaymentInfo(payload)
  }, [safeToken, vipData.orderId, vipData.cartTotal, trackingContentId, productName])

  useEffect(() => {
    setIsProductImageBroken(false)
  }, [productImage])

  useEffect(() => {
    return () => {
      if (vipRedirectTimeoutRef.current !== null) {
        window.clearTimeout(vipRedirectTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    console.log('🚀 INICIANDO FETCH DE VIDEO. ProductID:', vipData.productId)

    if (!vipData.productId) {
      console.warn('⚠️ No hay productId en vipData. Usando fallback.')
      setVideoUrl('')
      return
    }

    const fetchVideo = async () => {
      try {
        const apiUrl = `https://app.drenvex.com/wp-json/jakawi/v1/videos/${vipData.productId}`
        console.log('🔗 Llamando a API:', apiUrl)

        const response = await fetch(apiUrl)
        const data = (await response.json()) as {
          _jakawi_vid_checkout?: unknown
          checkout?: unknown
        }
        console.log('📦 Datos recibidos de WP:', data)

        let checkoutUrl = data._jakawi_vid_checkout || data.checkout
        if (Array.isArray(checkoutUrl)) checkoutUrl = checkoutUrl[0]

        if (typeof checkoutUrl === 'string' && checkoutUrl.trim() !== '') {
          console.log('✅ URL de Traspaso encontrada:', checkoutUrl)
          setVideoUrl(checkoutUrl.trim())
        } else {
          console.warn('⚠️ La API no devolvió URL para _jakawi_vid_checkout')
          setVideoUrl('')
        }
      } catch (error) {
        console.error('❌ Error en fetch de Bóveda de Videos:', error)
        setVideoUrl('')
      }
    }

    void fetchVideo()
  }, [vipData.productId])

  useEffect(() => {
    if (urgencyTimer <= 0 && !isRedirecting && clubUrl) {
      setIsRedirecting(true)
      window.location.replace(clubUrl)
      return
    }

    if (urgencyTimer > 0 && !isRedirecting) {
      const timer = window.setInterval(() => {
        setUrgencyTimer((prev) => prev - 1)
      }, 1000)

      return () => {
        window.clearInterval(timer)
      }
    }
  }, [urgencyTimer, isRedirecting, token, clubUrl])

  const handleAutoRedirect = useCallback(() => {
    if (!clubUrl || isRedirecting) {
      return
    }

    setIsRedirecting(true)
    window.setTimeout(() => {
      window.location.href = clubUrl
    }, 1500)
  }, [clubUrl, isRedirecting])

  const handleVideoPlay = useCallback(() => {
    // Mantener callback estable evita reinstancias del player por re-renders del timer.
  }, [])

  const handleVideoEnded = useCallback(() => {
    handleAutoRedirect()
  }, [handleAutoRedirect])

  const handleVipPaymentClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()

    if (!clubUrl || isRedirecting) {
      return
    }

    const payload: VipPaymentIntentPayload = {
      content_id: trackingContentId,
      content_name: productName || 'Upsell VIP',
      content_type: 'product',
      currency: 'BOB',
      value: Number(vipData.cartTotal || 0),
    }

    trackVipPaymentIntent(payload)
    console.log('VIP Event Fired', payload)

    setIsRedirecting(true)
    vipRedirectTimeoutRef.current = window.setTimeout(() => {
      window.location.assign(clubUrl)
    }, 300)
  }, [clubUrl, isRedirecting, productName, trackingContentId, vipData.cartTotal])

  if (!safeToken) {
    return null
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="bg-red-600 px-5 py-3 flex items-center justify-center gap-3 md:gap-6 shadow-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-lg md:text-xl animate-pulse">⚠️</span>
          <p className="text-[11px] md:text-sm font-black uppercase tracking-widest text-white/95 mb-0 leading-none">
            ¡ATENCIÓN! GANA MÁS CON PAGO ANTICIPADO
          </p>
        </div>
        <div className="text-3xl md:text-4xl font-black text-yellow-300 drop-shadow-sm tabular-nums tracking-tighter leading-none">
          {minutes}:{seconds}
        </div>
      </div>

      <div className="flex-1 w-full max-w-6xl mx-auto flex flex-col md:flex-row items-center md:items-start justify-center gap-8 md:gap-12 px-5 py-8 md:py-16">
        <div className="w-full md:w-1/2 flex flex-col max-w-md md:max-w-full mx-auto">
          <div
            className={`w-full overflow-hidden rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.3)] ring-1 ring-slate-900/10 bg-slate-950 aspect-square ${isShortVideo ? 'is-short-video' : ''}`}
          >
            {isShortVideo && (
              <style>{`
                .is-short-video .plyr__video-wrapper iframe {
                    width: 100% !important;
                    height: 177.78% !important;
                    top: -38.89% !important;
                    left: 0 !important;
                    transform: none !important;
                }
              `}</style>
            )}
            <KurukinPlayer
              key={playerVideoId}
              provider="youtube"
              videoId={playerVideoId}
              aspectRatio="square"
              hideYoutubeUi={true}
              mutedPreview={{
                enabled: true,
                fallbackText1: 'HAZ CLIC PARA',
                fallbackText2: 'VER DEMOSTRACION',
              }}
              onPlay={handleVideoPlay}
              onEnded={handleVideoEnded}
            />
          </div>

          <div className="mt-4 text-center">
            {!isRedirecting && (
              <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">
                Al finalizar el video serás transferido a Jakawi.club
              </p>
            )}
          </div>
        </div>

        <div className="w-full md:w-1/2 flex flex-col text-center md:text-left max-w-md md:max-w-full mx-auto">
          <div className="inline-flex items-center justify-center md:justify-start gap-2 text-emerald-600 font-black tracking-wide uppercase text-sm mb-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              ></path>
            </svg>
            ¡PEDIDO #{orderId} RESERVADO!
          </div>

          <h1 className="mb-6 text-3xl md:text-4xl font-black text-slate-800 tracking-tight leading-tight">
            Pero espera... desbloquea <span className="text-amber-500">{cartTotal || 150} Pts VIP Extra</span> en los próximos 30 minutos 🎁
          </h1>

          <div className="mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-left relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>

            <p className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Resumen de tu Orden</p>

            <div className="flex items-center gap-4 ml-2">
              <div className="w-16 h-16 shrink-0 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden flex items-center justify-center">
                {productImage && !isProductImageBroken ? (
                  <img
                    src={productImage}
                    alt="Producto"
                    className="w-full h-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                      setIsProductImageBroken(true)
                    }}
                  />
                ) : (
                  <span className="text-2xl">🎁</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm md:text-base font-bold text-slate-800 leading-tight mb-1">{productName}</p>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">Cantidad: {vipData.quantity || 1}</span>
                    {skuText ? <span className="text-[10px] text-slate-400 font-mono">SKU: {skuText}</span> : null}
                  </div>
                  <span className="text-sm font-black text-emerald-600">Bs {cartTotal}</span>
                </div>
              </div>
            </div>

            {customerName ? (
              <div className="mt-3 ml-2 flex flex-col gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
                <div>
                  <strong className="text-slate-800">Enviando a:</strong>{' '}
                  <span id="tt-customer-name" className="font-medium text-slate-700">
                    {customerName}
                  </span>
                </div>
                {customerPhone ? (
                  <div>
                    <strong className="text-slate-800">Telefono:</strong>{' '}
                    <span id="tt-customer-phone" className="font-mono tracking-wide text-slate-800">
                      {customerPhone}
                    </span>
                  </div>
                ) : null}
                {customerAddress || customerCity ? (
                  <div>
                    <strong className="text-slate-800">Direccion:</strong>{' '}
                    <span id="tt-customer-address" className="text-slate-600">
                      {customerAddress}
                      {customerCity ? `, ${customerCity}` : ''}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mb-8 bg-amber-50 p-4 rounded-xl border border-amber-200 text-left shadow-inner">
            <p className="text-sm md:text-base font-medium text-slate-700 leading-relaxed">
              <strong className="text-amber-600 font-black flex items-center gap-1 mb-2 tracking-wide uppercase text-xs md:text-sm">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z"></path>
                </svg>
                Cómo mejorar tu pedido:
              </strong>
              Tu orden está registrada para pago contra entrega. Sin embargo, para <strong>ganar tus puntos VIP</strong> y asegurar{' '}
              <strong>envío prioritario (saltarte la fila)</strong>, debes realizar tu pago por adelantado antes de que el reloj llegue a cero.{' '}
              <br />
              <br />
              <strong>👇 Toca el video</strong> para escuchar las instrucciones exactas.
            </p>
          </div>

        </div>
      </div>

      {/* 5. STICKY FOOTER MINIMALISTA (Hormozi Split-Layout) */}
      <div className="sticky bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 shadow-[0_-15px_25px_-10px_rgba(0,0,0,0.1)] mt-auto w-full">
        <div className="max-w-4xl mx-auto w-full">
          {isRedirecting ? (
            <button disabled className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-6 py-3.5 text-base font-black text-white shadow-lg cursor-not-allowed">
              <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              Transfiriendo a Jakawi.club...
            </button>
          ) : (
            <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 w-full">
              {/* CTA Dominante */}
              <a
                href={`https://jakawi.club/?token=${token}`}
                onClick={handleVipPaymentClick}
                className="flex w-full md:w-2/3 items-center justify-center rounded-xl bg-emerald-600 px-4 py-3.5 text-base md:text-lg font-black text-white transition-all hover:bg-emerald-500 hover:scale-[1.02] shadow-[0_8px_15px_-5px_rgba(16,185,129,0.4)]"
              >
                Pagar Anticipado y Ganar Puntos ➔
              </a>

              {/* Opt-out Sutil (Enlace de WhatsApp) */}
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full md:w-1/3 items-center justify-center px-2 py-2 text-xs md:text-sm font-bold text-slate-400 hover:text-slate-600 underline decoration-slate-300 underline-offset-2 transition-colors text-center"
              >
                No gracias. Quiero pagar contra entrega
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
