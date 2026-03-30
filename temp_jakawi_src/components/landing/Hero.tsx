import styles from './Hero.module.css'

export function Hero() {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div>
          <span className={styles.badge}>Proyector 4K Premium</span>
          <h1 className={styles.title}>Convierte tu sala en un cine Full 4K esta misma semana</h1>
          <p className={styles.subtitle}>
            Imagen ultra nítida, sonido inmersivo y configuración en minutos. Ideal para películas, gaming y presentaciones
            profesionales sin gastar una fortuna.
          </p>

          <div className={styles.priceWrap}>
            <span className={styles.price}>Bs 500</span>
            <span className={styles.priceHint}>Oferta de lanzamiento por tiempo limitado</span>
          </div>

          <button type="button" className={styles.cta}>
            Quiero Mi Proyector Ahora
          </button>
        </div>

        <div className={styles.right}>
          <img
            className={styles.image}
            src="/images/placeholder-product.svg"
            alt="Proyector 4K en sala moderna"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  )
}
