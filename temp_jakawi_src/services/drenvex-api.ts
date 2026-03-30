const DRENVEX_RESOLVE_ENDPOINT = 'https://app.drenvex.com/wp-json/drenvex/v1/resolve'

type JsonObject = Record<string, unknown>

export interface DrenvexResolveSuccess {
  status: 'ok'
  vexer: {
    id: number
    branding?: {
      store_name?: string
      logo_url?: string
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  product: {
    id: number
    name?: string
    description?: string
    pricing?: {
      precio_final?: number | string
      [key: string]: unknown
    }
    [key: string]: unknown
  }
  landing: {
    version_tag?: string
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface DrenvexResolveRedirect {
  status: 'redirect'
  redirect_to: string
  reason?: string
  [key: string]: unknown
}

export type DrenvexResolveResponse = DrenvexResolveSuccess | DrenvexResolveRedirect

export class DrenvexApiError extends Error {
  status: number
  payload?: unknown

  constructor(message: string, status: number, payload?: unknown) {
    super(message)
    this.name = 'DrenvexApiError'
    this.status = status
    this.payload = payload
  }
}

function sanitizeDomain(input: string): string {
  const raw = input.trim()
  if (!raw) return ''

  try {
    const maybeUrl = raw.includes('://') ? raw : `https://${raw}`
    return new URL(maybeUrl).hostname.trim().toLowerCase()
  } catch {
    return raw
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .split(':')[0]
      .trim()
      .toLowerCase()
  }
}

function sanitizePath(input: string): string {
  const raw = input.trim()
  if (!raw) return ''

  const withoutQueryOrHash = raw.split('?')[0].split('#')[0]
  const normalized = withoutQueryOrHash.replace(/^\/+|\/+$/g, '')
  return normalized
}

async function readJsonPayload(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (isJsonObject(payload) && typeof payload.error === 'string' && payload.error.trim() !== '') {
    return payload.error
  }
  if (typeof payload === 'string' && payload.trim() !== '') {
    return payload
  }
  return fallback
}

export function buildResolveApiUrl(domain: string, slug: string): string {
  const cleanDomain = sanitizeDomain(domain)
  const cleanPath = sanitizePath(slug)

  if (!cleanDomain) {
    throw new DrenvexApiError('Domain inválido. No se pudo resolver el host.', 400)
  }

  if (!cleanPath) {
    throw new DrenvexApiError('Slug inválido. No se pudo resolver el path.', 400)
  }

  const url = new URL(DRENVEX_RESOLVE_ENDPOINT)
  url.searchParams.set('domain', cleanDomain)
  url.searchParams.set('path', cleanPath)
  return url.toString()
}

export async function fetchLandingData(domain: string, slug: string): Promise<DrenvexResolveResponse> {
  const endpointUrl = buildResolveApiUrl(domain, slug)

  const response = await fetch(endpointUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    redirect: 'manual',
  })

  if (response.type === 'opaqueredirect') {
    throw new DrenvexApiError(
      'El backend respondió con redirección opaca (CORS). Habilita CORS o devuelve 200 con redirect_to.',
      302,
    )
  }

  const payload = await readJsonPayload(response)

  if (response.status === 200) {
    if (!isJsonObject(payload)) {
      throw new DrenvexApiError('Respuesta inválida del Router Maestro.', 200, payload)
    }
    return payload as DrenvexResolveSuccess
  }

  if (response.status === 302) {
    const bodyRedirect = isJsonObject(payload) && typeof payload.redirect_to === 'string' ? payload.redirect_to : ''
    const headerRedirect = response.headers.get('Location') ?? ''
    const redirectTo = bodyRedirect || headerRedirect

    if (!redirectTo) {
      throw new DrenvexApiError('Redirección sin destino (redirect_to / Location).', 302, payload)
    }

    return {
      ...(isJsonObject(payload) ? payload : {}),
      status: 'redirect',
      redirect_to: redirectTo,
    } as DrenvexResolveRedirect
  }

  if (response.status === 404) {
    throw new DrenvexApiError(getErrorMessage(payload, 'No se encontró la landing solicitada.'), 404, payload)
  }

  throw new DrenvexApiError(
    getErrorMessage(payload, `Error del Router Maestro (HTTP ${response.status}).`),
    response.status,
    payload,
  )
}
