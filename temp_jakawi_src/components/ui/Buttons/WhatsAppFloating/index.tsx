import { useEffect, useState } from 'react'
import styles from './styles.module.css'

type WhatsAppFloatingProps = {
  enabled: boolean
  number: string
  message: string
}

export function WhatsAppFloating({ enabled, number, message }: WhatsAppFloatingProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setIsVisible(false)
      return
    }

    const timerId = window.setTimeout(() => {
      setIsVisible(true)
    }, 5000)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [enabled])

  const cleanNumber = number.replace(/\D+/g, '')
  if (!enabled || !isVisible || !cleanNumber) {
    return null
  }

  const href = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`

  return (
    <a
      className={styles.fab}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Abrir chat de WhatsApp"
      title="Contactar por WhatsApp"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
        <path d="M19.05 4.94A9.86 9.86 0 0 0 12.03 2c-5.48 0-9.95 4.46-9.95 9.95 0 1.75.46 3.46 1.32 4.97L2 22l5.24-1.37a9.93 9.93 0 0 0 4.79 1.22h.01c5.48 0 9.96-4.46 9.96-9.95a9.84 9.84 0 0 0-2.95-6.96Zm-7.02 15.22h-.01a8.25 8.25 0 0 1-4.2-1.14l-.3-.18-3.11.82.83-3.03-.2-.31a8.24 8.24 0 0 1-1.27-4.38c0-4.55 3.7-8.26 8.26-8.26a8.18 8.18 0 0 1 5.84 2.42 8.18 8.18 0 0 1 2.42 5.84c0 4.56-3.7 8.26-8.26 8.26Zm4.53-6.18c-.25-.12-1.47-.72-1.7-.8-.22-.08-.38-.12-.54.13s-.62.8-.76.96c-.14.17-.28.18-.53.06-.25-.13-1.04-.38-1.98-1.2-.73-.65-1.22-1.44-1.36-1.69s-.02-.38.1-.5c.1-.1.25-.28.37-.41.12-.14.16-.23.24-.39.08-.16.04-.3-.02-.42s-.54-1.3-.74-1.79c-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2 0 1.18.86 2.32.98 2.48.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.39.51.58.18 1.1.15 1.52.09.46-.07 1.47-.6 1.68-1.17.21-.57.21-1.06.14-1.17-.07-.1-.23-.16-.48-.28Z" />
      </svg>
      <span className={styles.label}>¿Tienes dudas?</span>
    </a>
  )
}

export type { WhatsAppFloatingProps }
