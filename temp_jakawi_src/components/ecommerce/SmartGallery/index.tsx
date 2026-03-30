import type { UIEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './styles.module.css'

type SmartGalleryProps = {
  images: string[]
  thumbnailPosition?: 'left' | 'bottom'
}

export function SmartGallery({ images, thumbnailPosition = 'bottom' }: SmartGalleryProps) {
  const mobileTrackRef = useRef<HTMLDivElement | null>(null)
  const safeImages = useMemo(() => images.filter((img) => typeof img === 'string' && img.trim() !== ''), [images])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mobileIndex, setMobileIndex] = useState(0)
  const desktopLayoutClass = `${styles.desktopLayout} ${
    thumbnailPosition === 'bottom' ? styles.desktopBottom : styles.desktopLeft
  }`

  useEffect(() => {
    if (!safeImages.length) {
      setSelectedIndex(0)
      setMobileIndex(0)
      return
    }

    if (selectedIndex > safeImages.length - 1) {
      setSelectedIndex(0)
    }
    if (mobileIndex > safeImages.length - 1) {
      setMobileIndex(0)
    }
  }, [mobileIndex, safeImages.length, selectedIndex])

  useEffect(() => {
    if (safeImages.length <= 1) {
      return
    }

    const interval = window.setInterval(() => {
      setSelectedIndex((prev) => (prev + 1) % safeImages.length)
      setMobileIndex((prev) => {
        const next = (prev + 1) % safeImages.length
        const container = mobileTrackRef.current
        if (container && container.clientWidth > 0) {
          container.scrollTo({ left: container.clientWidth * next, behavior: 'smooth' })
        }
        return next
      })
    }, 4000)

    return () => {
      window.clearInterval(interval)
    }
  }, [mobileIndex, safeImages.length, selectedIndex])

  if (!safeImages.length) {
    return null
  }

  const handleMobileScroll = (event: UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget
    const width = container.clientWidth || 1
    const nextIndex = Math.round(container.scrollLeft / width)
    const clamped = Math.max(0, Math.min(safeImages.length - 1, nextIndex))
    if (clamped !== mobileIndex) {
      setMobileIndex(clamped)
      setSelectedIndex(clamped)
    }
  }

  const scrollToMobileSlide = (index: number) => {
    const container = mobileTrackRef.current
    if (!container) {
      return
    }
    const left = container.clientWidth * index
    container.scrollTo({ left, behavior: 'smooth' })
    setMobileIndex(index)
    setSelectedIndex(index)
  }

  return (
    <section className={styles.root} aria-label="Galería de producto">
      <div className={desktopLayoutClass}>
        <div className={styles.thumbs}>
          {safeImages.map((src, index) => {
            const isActive = selectedIndex === index
            return (
              <button
                type="button"
                key={`${src}-${index}`}
                className={`${styles.thumbButton} ${isActive ? styles.thumbButtonActive : ''}`}
                onMouseEnter={() => {
                  setSelectedIndex(index)
                  setMobileIndex(index)
                }}
                onFocus={() => {
                  setSelectedIndex(index)
                  setMobileIndex(index)
                }}
                aria-label={`Ver imagen ${index + 1}`}
                aria-pressed={isActive}
              >
                <img className={styles.thumbImage} src={src} alt={`Miniatura ${index + 1}`} loading="lazy" />
              </button>
            )
          })}
        </div>
        <div className={styles.mainImageWrap}>
          <img
            className={styles.mainImage}
            src={safeImages[selectedIndex]}
            alt={`Imagen principal del producto ${selectedIndex + 1}`}
            loading="lazy"
          />
        </div>
      </div>

      <div className={styles.mobileLayout}>
        <div className={styles.mobileTrack} ref={mobileTrackRef} onScroll={handleMobileScroll}>
          {safeImages.map((src, index) => (
            <div key={`${src}-mobile-${index}`} className={styles.mobileSlide}>
              <img className={styles.mobileImage} src={src} alt={`Imagen móvil ${index + 1}`} loading="lazy" />
            </div>
          ))}
        </div>
        <div className={styles.dots} aria-hidden="true">
          {safeImages.map((src, index) => (
            <button
              type="button"
              key={`${src}-dot-${index}`}
              className={`${styles.dot} ${mobileIndex === index ? styles.dotActive : ''}`}
              onClick={() => scrollToMobileSlide(index)}
              aria-label={`Ir a imagen ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

export type { SmartGalleryProps }
