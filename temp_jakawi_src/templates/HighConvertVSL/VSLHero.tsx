import styles from './styles.module.css'

type VSLHeroProps = {
  headline: string
  subheadline: string
  videoUrl: string
}

export function VSLHero({ headline, subheadline, videoUrl }: VSLHeroProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.container}>
        <h1 className={styles.headline}>{headline}</h1>
        <h2 className={styles.subheadline}>{subheadline}</h2>
        <div className={styles.videoWrap}>
          <iframe
            className={styles.videoFrame}
            src={videoUrl}
            title="Video de ventas"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  )
}
