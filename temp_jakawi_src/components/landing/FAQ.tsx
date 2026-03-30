import { useState } from 'react'
import styles from './FAQ.module.css'

const faqItems = [
  {
    q: '¿Qué incluye la compra del Proyector 4K?',
    a: 'Incluye proyector, cable de energía, control remoto, manual rápido y soporte de configuración inicial.',
  },
  {
    q: '¿Puedo conectarlo a mi laptop o consola?',
    a: 'Sí. Es compatible con HDMI, USB y dispositivos de streaming para usarlo con laptop, PlayStation, Xbox o TV Box.',
  },
  {
    q: '¿Cuánto tarda el envío?',
    a: 'En ciudades principales de Bolivia suele tardar entre 24 y 72 horas hábiles según disponibilidad y logística.',
  },
  {
    q: '¿Tiene garantía?',
    a: 'Sí, cuenta con garantía por defectos de fábrica. Nuestro equipo de soporte te acompaña durante todo el proceso.',
  },
]

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number>(0)

  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <h2 className={styles.title}>Preguntas frecuentes</h2>

        <div className={styles.list}>
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index
            return (
              <article key={item.q} className={styles.item}>
                <button
                  type="button"
                  className={styles.trigger}
                  aria-expanded={isOpen}
                  onClick={() => setOpenIndex((prev) => (prev === index ? -1 : index))}
                >
                  <span>{item.q}</span>
                  <span className={styles.icon}>{isOpen ? '−' : '+'}</span>
                </button>
                {isOpen ? <p className={styles.content}>{item.a}</p> : null}
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
