export function getCookie(name: string): string | null {
  if (typeof document === 'undefined' || typeof name !== 'string' || name.trim() === '') {
    return null
  }

  const encodedName = `${encodeURIComponent(name.trim())}=`
  const parts = document.cookie.split(';')

  for (const part of parts) {
    const candidate = part.trim()
    if (!candidate.startsWith(encodedName)) {
      continue
    }

    const rawValue = candidate.slice(encodedName.length)
    if (rawValue === '') {
      return null
    }

    try {
      return decodeURIComponent(rawValue)
    } catch {
      return rawValue
    }
  }

  return null
}
