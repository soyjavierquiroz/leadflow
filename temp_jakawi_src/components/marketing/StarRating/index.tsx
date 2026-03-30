import styles from './styles.module.css'

type StarRatingProps = {
  rating: number
  count: number
}

type StarFill = 'full' | 'half' | 'empty'

function getStarFill(rating: number, position: number): StarFill {
  const diff = rating - position
  if (diff >= 1) {
    return 'full'
  }
  if (diff >= 0.5) {
    return 'half'
  }
  return 'empty'
}

export function StarRating({ rating, count }: StarRatingProps) {
  const safeRating = Math.max(0, Math.min(5, rating))
  const stars = Array.from({ length: 5 }, (_, index) => getStarFill(safeRating, index))

  return (
    <div className={styles.root} aria-label={`Calificación ${safeRating} de 5`}>
      <div className={styles.stars}>
        {stars.map((star, index) => (
          <span
            key={`star-${index}`}
            className={`${styles.star} ${star === 'full' ? styles.full : ''} ${star === 'half' ? styles.half : ''} ${star === 'empty' ? styles.empty : ''}`}
          >
            ★
          </span>
        ))}
      </div>
      <span className={styles.meta}>({count} Reseñas)</span>
    </div>
  )
}

export type { StarRatingProps }
