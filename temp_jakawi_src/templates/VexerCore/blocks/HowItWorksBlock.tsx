import type { HowItWorksBlockData, HowItWorksStep, LayoutTheme } from './types'
import styles from './HowItWorksBlock.module.css'

type HowItWorksBlockProps = {
  data: HowItWorksBlockData
  theme?: LayoutTheme
}

type NormalizedStep = {
  title: string
  description?: string
}

function normalizeSteps(steps: HowItWorksStep[]): NormalizedStep[] {
  return steps
    .map((step, index) => {
      if (typeof step === 'string') {
        const title = step.trim()
        return title ? { title } : null
      }

      const title = step.title?.trim() || `Paso ${index + 1}`
      const description = step.description?.trim()
      return { title, description }
    })
    .filter((step): step is NormalizedStep => Boolean(step))
}

function HowItWorksBlock({ data, theme = 'light' }: HowItWorksBlockProps) {
  const steps = normalizeSteps(data.steps ?? [])
  const themeClass = theme === 'dark' ? styles.themeDark : theme === 'orange' ? styles.themeOrange : styles.themeLight

  if (!steps.length) {
    return null
  }

  return (
    <section className={`${styles.block} ${themeClass}`} aria-label="How it works block">
      <h3 className={styles.headline}>{data.headline || 'Como funciona'}</h3>
      {data.subtitle ? <p className={styles.subtitle}>{data.subtitle}</p> : null}

      <div className={styles.steps}>
        {steps.map((step, index) => (
          <article key={`${step.title}-${index}`} className={styles.stepCard}>
            <span className={styles.stepNumber}>{index + 1}</span>
            <div>
              <p className={styles.stepTitle}>{step.title}</p>
              {step.description ? <p className={styles.stepDescription}>{step.description}</p> : null}
            </div>
          </article>
        ))}
      </div>
      {data.tip ? <p className={styles.tip}>{data.tip}</p> : null}
    </section>
  )
}

export { HowItWorksBlock }
export default HowItWorksBlock
