export const BOLIVIAN_CITIES: string[] = [
  'Santa Cruz',
  'La Paz',
  'El Alto',
  'Cochabamba',
  'Sucre',
  'Oruro',
  'Tarija',
  'Potosí',
  'Trinidad',
  'Cobija',
  'Otra...',
]

export function matchBolivianCity(rawCity: string | null | undefined): string {
  const detected = (rawCity || '').trim().toLowerCase()
  if (!detected) {
    return ''
  }

  if (detected.includes('santa cruz')) return 'Santa Cruz'
  if (detected.includes('la paz')) return 'La Paz'
  if (detected.includes('alto')) return 'El Alto'
  if (detected.includes('cochabamba')) return 'Cochabamba'
  if (detected.includes('sucre')) return 'Sucre'
  if (detected.includes('oruro')) return 'Oruro'
  if (detected.includes('tarija')) return 'Tarija'
  if (detected.includes('potos')) return 'Potosí'
  if (detected.includes('trinidad')) return 'Trinidad'
  if (detected.includes('cobija')) return 'Cobija'

  return ''
}
