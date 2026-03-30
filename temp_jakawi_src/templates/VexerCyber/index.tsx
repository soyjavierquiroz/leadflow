import { useState } from 'react'
import { SmartGallery } from '../../components/ecommerce/SmartGallery'
import { Footer } from '../../components/layout/Footer'
import { Marquee } from '../../components/marketing/Marquee'
import { StarRating } from '../../components/marketing/StarRating'
import { StickyMobileCTA } from '../../components/ui/Buttons/StickyMobileCTA'
import { WhatsAppFloating } from '../../components/ui/Buttons/WhatsAppFloating'
import type { LandingTemplateProps, UIConfig } from '../types'
import { type HeroBlockData, isLayoutBlock, type LayoutBlock } from '../VexerCore/blocks/types'
import { LayoutBlocksRenderer } from '../shared/LayoutBlocksRenderer'
import { TRANSPORT_CTA_TEXT, scrollToBovedaOffers } from '../shared/ctaFlow'
import { resolveMedia } from '../../utils/mediaResolver'
import styles from './styles.module.css'

function stars(rating?: number): string {
  const safe = Math.max(1, Math.min(5, rating ?? 5))
  return '★'.repeat(safe)
}

type ProductLike = {
  slug?: string
  media_folder?: string
  media_dictionary?: Record<string, string>
  template?: string
  layout_blocks?: LayoutBlock[]
  name?: string
  title?: string
  price?: string | number
  vexer_price?: string | number
  description?: string
  short_description?: string
  wc?: {
    slug?: string
    name?: string
    description?: string
    short_description?: string
    price_regular?: string | number
    price_sale?: string | number
  }
  vexer_custom?: {
    precio_final?: string | number
    descripcion?: string
  }
}

function formatPrice(value: string | number | null | undefined, fallback: string): string {
  if (value === null || value === undefined) {
    return fallback
  }

  const raw = String(value).trim()
  if (!raw) {
    return fallback
  }

  if (/^(bs\.?|bob|\$|usd|eur)/i.test(raw)) {
    return raw
  }

  if (/^-?\d+([.,]\d+)?$/.test(raw)) {
    return `Bs. ${raw}`
  }

  return raw
}

type TemplateVexerCyberProps = LandingTemplateProps & {
  uiConfig?: UIConfig
  vexer?: unknown
  product?: unknown
}

