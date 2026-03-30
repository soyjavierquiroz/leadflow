import styles from './styles.module.css'

type MarqueeProps = {
  enabled: boolean
  text: string
  bg_color: string
  text_color: string
  variant?: 'orange' | 'dark' | 'clean'
}

export function Marquee({ enabled, text, bg_color, text_color, variant = 'orange' }: MarqueeProps) {
  if (!enabled) {
    return null
  }

  let themeClass = styles.orange
  if (variant === 'dark') {
    themeClass = styles.dark
  } else if (variant === 'clean') {
    themeClass = styles.clean
  }

  const safeBgColor = (bg_color ?? '').trim()
  const safeTextColor = (text_color ?? '').trim()
  const inlineTheme =
    safeBgColor !== '' || safeTextColor !== ''
      ? {
          backgroundColor: safeBgColor,
          color: safeTextColor,
        }
      : undefined

  return (
    <section className={`${styles.wrapper} ${themeClass}`} style={inlineTheme} aria-label="Oferta destacada">
      <div className={styles.marqueeTrack}>
        <span className={styles.item}>{text}</span>
        <span className={styles.item} aria-hidden="true">
          {text}
        </span>
      </div>
    </section>
  )
}

export type { MarqueeProps }
