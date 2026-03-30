import { useEffect, useMemo, useState } from 'react'
import { DRENVEX_REST_BASE } from '../api/endpoints'
import { THEMES, type ThemeKey } from '../config/themes'

const LOCALHOST_NAMES = new Set(['localhost', '127.0.0.1', '::1'])
const FALLBACK_IMAGE = '/images/placeholder-product.svg'

export type StorefrontProduct = {
  id: number
  title: string
  name?: string
  slug?: string
  path?: string
  price: number
  originalPrice: number
  image: string
  badge?: string
}

export type StorefrontData = {
  theme: ThemeKey
  featured_products: StorefrontProduct[]
  extended_products: StorefrontProduct[]
}

const MOCK_FEATURED_PRODUCTS: StorefrontProduct[] = [
  {
    id: 1,
    title: 'Escritorio Inteligente Ergonómico Pro',
    price: 899,
    originalPrice: 1299,
    image: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=500&q=80',
    badge: '🔥 Más Vendido',
  },
  {
    id: 2,
    title: 'Proyector Home Cinema 4K',
    price: 749,
    originalPrice: 1099,
    image: 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=500&q=80',
    badge: '⭐ Destacado',
  },
]

const MOCK_EXTENDED_PRODUCTS: StorefrontProduct[] = [
  {
    id: 3,
    title: 'Lámpara LED Minimalista',
    price: 229,
    originalPrice: 349,
    image: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&q=80',
  },
  {
    id: 4,
    title: 'Auriculares Noise Canceling',
    price: 549,
    originalPrice: 799,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
  },
  {
    id: 5,
    title: 'Mochila Antirrobo USB',
    price: 299,
    originalPrice: 459,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80',
  },
  {
    id: 6,
    title: 'Termo Inteligente LCD',
    price: 149,
    originalPrice: 200,
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&q=80',
  },
]

const STOREFRONT_FALLBACK_DATA: StorefrontData = {
  theme: 'core-fuego',
  featured_products: MOCK_FEATURED_PRODUCTS,
  extended_products: MOCK_EXTENDED_PRODUCTS,
}

type JsonRecord = Record<string, unknown>

function isIpAddress(value: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)
}

function resolveHostname(): string {
  const rawHostname = window.location.hostname.trim().toLowerCase()
  const isLocal = LOCALHOST_NAMES.has(rawHostname) || isIpAddress(rawHostname)

  if (!isLocal) {
    return rawHostname
  }

  const devHost = import.meta.env.VITE_DEV_TENANT_HOST?.trim().toLowerCase()
  return devHost || rawHostname
}

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as JsonRecord
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/[^\d.,-]/g, '').replace(',', '.')
    const parsed = Number.parseFloat(normalized)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }
  return fallback
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isThemeKey(value: string): value is ThemeKey {
  return Object.prototype.hasOwnProperty.call(THEMES, value)
}

function normalizeProduct(raw: unknown, fallbackId: number): StorefrontProduct | null {
  const source = asRecord(raw)
  if (!source) {
    return null
  }

  const title = toStringValue(source.title) || toStringValue(source.name)
  if (!title) {
    return null
  }

  const salePrice = toNumber(source.price ?? source.sale_price ?? source.precio_final, 0)
  const originalPrice = toNumber(source.originalPrice ?? source.original_price ?? source.price_regular, salePrice)
  const image = toStringValue(source.image) || toStringValue(source.thumbnail) || FALLBACK_IMAGE
  const badge = toStringValue(source.badge) || undefined
  const id = toNumber(source.id, fallbackId)

  return {
    id: id > 0 ? Math.floor(id) : fallbackId,
    title,
    name: toStringValue(source.name) || undefined,
    slug: toStringValue(source.slug) || toStringValue(source.path) || undefined,
    path: toStringValue(source.path) || toStringValue(source.slug) || undefined,
    price: Math.max(0, salePrice),
    originalPrice: Math.max(0, originalPrice),
    image,
    badge,
  }
}

function normalizeProductArray(raw: unknown): StorefrontProduct[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw
    .map((item, index) => normalizeProduct(item, index + 1))
    .filter((item): item is StorefrontProduct => Boolean(item))
}

function normalizeStorefrontPayload(payload: unknown): StorefrontData {
  const directSource = asRecord(payload)
  const source = asRecord(directSource?.data) ?? directSource

  if (!source) {
    return STOREFRONT_FALLBACK_DATA
  }

  const incomingTheme = toStringValue(source.theme)
  const theme: ThemeKey = isThemeKey(incomingTheme) ? incomingTheme : STOREFRONT_FALLBACK_DATA.theme

  const featured = normalizeProductArray(source.featured_products)
  const extended = normalizeProductArray(source.extended_products)

  return {
    theme,
    featured_products: featured.length > 0 ? featured : STOREFRONT_FALLBACK_DATA.featured_products,
    extended_products: extended.length > 0 ? extended : STOREFRONT_FALLBACK_DATA.extended_products,
  }
}

export function useStorefrontData() {
  const hostname = useMemo(resolveHostname, [])
  const [data, setData] = useState<StorefrontData>(STOREFRONT_FALLBACK_DATA)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const endpoint = new URL(`${DRENVEX_REST_BASE}/storefront/by-domain`)
    endpoint.searchParams.set('domain', hostname)
    const apiKey = import.meta.env.VITE_DRENVEX_API_KEY?.trim() || ''
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
      headers['X-DX-API-KEY'] = apiKey
      headers['X-Drenvex-Api-Key'] = apiKey
      headers['X-API-Key'] = apiKey
    }

    setIsLoading(true)
    setError(null)

    fetch(endpoint.toString(), {
      method: 'GET',
      headers,
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Storefront endpoint unavailable (HTTP ${response.status}).`)
        }
        return response.json()
      })
      .then((payload: unknown) => {
        if (controller.signal.aborted) {
          return
        }
        setData(normalizeStorefrontPayload(payload))
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) {
          return
        }
        const message = err instanceof Error ? err.message : 'No se pudo cargar Storefront API.'
        setError(`${message} Activando fallback mock.`)
        setData(STOREFRONT_FALLBACK_DATA)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => {
      controller.abort()
    }
  }, [hostname])

  return { data, isLoading, error }
}

export type UseStorefrontDataResult = ReturnType<typeof useStorefrontData>
