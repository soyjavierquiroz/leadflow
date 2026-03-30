const RAW_API_URL =
  import.meta.env.VITE_DRENVEX_API_URL?.trim() ||
  import.meta.env.VITE_WP_API_URL?.trim() ||
  'https://app.drenvex.com'

function buildDrenvexRestBase(rawUrl: string): string {
  const clean = rawUrl.replace(/\/+$/, '')

  if (/\/wp-json\/drenvex\/v1$/i.test(clean)) {
    return clean
  }

  if (/\/wp-json$/i.test(clean)) {
    return `${clean}/drenvex/v1`
  }

  return `${clean}/wp-json/drenvex/v1`
}

export const DRENVEX_REST_BASE = buildDrenvexRestBase(RAW_API_URL)
export const DRENVEX_BY_DOMAIN_ENDPOINT = `${DRENVEX_REST_BASE}/vexer/by-domain`
export const DRENVEX_PRE_ORDER_ENDPOINT = `${DRENVEX_REST_BASE}/checkout/pre-order`
export const DRENVEX_RECOVERY_ENDPOINT = `${DRENVEX_REST_BASE}/checkout/recovery`

export function getVexerRevalidationBucket(now = Date.now()): string {
  return String(now)
}
