import { useEffect, useState } from 'react'
import styles from './styles.module.css'

type StickyMobileCTAProps = {
  enabled: boolean
  text: string
  onClick?: () => void
}

export function StickyMobileCTA({ enabled, text, onClick }: StickyMobileCTAProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setIsVisible(false)
      return
    }

    const handleScroll = () => {
      setIsVisible(window.scrollY > 400)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [enabled])

  if (!enabled) {
    return null
  }

  return (
    <div className={`${styles.stickyBar} ${isVisible ? styles.visible : styles.hidden}`}>
      <div className={styles.inner}>
        <button type="button" className={styles.button} onClick={onClick}>
          <span className={styles.title}>{text}</span>
          <span className={styles.subtitle}>Paga al Recibir + Envio Gratuito</span>
        </button>
      </div>
    </div>
  )
}

export type { StickyMobileCTAProps }
