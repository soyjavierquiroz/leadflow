import { useEffect } from 'react'

const SPLASH_REDIRECT_URL = '/barberia-afeitado/rasuradora'
const SPLASH_REDIRECT_DELAY_MS = 3000

export function StorefrontComingSoon() {
  useEffect(() => {
    const timerId = window.setTimeout(() => {
      window.location.replace(SPLASH_REDIRECT_URL)
    }, SPLASH_REDIRECT_DELAY_MS)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [])

  return (
    <main className="min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="relative flex min-h-screen items-center justify-center px-6 py-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.18),_transparent_42%),radial-gradient(circle_at_bottom,_rgba(15,23,42,0.08),_transparent_38%)]" />

        <div className="relative w-full max-w-xl rounded-[2rem] border border-slate-200/80 bg-white/90 px-8 py-12 text-center shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-lg font-semibold tracking-[0.35em] text-white">
            JK
          </div>

          <div className="mt-8 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-orange-500">
              Jakawi
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Bienvenido a Jakawi
            </h1>
            <p className="mx-auto max-w-md text-sm leading-7 text-slate-600 sm:text-base">
              Estamos preparando una experiencia mejorada para la tienda principal.
              Te llevamos en unos segundos a nuestro producto estrella para que no
              te pierdas la mejor oferta de hoy.
            </p>
          </div>

          <div className="mt-8 flex flex-col items-center gap-4">
            <div
              className="h-10 w-10 rounded-full border-[3px] border-orange-200 border-t-orange-500 animate-spin"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-slate-500">
              Redirigiendo a <span className="text-slate-700">/barberia-afeitado/rasuradora</span>
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
