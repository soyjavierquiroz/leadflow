import type { LayoutTheme, TransformationGridBlockData } from './types'
import styles from './TransformationGridBlock.module.css'

type TransformationGridBlockProps = {
  data: TransformationGridBlockData
  theme?: LayoutTheme
}

function TransformationGridBlock({ data, theme = 'light' }: TransformationGridBlockProps) {
  const items = (data.items ?? []).filter((item): item is string => Boolean(item?.trim()))
  const themeClass = theme === 'dark' ? styles.themeDark : theme === 'orange' ? styles.themeOrange : styles.themeLight

  if (!items.length) {
    return null
  }

  return (
    <section className={`${styles.block} ${themeClass}`} aria-label="Transformation grid block">
      <h3 className={styles.headline}>{data.headline || 'Resultados que se notan en el dia a dia'}</h3>
      {data.subtitle ? <p className={styles.subtitle}>{data.subtitle}</p> : null}

      <div className={styles.grid}>
        {items.map((item, index) => (
          <article key={`${item}-${index}`} className={styles.card}>
            <span className={styles.index}>{index + 1}</span>
            <p>{item}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export { TransformationGridBlock }
export default TransformationGridBlock
