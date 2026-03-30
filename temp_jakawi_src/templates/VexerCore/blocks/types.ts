import type { VideoBlock as TemplateVideoBlock } from '../../types'
import type { BovedaActiva } from '../../../api/types'

export interface BaseLayoutBlock {
  type: string
  headline?: string
  subtitle?: string
  subheadline?: string
}

export type LayoutTheme = 'light' | 'dark' | 'orange'

export interface HeroBlockData extends BaseLayoutBlock {
  type: 'hero_block'
  product_name?: string
  price?: string | number
  bullets?: string[]
  shipping_eta?: string
  cta_text?: string
}

export interface PainAgitationBlockData extends BaseLayoutBlock {
  type: 'pain_agitation'
  description?: string
  pain_points?: string[]
  closing_thought?: string
}

export interface SolutionPresentationBlockData extends BaseLayoutBlock {
  type: 'solution_presentation'
  benefits?: string[]
  footer_note?: string
}

export interface FeatureBenefitItem {
  feature?: string
  benefit?: string
}

export interface FeaturesBenefitsBlockData extends BaseLayoutBlock {
  type: 'features_and_benefits'
  features?: FeatureBenefitItem[]
  items?: FeatureBenefitItem[]
}

export interface HookAndPromiseBlockData extends BaseLayoutBlock {
  type: 'hook_and_promise'
  eyebrow_text?: string
  hero_image_url?: string
  hero_image_alt?: string
  primary_benefit_bullets?: string[]
  price_anchor_text?: string
  price_main_text?: string
  primary_cta_text?: string
  trust_badges?: string[]
}

export interface BovedaDinamicaBlockData extends BaseLayoutBlock {
  type: 'boveda_dinamica'
}

export interface MobileCarouselBlockData extends BaseLayoutBlock {
  type: 'mobile_carousel'
}

export interface PainAndCostBlockData extends BaseLayoutBlock {
  type: 'pain_and_cost'
  problem_intro?: string
  pain_points?: string[]
  cost_of_inaction_points?: string[]
  failed_solutions_list?: string[]
  emotional_transition_text?: string
  section_cta_text?: string
}

export interface UniqueMechanismStep {
  step_title?: string
  step_text?: string
}

export interface UniqueMechanismFeatureBenefitPair {
  feature?: string
  benefit?: string
}

export interface UniqueMechanismBlockData extends BaseLayoutBlock {
  type: 'unique_mechanism'
  mechanism_name?: string
  how_it_works_steps?: UniqueMechanismStep[]
  feature_benefit_pairs?: UniqueMechanismFeatureBenefitPair[]
  demo_video_url?: string
  media_url?: string
  section_cta_text?: string
}

export interface GrandSlamOfferItem {
  item_name?: string
  item_description?: string
  item_value_text?: string
}

export interface GrandSlamOfferBonusItem {
  bonus_name?: string
  bonus_description?: string
}

export interface GrandSlamOfferPriceStack {
  final_price_text?: string
  savings_text?: string
}

export interface GrandSlamOfferBlockData extends BaseLayoutBlock {
  type: 'grand_slam_offer'
  offer_name?: string
  what_is_included?: GrandSlamOfferItem[]
  bonus_items?: GrandSlamOfferBonusItem[]
  price_stack?: GrandSlamOfferPriceStack
  primary_cta_text?: string
}

export interface RiskReversalBlockData extends BaseLayoutBlock {
  type: 'risk_reversal'
  guarantee_duration_text?: string
  guarantee_body?: string
  guarantee_bullets?: string[]
  section_cta_text?: string
}

export interface SocialProofReview {
  name?: string
  location?: string
  stars?: number
  text?: string
  image_url?: string
  image_alt?: string
}

export interface SocialProofBlockData extends BaseLayoutBlock {
  type: 'social_proof'
  reviews?: SocialProofReview[]
}

export interface VersatilityBlockData extends BaseLayoutBlock {
  type: 'versatility'
  use_cases?: string[]
}

export interface UrgencyTimerBlockData extends BaseLayoutBlock {
  type: 'urgency_timer'
  prefix_text?: string
  main_text?: string
  suffix_text?: string
}

export interface DualPaymentOption {
  title?: string
  badge?: string
  description?: string
  is_vip?: boolean
  perks?: string[]
}

export interface DualPaymentBlockData extends BaseLayoutBlock {
  type: 'dual_payment'
  options?: DualPaymentOption[]
}

export type HowItWorksStep = string | { title?: string; description?: string }

export interface HowItWorksBlockData extends BaseLayoutBlock {
  type: 'how_it_works'
  steps?: HowItWorksStep[]
  tip?: string
}

export interface OfferStackBlockData extends BaseLayoutBlock {
  type: 'offer_stack'
  boveda_activa?: BovedaActiva
  includes?: string[]
  stack_items?: string[]
  items?: string[]
  offer_1_price?: string | number
  offer_2_price?: string | number
  offer_3_price?: string | number
  offer_1_label?: string
  offer_2_label?: string
  offer_3_label?: string
  default_price?: string | number
  bundle_options?: Array<{
    quantity?: number
    price?: string | number
    label?: string
  }>
  button_text?: string
  cta_text?: string
  subtext?: string
  guarantee_title?: string
  guarantee_text?: string
  warranty_title?: string
  warranty_text?: string
  footer_note?: string
}

export interface FAQItem {
  question?: string
  answer?: string
  q?: string
  a?: string
}

export interface FAQAccordionBlockData extends BaseLayoutBlock {
  type: 'faq_accordion'
  faqs?: FAQItem[]
}

export interface FAQBlockData extends BaseLayoutBlock {
  type: 'faq'
  faqs?: FAQItem[]
}

export interface FinalCTABlockData extends BaseLayoutBlock {
  type: 'final_cta'
  button_text?: string
  cta_text?: string
  subtext?: string
}

export interface TransformationGridBlockData extends BaseLayoutBlock {
  type: 'transformation_grid'
  items?: string[]
}

export type VideoBlockData = TemplateVideoBlock

export type KnownLayoutBlock =
  | HeroBlockData
  | HookAndPromiseBlockData
  | BovedaDinamicaBlockData
  | MobileCarouselBlockData
  | PainAgitationBlockData
  | PainAndCostBlockData
  | SolutionPresentationBlockData
  | UniqueMechanismBlockData
  | TransformationGridBlockData
  | FeaturesBenefitsBlockData
  | HowItWorksBlockData
  | OfferStackBlockData
  | GrandSlamOfferBlockData
  | FAQAccordionBlockData
  | FAQBlockData
  | FinalCTABlockData
  | RiskReversalBlockData
  | SocialProofBlockData
  | VersatilityBlockData
  | UrgencyTimerBlockData
  | DualPaymentBlockData
  | VideoBlockData

export interface UnknownLayoutBlock extends BaseLayoutBlock {
  [key: string]: unknown
}

export type LayoutBlock = KnownLayoutBlock | UnknownLayoutBlock

export function isLayoutBlock(value: unknown): value is LayoutBlock {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as { type?: unknown }
  return typeof candidate.type === 'string'
}
