import { useEffect, useState, useCallback, useMemo } from 'react'

declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

const isBrowserEnvironment = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined'

const normalizeId = (value: string | null): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const clean = value.trim()
  return clean !== '' ? clean : null
}

export const useGoogleTags = (gaId: string | null, gtmId: string | null) => {
  const [isReady, setIsReady] = useState(false)
  const normalizedGaId = useMemo(() => normalizeId(gaId), [gaId])
  const normalizedGtmId = useMemo(() => normalizeId(gtmId), [gtmId])

  useEffect(() => {
    if (!isBrowserEnvironment()) {
      return
    }

    if (!normalizedGaId && !normalizedGtmId) {
      setIsReady(false)
      return
    }

    window.dataLayer = window.dataLayer || []
    if (!window.gtag) {
      window.gtag = function (...args: unknown[]) {
        window.dataLayer.push(args)
      }
      window.gtag('js', new Date())
    }

    // Inyectar GTM
    if (normalizedGtmId && !document.getElementById('gtm-script')) {
      const script = document.createElement('script')
      script.id = 'gtm-script'
      script.innerHTML = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','${normalizedGtmId}');`
      document.head.appendChild(script)
    }

    // Inyectar GA4
    if (normalizedGaId && !document.getElementById('ga4-script')) {
      const script = document.createElement('script')
      script.id = 'ga4-script'
      script.async = true
      script.src = `https://www.googletagmanager.com/gtag/js?id=${normalizedGaId}`
      document.head.appendChild(script)
      window.gtag('config', normalizedGaId)
    }

    setIsReady(true)
  }, [normalizedGaId, normalizedGtmId])

  const track = useCallback((eventName: string, params: Record<string, unknown> = {}) => {
    if (window.gtag && isReady) {
      window.gtag('event', eventName, params)
    }
  }, [isReady])

  return { track, isReady }
}
