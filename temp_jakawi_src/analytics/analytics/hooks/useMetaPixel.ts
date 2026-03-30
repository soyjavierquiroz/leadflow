import { useEffect, useState, useCallback } from 'react'

const JAKAWI_GLOBAL_PIXEL = String(import.meta.env.VITE_JAKAWI_PIXEL_META || '').trim()
const initializedPixelIds = new Set<string>()

declare global {
  interface Window {
    fbq: any
    _fbq: any
  }
}

export const useMetaPixel = (pixelId: string | null = null) => {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const vexerPixel = typeof pixelId === 'string' ? pixelId.trim() : ''
    const globalPixel = JAKAWI_GLOBAL_PIXEL

    if (!vexerPixel && !globalPixel) return

    // Si ya existe la funcion de Facebook, no la volvemos a inyectar.
    if (!(window.fbq && typeof window.fbq === 'function' && window.fbq.loaded)) {
      // Snippet oficial de inyeccion de Meta (Pixel Base Code)
      ;(function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
        if (f.fbq) return
        n = f.fbq = function () {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments)
        }
        if (!f._fbq) f._fbq = n
        n.push = n
        n.loaded = !0
        n.version = '2.0'
        n.queue = []
        t = b.createElement(e)
        t.async = !0
        t.src = v
        s = b.getElementsByTagName(e)[0]
        s.parentNode.insertBefore(t, s)
      })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js')
    }

    // 1. Inicializar el Pixel Maestro de Jakawi (si existe en el .env)
    if (globalPixel && !initializedPixelIds.has(globalPixel)) {
      window.fbq('init', globalPixel)
      initializedPixelIds.add(globalPixel)
    }

    // 2. Inicializar el Pixel del Vexer (si viene por parametro)
    if (vexerPixel && !initializedPixelIds.has(vexerPixel)) {
      window.fbq('init', vexerPixel)
      initializedPixelIds.add(vexerPixel)
    }

    // 3. Disparar un PageView base por defecto al cargar el script
    window.fbq('track', 'PageView')

    setIsReady(true)
  }, [pixelId])

  // Exponer funcion de tracking para eventos especificos (InitiateCheckout, Purchase)
  const track = useCallback((eventName: string, params: any = {}) => {
    if (window.fbq && isReady) {
      window.fbq('track', eventName, params)
    }
  }, [isReady])

  // Exponer funcion para Custom Events si es necesario
  const trackCustom = useCallback((eventName: string, params: any = {}) => {
    if (window.fbq && isReady) {
      window.fbq('trackCustom', eventName, params)
    }
  }, [isReady])

  return { track, trackCustom, isReady }
}
