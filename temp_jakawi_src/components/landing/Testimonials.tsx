import styles from './Testimonials.module.css'

const testimonials = [
  {
    quote:
      'Lo compré para ver fútbol y películas en casa. La calidad es brutal y lo instalé en menos de 10 minutos.',
    name: 'Carlos Mendoza',
    role: 'Cliente verificado',
    avatar: 'https://i.pravatar.cc/100?img=11',
  },
  {
    quote:
      'Hacemos presentaciones con clientes y ahora todo se ve profesional. La imagen 4K sí marca diferencia.',
    name: 'Ana Rodríguez',
    role: 'Emprendedora',
    avatar: 'https://i.pravatar.cc/100?img=32',
  },
  {
    quote:
      'Pensé que sería complicado, pero funciona perfecto. Mi familia ahora arma cine en casa cada fin de semana.',
    name: 'Miguel Herrera',
    role: 'Usuario frecuente',
    avatar: 'https://i.pravatar.cc/100?img=59',
  },
]

export function Testimonials() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <h2 className={styles.title}>Clientes felices que ya transformaron su experiencia</h2>

        <div className={styles.grid}>
          {testimonials.map((item) => (
            <article className={styles.card} key={item.name}>
              <div className={styles.stars}>★★★★★</div>
              <p className={styles.quote}>{item.quote}</p>

              <div className={styles.user}>
                <img className={styles.avatar} src={item.avatar} alt={item.name} loading="lazy" />
                <div>
                  <p className={styles.name}>{item.name}</p>
                  <p className={styles.role}>{item.role}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
