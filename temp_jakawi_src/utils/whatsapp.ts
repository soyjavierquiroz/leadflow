type CashOnDeliveryWhatsAppMessageParams = {
  customerName: string
  orderId: number | string
  quantity: number
  productName: string
  total: number
  address: string
  city: string
}

function normalizeLine(value: string, fallback: string): string {
  const normalized = value.trim()
  return normalized !== '' ? normalized : fallback
}

export function buildCashOnDeliveryWhatsAppMessage({
  customerName,
  orderId,
  quantity,
  productName,
  total,
  address,
  city,
}: CashOnDeliveryWhatsAppMessageParams): string {
  const safeName = normalizeLine(customerName, 'Cliente')
  const safeOrderId = typeof orderId === 'number' || typeof orderId === 'string' ? `${orderId}`.trim() || '--' : '--'
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1
  const safeProductName = normalizeLine(productName, 'Tu producto')
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0
  const safeAddress = normalizeLine(address, 'Dirección pendiente de confirmar')
  const safeCity = normalizeLine(city, 'Ciudad pendiente de confirmar')

  const whatsappMessage = `Hola, mi nombre es ${safeName} y quiero confirmar mi pedido para *Pago Contra Entrega*:

\u{1F6CD}\u{FE0F} *Pedido:* #${safeOrderId}
\u{1F4E6} *Producto:* ${safeQuantity}x ${safeProductName}
\u{1F4B0} *Total a pagar:* Bs. ${safeTotal}
\u{1F4CD} *Dirección:* ${safeAddress}, ${safeCity}

Sé que con esta opción no sumo Puntos VIP, pero confirmo mi compra y tendré el efectivo listo al recibirlo.

A continuación, les envío mi ubicación GPS.`

  return whatsappMessage
}

export function buildWhatsAppUrl(phoneNumber: string, whatsappMessage: string): string {
  const safePhoneNumber = phoneNumber.replace(/\D/g, '')

  return `https://wa.me/${safePhoneNumber}?text=${encodeURIComponent(whatsappMessage)}`
}
