import type { FAQAccordionBlockData, FAQItem, LayoutTheme } from './types'
import styles from './FAQAccordionBlock.module.css'

type FAQAccordionBlockProps = {
  data: FAQAccordionBlockData
  theme?: LayoutTheme
}

type NormalizedFaqItem = {
  question: string
  answer: string
}

function normalizeFaqs(faqs: FAQItem[]): NormalizedFaqItem[] {
  return faqs
    .map((item) => {
      const question = item.question?.trim() || item.q?.trim()
      const answer = item.answer?.trim() || item.a?.trim()

      if (!question || !answer) {
        return null
      }

      return { question, answer }
    })
    .filter((item): item is NormalizedFaqItem => Boolean(item))
}

function FAQAccordionBlock({ data, theme = 'light' }: FAQAccordionBlockProps) {
  const faqs = normalizeFaqs(data.faqs ?? [])
  const themeClass = theme === 'dark' ? styles.themeDark : theme === 'orange' ? styles.themeOrange : styles.themeLight

  if (!faqs.length) {
    return null
  }

  return (
    <section className={`${styles.block} ${themeClass}`} aria-label="FAQ accordion block">
      <h3 className={styles.headline}>{data.headline || 'Preguntas frecuentes'}</h3>
      {data.subtitle ? <p className={styles.subtitle}>{data.subtitle}</p> : null}

      <div className={styles.items}>
        {faqs.map((faq, index) => (
          <details key={`${faq.question}-${index}`} className={styles.item}>
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

export { FAQAccordionBlock }
export default FAQAccordionBlock
