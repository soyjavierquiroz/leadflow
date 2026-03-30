export type LandingFeature = {
  icon?: string
  title: string
  description: string
}

export type LandingTestimonial = {
  name: string
  role: string
  avatar: string
  quote: string
  rating?: number
}

export type LandingFaq = {
  question: string
  answer: string
}

export type CtaSelectionPayload = {
  selectedOffer?: unknown
  source?: 'boveda' | 'legacy' | 'manual' | 'exit-offer'
}

export type CtaClickHandler = (quantity?: number, bundlePrice?: string | number, selection?: CtaSelectionPayload) => void

export type LandingTemplateProps = {
  badge?: string
  title: string
  subtitle: string
  price: string
  priceHint?: string
  ctaText: string
  heroImage: string
  heroImageAlt?: string
  galleryImages?: string[]
  features: LandingFeature[]
  testimonials: LandingTestimonial[]
  faq: LandingFaq[]
  onCtaClick?: CtaClickHandler
}

export interface BaseBlock {
  type: string
}

export interface VideoBlock extends BaseBlock {
  type: 'video_block'
  headline?: string
  subheadline?: string
  provider: 'youtube' | 'vimeo' | 'html5'
  video_id: string
  aspect_ratio?: 'video' | 'standard' | 'square' | 'portrait' | '3:4' | 'auto'
  desktop_width?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  hide_youtube_ui?: boolean
  muted_preview?: {
    enabled: boolean
    fallbackText1?: string
    fallbackText2?: string
  }
}

export type LayoutBlock = VideoBlock | BaseBlock

export type UIConfigWhatsApp = {
  enabled: boolean
  number: string
  message: string
}

export type UIConfigMarquee = {
  enabled: boolean
  text: string
  bg_color: string
  text_color: string
}

export type UIConfigStickyCTA = {
  enabled: boolean
  text: string
}

export type UIConfig = {
  whatsapp: UIConfigWhatsApp
  marquee: UIConfigMarquee
  sticky_cta: UIConfigStickyCTA
}
