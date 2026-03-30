import { VexerAura } from '../templates/VexerAura'

export function RelojPremium() {
  return (
    <VexerAura
      badge="Smartwatch Drenvex X"
      title="Controla tu salud, tus metas y tu estilo desde tu muñeca"
      subtitle="El nuevo Smartwatch Drenvex combina monitoreo avanzado, batería de larga duración y diseño premium para acompañarte todo el día."
      price="Bs 699"
      priceHint="Edición cyber con stock limitado"
      ctaText="Activar Oferta Cyber"
      heroImage="/images/placeholder-product.svg"
      heroImageAlt="Smartwatch Drenvex en estilo cyber"
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
