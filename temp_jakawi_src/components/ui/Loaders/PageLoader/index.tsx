import styles from './styles.module.css'

type PageLoaderProps = {
  bgColor: string
  spinnerColor: string
}

export function PageLoader({ bgColor, spinnerColor }: PageLoaderProps) {
  return (
    <div className={styles.overlay} style={{ backgroundColor: bgColor }} role="status" aria-live="polite" aria-label="Cargando contenido">
      <div className={styles.spinner} style={{ borderTopColor: spinnerColor, borderRightColor: `${spinnerColor}55` }} />
    </div>
  )
}

export type { PageLoaderProps }