function TemplateVexerCyber(props: TemplateVexerCyberProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number>(0)
  const marqueeConfig = props.uiConfig?.marquee ?? {
    enabled: false,
    text: '',
    bg_color: '#000000',
    text_color: '#ffffff',
  }
  const whatsappConfig = props.uiConfig?.whatsapp ?? {
    enabled: false,
    number: '',
    message: '',
  }
  const stickyCtaConfig = props.uiConfig?.sticky_cta ?? {
    enabled: false,
    text: '',
  }

  const productData = (props.product ?? {}) as ProductLike
  const product = productData
  const safeLayoutBlocks = (product?.layout_blocks || []).filter(isLayoutBlock)
  const heroBlockData = safeLayoutBlocks.find((block): block is HeroBlockData => block.type === 'hero_block')
  const contentBlocks = safeLayoutBlocks.filter((block) => block.type !== 'hero_block')
  const hasBovedaBlock = contentBlocks.some((block) => block.type === 'boveda_dinamica')

  const rawUrlPath = typeof window !== 'undefined' ? window.location.pathname : ''
  const urlSlug = rawUrlPath.split('/').filter(Boolean).pop() || ''
  const rawMediaFolder = product?.media_folder || product?.wc?.slug || product?.slug || urlSlug || ''
  const mediaFolder = String(rawMediaFolder).trim().replace(/[\?#].*$/, '').replace(/^\/+|\/+$/g, '') || 'proyector-4k'
  const mediaDictionary = productData.media_dictionary ?? {}
  const hasMediaDictionary = Object.keys(mediaDictionary).length > 0
  const CDN_BASE = `https://cdn.jakawi.store/media/products/${mediaFolder}`
  const legacyGalleryImages = [`${CDN_BASE}/hero.webp`, `${CDN_BASE}/gallery-1.webp`, `${CDN_BASE}/gallery-2.webp`, `${CDN_BASE}/gallery-3.webp`]
  const dictionaryGalleryImages = ['hero', 'gallery_1', 'gallery_2', 'gallery_3', 'gallery_4', 'gallery_5', 'gallery_6', 'product_box']
    .map((key) => resolveMedia(key, mediaDictionary, false))
    .filter((item) => Boolean(item?.trim()))
  const galleryImages = hasMediaDictionary ? dictionaryGalleryImages : legacyGalleryImages

  const resolvedTitle =
    heroBlockData?.headline ||
    heroBlockData?.product_name ||
    productData.name ||
    productData.title ||
    productData.wc?.name ||
    props.title
  const preferredPrice = heroBlockData?.price ?? productData.vexer_price ?? productData.vexer_custom?.precio_final
  const fallbackPrice = productData.price ?? productData.wc?.price_sale ?? productData.wc?.price_regular
  const resolvedPrice = formatPrice(preferredPrice ?? fallbackPrice, props.price)
  const resolvedSubtitle =
    heroBlockData?.subheadline ||
    productData.vexer_custom?.descripcion ||
    productData.short_description ||
    productData.wc?.short_description ||
    props.subtitle
  const resolvedDescriptionHtml =
    productData.vexer_custom?.descripcion ||
    productData.description ||
    productData.short_description ||
    productData.wc?.description ||
    props.subtitle

  const features = props.features ?? []
  const testimonials = props.testimonials ?? []
  const faq = props.faq ?? []
  const hasCtaText = typeof props.ctaText === 'string' && props.ctaText.trim() !== ''
  const handleTransportCtaClick = () => {
    if (hasBovedaBlock) {
      scrollToBovedaOffers()
      return
    }

    props.onCtaClick?.()
  }

  return (
    <main className={styles.page}>
      <Marquee {...marqueeConfig} />

      <section className={styles.heroSection}>
        <div className={styles.container}>
          <div className={styles.heroGrid}>
            <div className={styles.heroInfo}>
              {props.badge ? <span className={styles.badge}>{props.badge}</span> : null}
              <h1 className={styles.heroTitle}>{resolvedTitle}</h1>
              <StarRating rating={4.8} count={35} />
              <p className={styles.heroSubtitle}>{resolvedSubtitle}</p>

              <div className={styles.priceWrap}>
                <span className={styles.price}>{resolvedPrice}</span>
                {props.priceHint ? <span className={styles.priceHint}>{props.priceHint}</span> : null}
              </div>

              {hasCtaText ? (
                <button type="button" className={styles.cta} onClick={handleTransportCtaClick}>
                  {hasBovedaBlock ? TRANSPORT_CTA_TEXT : props.ctaText}
                </button>
              ) : null}

              <div className={styles.benefitsMock}>
                <h3>Descripcion del producto</h3>
                <div className={styles.benefitsMockContent} dangerouslySetInnerHTML={{ __html: resolvedDescriptionHtml }} />
              </div>
            </div>

            <div className={styles.heroMedia}>
              <div className={styles.imageWrap}>
                <SmartGallery images={galleryImages} thumbnailPosition="left" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {contentBlocks.length > 0 ? (
        <section className={styles.section}>
          <div className={styles.container}>
            <LayoutBlocksRenderer
              blocks={contentBlocks}
              product={productData}
              onCtaClick={handleTransportCtaClick}
              onBovedaCtaClick={props.onCtaClick}
              theme="orange"
              mediaDictionary={mediaDictionary}
            />
          </div>
        </section>
      ) : (
        <>
          {features.length > 0 ? (
            <section className={styles.section}>
              <div className={styles.container}>
                <h2 className={styles.sectionTitle}>Beneficios clave</h2>
                <div className={styles.featuresGrid}>
                  {features.map((feature) => (
                    <article key={feature.title} className={styles.featureCard}>
                      <span className={styles.featureIcon}>{feature.icon ?? '✓'}</span>
                      <h3 className={styles.cardTitle}>{feature.title}</h3>
                      <p className={styles.cardText}>{feature.description}</p>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {testimonials.length > 0 ? (
            <section className={`${styles.section} ${styles.testimonialsSection}`}>
              <div className={styles.container}>
                <h2 className={styles.sectionTitle}>Lo que dicen nuestros clientes</h2>
                <div className={styles.testimonialsGrid}>
                  {testimonials.map((item) => (
                    <article key={`${item.name}-${item.role}`} className={styles.testimonialCard}>
                      <div className={styles.stars}>{stars(item.rating)}</div>
                      <p className={styles.quote}>{item.quote}</p>
                      <div className={styles.user}>
                        <img className={styles.avatar} src={item.avatar} alt={item.name} loading="lazy" />
                        <div>
                          <p className={styles.userName}>{item.name}</p>
                          <p className={styles.userRole}>{item.role}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {faq.length > 0 ? (
            <section className={styles.section}>
              <div className={styles.container}>
                <h2 className={styles.sectionTitle}>Preguntas frecuentes</h2>
                <div className={styles.faqList}>
                  {faq.map((item, index) => {
                    const isOpen = openFaqIndex === index
                    return (
                      <article key={item.question} className={styles.faqItem}>
                        <button
                          type="button"
                          className={styles.faqTrigger}
                          aria-expanded={isOpen}
                          onClick={() => setOpenFaqIndex((prev) => (prev === index ? -1 : index))}
                        >
                          <span>{item.question}</span>
                          <span>{isOpen ? '−' : '+'}</span>
                        </button>
                        {isOpen ? <p className={styles.faqAnswer}>{item.answer}</p> : null}
                      </article>
                    )
                  })}
                </div>
              </div>
            </section>
          ) : null}
        </>
      )}

      <Footer />
      <WhatsAppFloating {...whatsappConfig} />
      <StickyMobileCTA
        {...stickyCtaConfig}
        text={hasBovedaBlock ? TRANSPORT_CTA_TEXT : stickyCtaConfig.text}
        onClick={handleTransportCtaClick}
      />
    </main>
  )
}

export { TemplateVexerCyber, TemplateVexerCyber as VexerCyber }
export type { TemplateVexerCyberProps }
export default TemplateVexerCyber
