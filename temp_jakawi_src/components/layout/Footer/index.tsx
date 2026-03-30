import styles from './styles.module.css'

type FooterProps = {
  variant?: 'orange' | 'dark' | 'theme'
}

export function Footer({ variant = 'orange' }: FooterProps) {
  let variantClass = styles.orange
  if (variant === 'dark') {
    variantClass = styles.dark
  } else if (variant === 'theme') {
    variantClass = styles.theme
  }

  return (
    <footer className={`${styles.footer} ${variantClass}`}>
      <p className={styles.copy}>© 2026 Todos los derechos reservados.</p>
      <nav className={styles.links} aria-label="Enlaces legales">
        <a href="#" className={styles.link}>
          Políticas de Privacidad
        </a>
        <span className={styles.separator}>|</span>
        <a href="#" className={styles.link}>
          Términos de Servicio
        </a>
      </nav>
    </footer>
  )
}
