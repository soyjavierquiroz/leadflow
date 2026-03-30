import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGoogleTags, useMetaPixel, useTikTokPixel } from '../analytics'
import { readStoredPixelIds } from '../analytics/pixelStorage'

export function SecureQRBridgePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const safeToken = typeof token === 'string' ? token.trim() : ''
  const savedPixels = useMemo(() => readStoredPixelIds(), [])

  useMetaPixel(savedPixels.meta)
  useTikTokPixel(savedPixels.tiktok)
  useGoogleTags(savedPixels.ga, savedPixels.gtm)

  const targetUrl = useMemo(() => {
    if (!safeToken) {
      return ''
    }

    return `https://jakawi.club/qr-checkout/${encodeURIComponent(safeToken)}`
  }, [safeToken])

  useEffect(() => {
    if (!safeToken) {
      navigate('/', { replace: true })
      return
    }

    const timeoutId = window.setTimeout(() => {
      window.location.href = targetUrl
    }, 3000)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [navigate, safeToken, targetUrl])

  if (!safeToken) {
    return null
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,171,35,0.14),_transparent_45%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-16">
        <section className="w-full max-w-xl rounded-[2rem] border border-white/70 bg-white/90 p-8 text-center shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-[#ffab23] shadow-lg">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-8 w-8">
              <path
                d="M7 11V8a5 5 0 1 1 10 0v3m-8 0h6m-8 0A2 2 0 0 0 5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2m-8 0h8"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.7"
              />
            </svg>
          </div>

          <div className="mt-6 flex justify-center">
            <span className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-[#ffab23]" aria-hidden="true" />
          </div>

          <h1 className="mt-6 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Generando tu entorno seguro de pago...</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-600 md:text-base">
            Por favor, no cierres esta ventana. Estamos preparando tu paso final para completar el pago VIP de forma segura.
          </p>

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            Tu sesion segura se abrira automaticamente en unos segundos.
          </div>
        </section>
      </div>
    </main>
  )
}

export default SecureQRBridgePage
