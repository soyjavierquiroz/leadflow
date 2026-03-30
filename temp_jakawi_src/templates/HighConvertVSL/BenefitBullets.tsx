import styles from './styles.module.css'

export type BenefitBullet = {
  icon?: string
  text: string
}

type BenefitBulletsProps = {
  title?: string
  items: BenefitBullet[]
}

export function BenefitBullets({ title = 'Por que esto te conviene hoy', items }: BenefitBulletsProps) {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        <div className={styles.benefitsGrid}>
          {items.map((item) => (
            <article key={item.text} className={styles.benefitItem}>
              <span className={styles.benefitIcon}>{item.icon ?? '✓'}</span>
              <p className={styles.benefitText}>{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
