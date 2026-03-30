import { useEffect, useState } from 'react'
import { PageLoader } from '../components/ui/Loaders/PageLoader'
import { VexerCyber } from '../templates/VexerCyber'
import type { UIConfig } from '../templates/types'

const mockUiConfig: UIConfig = {
  marquee: {
    enabled: true,
    text: '🔥 OFERTA FLASH: ENVÍO GRATIS SOLO POR HOY 🔥',
    bg_color: '#FF4500',
    text_color: '#FFFFFF',
  },
  whatsapp: {
    enabled: true,
    number: '59100000000',
    message: '¡Hola! Quiero el reloj.',
  },
  sticky_cta: {
    enabled: true,
    text: 'PEDIR AHORA - PAGO CONTRA ENTREGA',
  },
}

const relojGalleryImages = [
  '/images/placeholder-product.svg',
  '/images/placeholder-product.svg',
  '/images/placeholder-product.svg',
  '/images/placeholder-product.svg',
  '/images/placeholder-product.svg',
]

export function RelojOferta() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setIsLoading(false)
    }, 1500)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [])

  if (isLoading) {
    return <PageLoader bgColor="#FFFFFF" spinnerColor="#FF5722" />
  }

  return (
    <VexerCyber
      uiConfig={mockUiConfig}
      badge="Oferta Smartwatch Drenvex"
      title="Controla tu salud, tus metas y tu estilo desde tu muñeca"
      subtitle="El nuevo Smartwatch Drenvex combina monitoreo avanzado, batería de larga duración y diseño premium para acompañarte todo el día."
      price="Bs 699"
      priceHint="Incluye envío prioritario por tiempo limitado"
      ctaText="Comprar Smartwatch con Descuento"
      heroImage="/images/placeholder-product.svg"
      heroImageAlt="Smartwatch Drenvex en oferta"
      galleryImages={relojGalleryImages}
      features={[
        {
          icon: 'AI',
          title: 'Analítica inteligente 24/7',
          description: 'Mide ritmo cardiaco, sueño y estrés con reportes claros para que tomes mejores decisiones cada día.',
        },
        {
          icon: 'BAT',
          title: 'Batería de alto rendimiento',
          description: 'Hasta 7 días de autonomía real para entrenar, trabajar y salir sin vivir pegado al cargador.',
        },
        {
          icon: 'FIT',
          title: 'Modo fitness profesional',
          description: 'Más de 100 perfiles deportivos con métricas en tiempo real y objetivos personalizados.',
        },
      ]}
      testimonials={[
        {
          name: 'Diego Arce',
          role: 'Runner amateur',
          avatar: 'https://i.pravatar.cc/100?img=68',
          quote: 'Ahora controlo mis entrenamientos y recuperación sin abrir mil apps. Muy preciso y rápido.',
          rating: 5,
        },
        {
          name: 'Lucía Prado',
          role: 'Marketing Manager',
          avatar: 'https://i.pravatar.cc/100?img=45',
          quote: 'El diseño se ve premium y las notificaciones me ayudan a mantener foco en reuniones.',
          rating: 5,
        },
        {
          name: 'Andrés Vaca',
          role: 'Usuario diario',
          avatar: 'https://i.pravatar.cc/100?img=12',
          quote: 'La batería dura de verdad. Lo uso todo el día y sigue respondiendo perfecto.',
          rating: 5,
        },
      ]}
      faq={[
        {
          question: '¿Es compatible con Android y iPhone?',
          answer: 'Sí, el Smartwatch Drenvex sincroniza con ambos sistemas mediante la app oficial.',
        },
        {
          question: '¿Resiste agua y sudor?',
          answer: 'Sí, tiene protección para uso diario, entrenamientos y lluvia ligera.',
        },
        {
          question: '¿Incluye garantía?',
          answer: 'Sí, cuenta con garantía por defectos de fábrica y soporte directo de Drenvex.',
        },
      ]}
    />
  )
}
