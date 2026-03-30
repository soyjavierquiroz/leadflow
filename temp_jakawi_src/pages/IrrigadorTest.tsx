import { VexerCore } from '../templates/VexerCore'

export function IrrigadorTest() {
  return (
    <VexerCore
      badge="Tecnologia Oral Premium"
      title="Irrigador Bucal Pro - Drenvex"
      subtitle="Elimina el 99.9% de la placa con pulsos de agua de alta precision para una limpieza profunda y segura todos los dias."
      price="$45.00"
      priceHint="Incluye 4 boquillas y garantia oficial"
      ctaText="Comprar Irrigador Ahora"
      heroImage="/images/placeholder-product.svg"
      heroImageAlt="Irrigador bucal sobre superficie blanca"
      benefits={[
        'Limpieza profunda entre dientes y encias en 60 segundos.',
        'Reduce sangrado gingival con uso continuo.',
        'Tanque facil de recargar y modo suave para uso diario.',
      ]}
      trustItems={[
        { icon: '1Y', text: 'Garantia de 1 ano' },
        { icon: 'FREE', text: 'Envio Gratis' },
        { icon: 'DDS', text: 'Recomendado por Dentistas' },
      ]}
      before={{
        title: 'Antes: limpieza incompleta',
        description:
          'Con cepillado tradicional quedan residuos en zonas dificiles, generando placa y mal aliento.',
        image: '/images/placeholder-product.svg',
        imageAlt: 'Comparativa de dientes antes del irrigador',
      }}
      after={{
        title: 'Despues: higiene total',
        description:
          'Con el irrigador bucal mejoras la limpieza interdental, cuidas tus encias y logras una sensacion fresca duradera.',
        image: '/images/placeholder-product.svg',
        imageAlt: 'Comparativa de dientes despues del irrigador',
      }}
    />
  )
}
