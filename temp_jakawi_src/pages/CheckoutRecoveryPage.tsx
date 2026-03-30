import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

const RECOVERY_ENDPOINT =
  import.meta.env.VITE_DRENVEX_RECOVERY_ENDPOINT?.trim() ||
  '/wp-json/drenvex/v1/checkout/recovery'

const JAKAWI_WHATSAPP_NUMBER = (
  import.meta.env.VITE_JAKAWI_WHATSAPP_NUMBER?.trim() || '59179790873'
).replace(/[^0-9]/g, '')

type RecoveryPayload = {
  success?: boolean
  order_id?: number | string
  total?: number | string
  product_id?: number | string
  qr_vault?: Record<string, unknown> | string
  created_at?: string
  expires_at?: string
  remaining_seconds?: number
  error?: string
  message?: string
}

type RecoveryOrderData = {
  order_id: number
  total: number | string
  product_id: number
  qr_vault: Record<string, unknown> | string
  created_at?: string
  expires_at?: string
}

function toPriceKey(value: number | string): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  const normalized = raw.replace(',', '.').replace(/[^0-9.]/g, '')
  if (!normalized || normalized.split('.').length > 2) return ''

  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed) || parsed <= 0) return ''

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

function resolveRecoveryQrValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') {
    return normalizeCdnMediaUrl(value)
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const candidate = value as Record<string, unknown>
  const qrUrl = typeof candidate.qr_url === 'string' ? candidate.qr_url.trim() : ''
  if (qrUrl) {
    return normalizeCdnMediaUrl(qrUrl)
  }

  const imageKey = typeof candidate.image_key === 'string' ? candidate.image_key.trim() : ''
  if (imageKey) {
    return normalizeCdnMediaUrl(imageKey)
  }

  return null
}

function formatCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60

  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${JAKAWI_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
}

async function readPayload(response: Response): Promise<RecoveryPayload> {
  const text = await response.text()
  if (!text) {
    return {}
  }

  try {
    return JSON.parse(text) as RecoveryPayload
  } catch {
    return {}
  }
}

function getErrorMessage(payload: RecoveryPayload, status: number): string {
  if (typeof payload.error === 'string' && payload.error.trim() !== '') {
    return payload.error
  }
  if (typeof payload.message === 'string' && payload.message.trim() !== '') {
    return payload.message
  }
  return `Este enlace ha expirado o ya fue pagado (HTTP ${status}).`
}

