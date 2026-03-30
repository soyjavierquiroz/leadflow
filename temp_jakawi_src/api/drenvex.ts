import { getVexerRevalidationBucket } from './endpoints'
import type { LandingDataResponse } from './types'

export async function fetchLandingData(hostname: string, productId: number): Promise<LandingDataResponse> {
  console.error('❌ [DRENVEX] Llamada a API legacy detectada. El cliente debe usar UniversalProductPage.')

  const endpoint = new URL('/api/drenvex/vexer/by-domain', window.location.origin)
  endpoint.searchParams.set('host', hostname)
  endpoint.searchParams.set('product_id', String(productId))
  endpoint.searchParams.set('__revalidate', getVexerRevalidationBucket())

  const response = await fetch(endpoint.toString())

  if (!response.ok) {
    throw new Error(`Drenvex API request failed with status ${response.status}`)
  }

  return response.json() as Promise<LandingDataResponse>
}
