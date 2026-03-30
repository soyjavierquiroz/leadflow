import styles from './Features.module.css'

const features = [
  {
    icon: '4K',
    title: 'Calidad Ultra HD Real',
    text: 'Disfruta colores vivos y máxima nitidez en cada escena, incluso en espacios amplios.',
  },
  {
    icon: '⚡',
    title: 'Instalación en 5 Minutos',
    text: 'Conecta y reproduce con HDMI, USB o streaming inalámbrico sin configuraciones complejas.',
  },
  {
    icon: '🔊',
    title: 'Audio Potente Integrado',
    text: 'Sonido envolvente para películas, videojuegos y reuniones sin necesidad de equipos extra.',
  },
]

export function Features() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <h2 className={styles.title}>Lo que hace especial a este Proyector 4K</h2>
        <p className={styles.subtitle}>
          Diseñado para quienes quieren una experiencia premium en casa o en su negocio, sin complicarse con equipos caros.
        </p>

        <div className={styles.grid}>
          {features.map((item) => (
            <article key={item.title} className={styles.card}>
              <span className={styles.icon}>{item.icon}</span>
              <h3 className={styles.cardTitle}>{item.title}</h3>
              <p className={styles.cardText}>{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
