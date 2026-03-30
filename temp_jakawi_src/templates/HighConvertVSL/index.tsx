import { SmartGallery } from '../../components/ecommerce/SmartGallery'
import { Footer } from '../../components/layout/Footer'
import { Marquee } from '../../components/marketing/Marquee'
import { StickyMobileCTA } from '../../components/ui/Buttons/StickyMobileCTA'
import { WhatsAppFloating } from '../../components/ui/Buttons/WhatsAppFloating'
import type { LandingTemplateProps, UIConfig } from '../types'
import { type HeroBlockData, isLayoutBlock, type LayoutBlock } from '../VexerCore/blocks/types'
import { LayoutBlocksRenderer } from '../shared/LayoutBlocksRenderer'
import { TRANSPORT_CTA_TEXT, scrollToBovedaOffers } from '../shared/ctaFlow'
import { resolveMedia } from '../../utils/mediaResolver'
import { BenefitBullets } from './BenefitBullets'
import type { BenefitBullet } from './BenefitBullets'
import { ComparisonTable } from './ComparisonTable'
import type { ComparisonRow } from './ComparisonTable'
import { TheStack } from './TheStack'
import type { StackItem } from './TheStack'
import { VSLHero } from './VSLHero'
import styles from './styles.module.css'

type ProductLike = {
  slug?: string
  media_folder?: string
  media_dictionary?: Record<string, string>
  template?: string
  layout_blocks?: LayoutBlock[]
  name?: string
  title?: string
  description?: string
  short_description?: string
  wc?: {
    slug?: string
    name?: string
    description?: string
    short_description?: string
  }
  vexer_custom?: {
    descripcion?: string
  }
}

export type HighConvertVSLProps = Partial<LandingTemplateProps> & {
  uiConfig?: UIConfig
  vexer?: unknown
  product?: unknown
  headline?: string
  subheadline?: string
  videoUrl?: string
  comparisonTitle?: string
  comparisonRows?: ComparisonRow[]
  benefitsTitle?: string
  benefitItems?: BenefitBullet[]
  stackTitle?: string
  stackItems?: StackItem[]
  totalLabel?: string
  totalValue?: string
  guaranteeText?: string
}

export function HighConvertVSL(props: HighConvertVSLProps) {
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
  const cdnGalleryImages = hasMediaDictionary ? dictionaryGalleryImages : legacyGalleryImages

  const resolvedHeadline =
    heroBlockData?.headline || props.headline || props.title || productData.name || productData.title || productData.wc?.name || ''
  const resolvedSubheadline =
    heroBlockData?.subheadline ||
    props.subheadline ||
    props.subtitle ||
    productData.vexer_custom?.descripcion ||
    productData.short_description ||
    productData.wc?.short_description ||
    ''
  const handleTransportCtaClick = () => {
    if (hasBovedaBlock) {
      scrollToBovedaOffers()
      return
    }

    props.onCtaClick?.()
  }

  if (contentBlocks.length > 0) {
    return (
      <main className={styles.page}>
        <Marquee {...marqueeConfig} />

        <section className={styles.hero}>
          <div className={styles.container}>
            {resolvedHeadline ? <h1 className={styles.headline}>{resolvedHeadline}</h1> : null}
            {resolvedSubheadline ? <p className={styles.subheadline}>{resolvedSubheadline}</p> : null}
            <div className={styles.videoWrap}>
              <SmartGallery images={cdnGalleryImages} thumbnailPosition="bottom" />
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.container}>
            <LayoutBlocksRenderer
              blocks={contentBlocks}
              product={productData}
              onCtaClick={handleTransportCtaClick}
              onBovedaCtaClick={props.onCtaClick}
              theme="dark"
              mediaDictionary={mediaDictionary}
            />
          </div>
        </section>

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

  const comparisonRows = props.comparisonRows ?? []
  const benefitItems = props.benefitItems ?? []
  const stackItems = props.stackItems ?? []

  return (
    <main className={styles.page}>
      <VSLHero
        headline={props.headline || resolvedHeadline}
        subheadline={props.subheadline || resolvedSubheadline}
        videoUrl={props.videoUrl || 'https://www.youtube.com/embed/dQw4w9WgXcQ'}
      />
      <ComparisonTable title={props.comparisonTitle} rows={comparisonRows} />
      <BenefitBullets title={props.benefitsTitle} items={benefitItems} />
      <TheStack
        title={props.stackTitle}
        items={stackItems}
        totalLabel={props.totalLabel}
        totalValue={props.totalValue || 'N/D'}
        ctaText={props.ctaText || 'QUIERO MI OFERTA'}
        guaranteeText={props.guaranteeText || 'Garantía de satisfacción'}
        onCtaClick={props.onCtaClick}
      />
    </main>
  )
}

export type { BenefitBullet, ComparisonRow, StackItem }
