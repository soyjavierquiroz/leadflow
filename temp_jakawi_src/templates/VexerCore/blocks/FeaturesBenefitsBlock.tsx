import type { FeatureBenefitItem, FeaturesBenefitsBlockData, LayoutTheme } from './types'
import styles from './FeaturesBenefitsBlock.module.css'

type FeaturesBenefitsBlockProps = {
  data: FeaturesBenefitsBlockData
  theme?: LayoutTheme
}

function normalizeItems(data: FeaturesBenefitsBlockData): FeatureBenefitItem[] {
  const source = data.features?.length ? data.features : data.items ?? []

  return source.filter((item) => {
    return Boolean(item?.feature?.trim() || item?.benefit?.trim())
  })
}

function FeaturesBenefitsBlock({ data, theme = 'light' }: FeaturesBenefitsBlockProps) {
  const items = normalizeItems(data)
  const themeClass = theme === 'dark' ? styles.themeDark : theme === 'orange' ? styles.themeOrange : styles.themeLight

  if (!items.length) {
    return null
  }

  return (
    <section className={`${styles.block} ${themeClass}`} aria-label="Features and benefits block">
      <h3 className={styles.headline}>{data.headline || 'Caracteristicas que se traducen en beneficios reales'}</h3>
      {data.subtitle ? <p className={styles.subtitle}>{data.subtitle}</p> : null}

      <div className={styles.grid}>
        {items.map((item, index) => (
          <article key={`${item.feature || item.benefit}-${index}`} className={styles.row}>
            <p className={styles.feature}>{item.feature || 'Caracteristica'}</p>
            <p className={styles.benefit}>{item.benefit || 'Beneficio'}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export { FeaturesBenefitsBlock }
export default FeaturesBenefitsBlock
