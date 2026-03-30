const BOVEDA_OFERTAS_ID = 'boveda-ofertas'
const TRANSPORT_CTA_TEXT = 'ELEGIR OFERTA AHORA'

function scrollToBovedaOffers(): boolean {
  if (typeof document === 'undefined') {
    return false
  }

  const target = document.getElementById(BOVEDA_OFERTAS_ID)
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  if (!target) {
    return false
  }

  return true
}

export { BOVEDA_OFERTAS_ID, TRANSPORT_CTA_TEXT, scrollToBovedaOffers }
