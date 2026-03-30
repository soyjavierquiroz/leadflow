import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchLandingData } from '../api/drenvex'

const localhostNames = new Set(['localhost', '127.0.0.1', '::1'])

function isIpAddress(value: string): boolean {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value)
}

function resolveHostname(): string {
  const rawHostname = window.location.hostname.trim().toLowerCase()
  const isLocal = localhostNames.has(rawHostname) || isIpAddress(rawHostname)

  if (!isLocal) {
    return rawHostname
  }

  const devHost = import.meta.env.VITE_DEV_TENANT_HOST?.trim().toLowerCase()
  if (!devHost) {
    throw new Error('VITE_DEV_TENANT_HOST is required when running on localhost or IP addresses.')
  }

  return devHost
}

export function useLandingData(productId: number) {
  const hostname = useMemo(resolveHostname, [])

  return useQuery({
    queryKey: ['landing-data', hostname, productId],
    queryFn: () => fetchLandingData(hostname, productId),
    staleTime: 0,
    gcTime: 30_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
}
