const LOCAL_PLACEHOLDER_IMAGE = '/images/placeholder-product.svg'

export const resolveMedia = (
  keyOrUrl?: string,
  dictionary?: Record<string, string>,
  usePlaceholder: boolean = true,
): string => {
  if (!keyOrUrl) return ''

  const normalized = String(keyOrUrl).trim()
  if (!normalized) return ''

  // Soporte legacy para URLs directas.
  if (normalized.startsWith('http')) return normalized

  // Retorna del diccionario si existe.
  if (dictionary && dictionary[normalized]) {
    return dictionary[normalized]
  }

  if (!usePlaceholder) return ''

  return LOCAL_PLACEHOLDER_IMAGE
}

export default resolveMedia
