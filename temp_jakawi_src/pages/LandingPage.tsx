import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { DrenvexApiError, buildResolveApiUrl, fetchLandingData, type DrenvexResolveSuccess } from '../services/drenvex-api'

type DiagnosticData = {
  domainDetected: string
  slugReceived: string
  apiUrlGenerated: string
  errorRaw: string
  stackTrace: string
}

function NotFoundProduct({ productSlug }: { productSlug?: string }) {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-14 text-slate-100">
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-700/70 bg-slate-900/70 p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Producto no disponible</p>
        <h1 className="mt-4 text-3xl font-black">No encontramos la landing para este slug</h1>
        <p className="mt-3 text-sm text-slate-300">
          Slug recibido: <span className="font-semibold text-white">{productSlug ?? 'sin slug'}</span>
        </p>
      </div>
    </main>
  )
}

export function LandingPage() {
  const { productSlug } = useParams<{ productSlug: string }>()
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DrenvexResolveSuccess | null>(null)
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null)

  const domain = useMemo(() => {
    const rawHostname = window.location.hostname.trim().toLowerCase()
    const isLocal = rawHostname === 'localhost' || rawHostname === '127.0.0.1' || rawHostname === '::1'

    if (!isLocal) {
      return rawHostname
    }

    const devHost = import.meta.env.VITE_DEV_TENANT_HOST?.trim().toLowerCase()
    if (!devHost) {
      return rawHostname
    }

    return devHost
  }, [])

  useEffect(() => {
    if (!productSlug) {
      setIsLoading(false)
      setData(null)
      setError('No se recibió slug en la URL.')
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)
    setDiagnostic(null)

    const slugReceived = productSlug
    let apiUrlGenerated = 'No disponible (fallo al generar URL)'

    try {
      apiUrlGenerated = buildResolveApiUrl(domain, slugReceived)
    } catch {
      // Se completa igual en el catch principal de fetchLandingData.
    }

    fetchLandingData(domain, productSlug)
      .then((result) => {
        if (cancelled) return

        if (result.status === 'redirect') {
          console.warn(`🚨 [DRENVEX] Redirección legacy bloqueada hacia: ${result.redirect_to}`)
          return // Detiene la ejecución
        }

        setData(result)
      })
      .catch((err: unknown) => {
        if (cancelled) return

        const errorRaw =
          err instanceof DrenvexApiError
            ? `${err.name}: ${err.message} | status=${err.status} | payload=${JSON.stringify(err.payload ?? null)}`
            : err instanceof Error
              ? `${err.name}: ${err.message}`
            : typeof err === 'string'
              ? err
              : JSON.stringify(err)
        const stackTrace = err instanceof Error && err.stack ? err.stack : 'No stack trace disponible'

        setDiagnostic({
          domainDetected: domain,
          slugReceived,
          apiUrlGenerated,
          errorRaw,
          stackTrace,
        })

        if (err instanceof DrenvexApiError) {
          setError(err.message)
          return
        }

        if (err instanceof Error) {
          setError(err.message)
          return
        }

        setError('Error desconocido al resolver la landing.')
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [domain, productSlug])

  if (!productSlug) {
    return <NotFoundProduct />
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 px-6 py-5 text-sm font-semibold">
          Cargando landing...
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="min-h-screen bg-black px-6 py-10 text-red-400">
        <div className="mx-auto max-w-5xl border border-red-700 bg-black p-6">
          <h1 className="mb-3 text-2xl font-bold text-red-300">MODO DIAGNOSTICO ACTIVO</h1>
          <p className="mb-5 text-sm text-red-400">Fallo al cargar la landing: {error}</p>

          <table className="w-full border-collapse text-left text-sm">
            <tbody>
              <tr className="border border-red-700">
                <th className="w-56 border border-red-700 p-2 text-red-200">Domain Detectado</th>
                <td className="border border-red-700 p-2 text-red-400">{diagnostic?.domainDetected ?? '-'}</td>
              </tr>
              <tr className="border border-red-700">
                <th className="border border-red-700 p-2 text-red-200">Slug Recibido</th>
                <td className="border border-red-700 p-2 text-red-400">{diagnostic?.slugReceived ?? '-'}</td>
              </tr>
              <tr className="border border-red-700">
                <th className="border border-red-700 p-2 text-red-200">API URL Generada</th>
                <td className="border border-red-700 p-2 text-red-400 break-all">{diagnostic?.apiUrlGenerated ?? '-'}</td>
              </tr>
              <tr className="border border-red-700">
                <th className="border border-red-700 p-2 text-red-200">Error Raw</th>
                <td className="border border-red-700 p-2 text-red-400 break-all">{diagnostic?.errorRaw ?? '-'}</td>
              </tr>
              <tr className="border border-red-700">
                <th className="border border-red-700 p-2 text-red-200 align-top">Stack Trace</th>
                <td className="border border-red-700 p-2 text-red-400">
                  <pre className="whitespace-pre-wrap break-words">{diagnostic?.stackTrace ?? '-'}</pre>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 text-sm">Sin datos para esta landing.</div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-14 text-slate-100">
      <div className="mx-auto max-w-5xl rounded-3xl border border-slate-700/70 bg-slate-900/70 p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Landing activa</p>
        <h1 className="mt-3 text-4xl font-black">{data.product.name ?? `Producto #${data.product.id}`}</h1>
        <p className="mt-2 text-sm text-slate-300">{data.product.description ?? 'Sin descripción para esta landing.'}</p>

        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Vexer</h2>
            <p className="mt-2 text-2xl font-bold text-white">{data.vexer.branding?.store_name ?? `Vexer #${data.vexer.id}`}</p>
            <p className="mt-2 text-sm text-slate-300">Landing version: {data.landing.version_tag ?? 'v1'}</p>
          </article>

          <article className="rounded-2xl border border-emerald-400/50 bg-emerald-500/10 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-emerald-200">Precio dinámico</h2>
            <p className="mt-2 text-4xl font-black text-emerald-300">{data.product.pricing?.precio_final ?? 'N/D'}</p>
            <p className="mt-2 text-xs text-emerald-100/90">Product ID: {data.product.id}</p>
          </article>
        </section>
      </div>
    </main>
  )
}
