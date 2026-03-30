import type { FinalCTABlockData, LayoutTheme } from './types'
import type { CtaClickHandler } from '../../types'
import styles from './FinalCTABlock.module.css'

type FinalCTABlockProps = {
  data: FinalCTABlockData
  theme?: LayoutTheme
  onCtaClick?: CtaClickHandler
  ctaClassName?: string
  ctaTitleClassName?: string
  ctaSubClassName?: string
}

function FinalCTABlock({
  data,
  theme = 'light',
  onCtaClick,
  ctaClassName,
  ctaTitleClassName,
  ctaSubClassName,
}: FinalCTABlockProps) {
  const buttonText = data.button_text || data.cta_text || 'Confirmar pedido ahora'
  const buttonSubtext = data.subtext || 'Pago contra entrega + envio gratis'
  const subtitle = data.subtitle || data.subheadline
  const themeClass = theme === 'dark' ? styles.themeDark : theme === 'orange' ? styles.themeOrange : styles.themeLight
  const themedCtaClass =
    theme === 'dark'
      ? `${styles.ctaButton} ${styles.ctaButtonDark}`
      : theme === 'orange'
      ? `${styles.ctaButton} ${styles.ctaButtonOrange}`
      : `${styles.ctaButton} ${styles.ctaButtonLight}`

  return (
    <section className={`${styles.block} ${themeClass}`} aria-label="Final CTA block">
      <h3 className={styles.headline}>{data.headline || 'Listo para dar el siguiente paso?'}</h3>
      {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}

      <button type="button" className={ctaClassName || themedCtaClass} onClick={() => onCtaClick?.()}>
        <span className={ctaTitleClassName || styles.ctaTitle}>{buttonText}</span>
        <span className={ctaSubClassName || styles.ctaSub}>{buttonSubtext}</span>
      </button>
    </section>
  )
}

export { FinalCTABlock }
export default FinalCTABlock
