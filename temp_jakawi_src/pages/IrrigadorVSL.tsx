import { HighConvertVSL } from '../templates/HighConvertVSL'

export function IrrigadorVSL() {
  return (
    <HighConvertVSL
      headline="Deja de Sangrar al Cepillarte: La Solucion de Agua a Presion"
      subheadline="Mira este video y descubre por que miles cambiaron su rutina oral en menos de 7 dias."
      videoUrl="https://www.youtube.com/embed/dQw4w9WgXcQ"
      comparisonTitle="Lo que realmente importa antes de comprar"
      comparisonRows={[
        { feature: 'Eficacia en placa', ours: '✅ Alta precision diaria', competitor: '❌ Inconsistente' },
        { feature: 'Duracion de bateria', ours: '✅ 30 dias', competitor: '❌ 2 dias' },
        { feature: 'Comodidad para encias', ours: '✅ Modo suave y profundo', competitor: '❌ Presion irregular' },
        { feature: 'Soporte y garantia', ours: '✅ Respaldo Drenvex', competitor: '❌ Sin soporte real' },
      ]}
      benefitsTitle="Beneficios que si se sienten en tu dia a dia"
      benefitItems={[
        { icon: '✓', text: 'Sonrisa mas fresca y limpia desde la primera semana.' },
        { icon: '✓', text: 'Menos inflamacion y sangrado al cepillarte.' },
        { icon: '✓', text: 'Ahorro en limpiezas correctivas por mala higiene.' },
        { icon: '✓', text: 'Confianza para hablar de cerca sin preocuparte por mal aliento.' },
      ]}
      stackTitle="Tu Oferta de Hoy (solo por tiempo limitado)"
      stackItems={[
        { name: 'Irrigador Bucal Pro Drenvex', comparePrice: '$69.00' },
        { name: 'Boquillas Extra (Gratis)', comparePrice: '$15.00' },
        { name: 'Ebook Sonrisa Perfecta (Gratis)', comparePrice: '$12.00' },
      ]}
      totalLabel="Hoy te lo llevas por:"
      totalValue="$45.00"
      ctaText="QUIERO MI IRRIGADOR CON BONOS"
      guaranteeText="Garantia Blindada de 60 Dias"
    />
  )
}
