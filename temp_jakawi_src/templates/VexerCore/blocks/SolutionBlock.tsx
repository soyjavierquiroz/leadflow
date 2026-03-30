import type { LayoutTheme, SolutionPresentationBlockData } from './types'
import styles from './SolutionBlock.module.css'

type SolutionBlockProps = {
  data: SolutionPresentationBlockData
  theme?: LayoutTheme
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.4 12.3 2.3 2.3 4.9-5" />
    </svg>
  )
}

function SolutionBlock({ data, theme = 'light' }: SolutionBlockProps) {
  const benefits = (data.benefits ?? []).filter((item): item is string => Boolean(item?.trim()))
  const themeClass = theme === 'dark' ? styles.themeDark : theme === 'orange' ? styles.themeOrange : styles.themeLight

  return (
    <section className={`${styles.block} ${themeClass}`} aria-label="Solution presentation block">
      <h3 className={styles.headline}>{data.headline || 'Solucion practica para tu rutina diaria'}</h3>
      {data.subtitle ? <p className={styles.subtitle}>{data.subtitle}</p> : null}

      {benefits.length > 0 ? (
        <ul className={styles.list}>
          {benefits.map((benefit, index) => (
            <li key={`${benefit}-${index}`} className={styles.item}>
              <CheckIcon />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {data.footer_note ? <p className={styles.footer}>{data.footer_note}</p> : null}
    </section>
  )
}

export { SolutionBlock }
export default SolutionBlock
