import styles from './styles.module.css'
import type { CtaClickHandler } from '../types'

export type StackItem = {
  name: string
  comparePrice: string
}

type TheStackProps = {
  title?: string
  items: StackItem[]
  totalLabel?: string
  totalValue: string
  ctaText: string
  guaranteeText: string
  onCtaClick?: CtaClickHandler
}

export function TheStack({
  title = 'Lo que te llevas hoy',
  items,
  totalLabel = 'Hoy pagas:',
  totalValue,
  ctaText,
  guaranteeText,
  onCtaClick,
}: TheStackProps) {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.stackCard}>
          <h3 className={styles.stackTitle}>{title}</h3>
          <ul className={styles.stackList}>
            {items.map((item) => (
              <li key={`${item.name}-${item.comparePrice}`} className={styles.stackItem}>
                <span className={styles.stackItemName}>{item.name}</span>
                <span className={styles.stackItemPrice}>{item.comparePrice}</span>
              </li>
            ))}
          </ul>

          <p className={styles.stackTotal}>
            {totalLabel} <span className={styles.stackTotalValue}>{totalValue}</span>
          </p>

          <button type="button" className={styles.bigCta} onClick={() => onCtaClick?.()}>
            {ctaText}
          </button>

          <p className={styles.guarantee}>{guaranteeText}</p>
        </div>
      </div>
    </section>
  )
}
