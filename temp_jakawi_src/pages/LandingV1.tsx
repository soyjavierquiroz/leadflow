import { VexerCyber } from '../templates/VexerCyber'

export function LandingV1() {
  return (
    <VexerCyber
      badge="Proyector 4K Premium"
      title="Convierte tu sala en un cine Full 4K esta misma semana"
      subtitle="Imagen ultra nitida, sonido inmersivo y configuracion en minutos. Ideal para peliculas, gaming y presentaciones profesionales."
      price="Bs 500"
      priceHint="Oferta de lanzamiento por tiempo limitado"
      ctaText="Quiero Mi Proyector Ahora"
      heroImage="/images/placeholder-product.svg"
      heroImageAlt="Proyector 4K en sala moderna"
      features={[
        {
          icon: '4K',
          title: 'Calidad Ultra HD Real',
          description: 'Disfruta colores vivos y maxima nitidez en cada escena, incluso en espacios amplios.',
        },
        {
          icon: 'FX',
          title: 'Instalacion en 5 Minutos',
          description: 'Conecta y reproduce con HDMI, USB o streaming inalambrico sin configuraciones complejas.',
        },
        {
          icon: 'AUD',
          title: 'Audio Potente Integrado',
          description: 'Sonido envolvente para peliculas, videojuegos y reuniones sin equipos extra.',
        },
      ]}
      testimonials={[
        {
          name: 'Carlos Mendoza',
          role: 'Cliente verificado',
          avatar: 'https://i.pravatar.cc/100?img=11',
          quote: 'La calidad es brutal y lo instale en menos de 10 minutos.',
          rating: 5,
        },
        {
          name: 'Ana Rodriguez',
          role: 'Emprendedora',
          avatar: 'https://i.pravatar.cc/100?img=32',
          quote: 'Ahora mis presentaciones se ven profesionales y mucho mas claras.',
          rating: 5,
        },
        {
          name: 'Miguel Herrera',
          role: 'Usuario frecuente',
          avatar: 'https://i.pravatar.cc/100?img=59',
          quote: 'Mi familia arma cine en casa cada fin de semana. Gran compra.',
          rating: 5,
        },
      ]}
      faq={[
        {
          question: 'Que incluye la compra del Proyector 4K?',
          answer: 'Incluye proyector, cable de energia, control remoto y guia rapida de instalacion.',
        },
        {
          question: 'Puedo conectarlo a mi laptop o consola?',
          answer: 'Si, es compatible con HDMI, USB y dispositivos de streaming.',
        },
        {
          question: 'Cuanto tarda el envio?',
          answer: 'En ciudades principales suele tardar entre 24 y 72 horas habiles.',
        },
      ]}
    />
  )
}
