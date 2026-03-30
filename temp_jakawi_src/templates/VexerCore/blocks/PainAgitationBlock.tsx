import type { LayoutTheme, PainAgitationBlockData } from './types'
import styles from './PainAgitationBlock.module.css'

type PainAgitationBlockProps = {
  data: PainAgitationBlockData
  theme?: LayoutTheme
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
      <path d="M12 3 2.8 20.5h18.4L12 3Z" />
      <path d="M12 8.5v5.5" />
      <circle cx="12" cy="17.3" r="0.9" />
    </svg>
  )
}

function PainAgitationBlock({ data, theme = 'light' }: PainAgitationBlockProps) {
  const painPoints = (data.pain_points ?? []).filter((item): item is string => Boolean(item?.trim()))
  const themeClass = theme === 'dark' ? styles.themeDark : theme === 'orange' ? styles.themeOrange : styles.themeLight

  return (
    <section className={`${styles.block} ${themeClass}`} aria-label="Pain agitation block">
      <h3 className={styles.headline}>{data.headline || 'Problema comun que nadie explica bien'}</h3>
      {data.description ? <p className={styles.description}>{data.description}</p> : null}

      {painPoints.length > 0 ? (
        <ul className={styles.list}>
          {painPoints.map((point, index) => (
            <li key={`${point}-${index}`} className={styles.item}>
              <WarningIcon />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {data.closing_thought ? <p className={styles.closingThought}>{data.closing_thought}</p> : null}
    </section>
  )
}

export { PainAgitationBlock }
export default PainAgitationBlock