export function CheckoutRecoveryPage() {
  const location = useLocation()
  const token = useMemo(() => {
    const value = new URLSearchParams(location.search).get('t') ?? ''
    return value.trim()
  }, [location.search])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orderData, setOrderData] = useState<RecoveryOrderData | null>(null)
  const [showCodWarning, setShowCodWarning] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(60 * 60)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError('Este enlace ha expirado o ya fue pagado.')
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setError('')
    setOrderData(null)

    const endpoint = new URL(RECOVERY_ENDPOINT, window.location.origin)
    endpoint.searchParams.set('token', token)

    fetch(endpoint.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await readPayload(response)
        if (!response.ok || !payload.success) {
          throw new Error(getErrorMessage(payload, response.status))
        }

        const orderId = Number(payload.order_id)
        const productId = Number(payload.product_id)
        const qrVault =
          typeof payload.qr_vault === 'string' || (payload.qr_vault && typeof payload.qr_vault === 'object')
            ? payload.qr_vault
            : {}

        if (!Number.isFinite(orderId) || orderId <= 0 || !Number.isFinite(productId) || productId <= 0) {
          throw new Error('Respuesta inválida del endpoint de recuperación.')
        }

        setOrderData({
          order_id: orderId,
          total: payload.total ?? '',
          product_id: productId,
          qr_vault: qrVault,
          created_at: payload.created_at,
          expires_at: payload.expires_at,
        })

        if (typeof payload.remaining_seconds === 'number' && Number.isFinite(payload.remaining_seconds)) {
          setRemainingSeconds(Math.max(0, Math.floor(payload.remaining_seconds)))
          return
        }

        if (typeof payload.expires_at === 'string' && payload.expires_at.trim() !== '') {
          const expiresTs = new Date(payload.expires_at).getTime()
          if (Number.isFinite(expiresTs)) {
            const diff = Math.floor((expiresTs - Date.now()) / 1000)
            setRemainingSeconds(Math.max(0, diff))
            return
          }
        }

        setRemainingSeconds(60 * 60)
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const message = err instanceof Error ? err.message : 'Este enlace ha expirado o ya fue pagado.'
        setError(message)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [token])

  useEffect(() => {
    if (loading || !orderData || remainingSeconds <= 0) {
      return
    }

    const timer = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [loading, orderData, remainingSeconds])

  const activeQR = useMemo(() => {
    if (!orderData) {
      return null
    }

    const directQr = resolveRecoveryQrValue(orderData.qr_vault)
    if (directQr) {
      return directQr
    }

    const totalRawKey = String(orderData.total ?? '').trim()
    const normalizedKey = toPriceKey(orderData.total ?? '')

    if (orderData.qr_vault && typeof orderData.qr_vault === 'object' && !Array.isArray(orderData.qr_vault)) {
      if (totalRawKey) {
        const rawKeyQr = resolveRecoveryQrValue(orderData.qr_vault[totalRawKey])
        if (rawKeyQr) {
          return rawKeyQr
        }
      }

      if (normalizedKey) {
        const normalizedKeyQr = resolveRecoveryQrValue(orderData.qr_vault[normalizedKey])
        if (normalizedKeyQr) {
          return normalizedKeyQr
        }
      }
    }

    return null
  }, [orderData])

  const handleWhatsAppQR = () => {
    if (!orderData) return
    const message = `Hola Jakawi, aqui mi comprobante del pedido #${orderData.order_id}.`
    window.open(buildWhatsAppUrl(message), '_blank', 'noopener,noreferrer')
  }

  const handleWhatsAppCOD = () => {
    if (!orderData) return
    const message = `Hola, confirmo mi pedido #${orderData.order_id} para pago Contra Entrega.`
    window.open(buildWhatsAppUrl(message), '_blank', 'noopener,noreferrer')
    setShowCodWarning(false)
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 text-sm font-semibold">
          Recuperando tu pedido...
        </div>
      </main>
    )
  }

  if (error || !orderData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900/80 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-300">Enlace inválido</p>
          <h1 className="mt-3 text-3xl font-black">Este enlace ha expirado o ya fue pagado</h1>
          <p className="mt-3 text-sm text-slate-300">{error || 'No se pudo recuperar el pedido.'}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-3xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-2xl">
        <div className="rounded-2xl border border-amber-400/50 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-200">⚠️ Tu pedido está reservado. Completa tu pago antes de que expire.</p>
        </div>

        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-700 bg-slate-950/70 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">Pedido</p>
            <p className="mt-2 text-3xl font-black text-white">#{orderData.order_id}</p>
            <p className="mt-2 text-sm text-slate-300">Total reservado: {String(orderData.total)}</p>
          </article>

          <article className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-rose-200">Cronómetro de Reserva</p>
            <p className="mt-2 text-3xl font-black text-rose-200">{formatCountdown(remainingSeconds)}</p>
            <p className="mt-2 text-sm text-rose-100/80">Al expirar, la reserva puede liberarse automáticamente.</p>
          </article>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-700 bg-slate-950/70 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-300">Pago por QR</p>
          <div className="mt-3 flex h-72 items-center justify-center rounded-xl border border-slate-600 bg-white p-4">
            {activeQR ? (
              <img src={activeQR} alt={`QR para pago de ${String(orderData.total)}`} className="h-full w-full rounded-xl object-contain" />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500">
                <span className="text-sm">QR no configurado para este precio.</span>
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3">
            <button
              type="button"
              onClick={handleWhatsAppQR}
              className="w-full rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black uppercase tracking-wide text-white transition hover:bg-emerald-500"
            >
              Ya pagué, Enviar Comprobante
            </button>

            <button
              type="button"
              onClick={() => setShowCodWarning(true)}
              className="w-full text-sm font-semibold text-slate-400 underline decoration-slate-500 underline-offset-4 transition hover:text-slate-200"
            >
              Prefiero pagar al recibir
            </button>
          </div>
        </section>
      </div>

      {showCodWarning ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-slate-900 shadow-2xl">
            <h3 className="text-lg font-black">⚠️ ¿Seguro que quieres cambiar?</h3>
            <p className="mt-2 text-sm text-slate-600">Perderás tus Puntos VIP y el envío prioritario de hoy.</p>
            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={handleWhatsAppCOD}
                className="w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-200"
              >
                Cambiar a Contra Entrega
              </button>
              <button
                type="button"
                onClick={() => setShowCodWarning(false)}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-500"
              >
                Mantener mis beneficios VIP
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
