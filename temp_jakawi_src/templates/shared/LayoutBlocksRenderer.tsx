import type { ReactNode } from 'react'
import type { CtaClickHandler } from '../types'
import { BovedaDinamicaBlock } from '../VexerCore/blocks/BovedaDinamicaBlock'
import FAQBlock from '../VexerCore/blocks/FAQBlock'
import { FAQAccordionBlock } from '../VexerCore/blocks/FAQAccordionBlock'
import { FeaturesBenefitsBlock } from '../VexerCore/blocks/FeaturesBenefitsBlock'
import { FinalCTABlock } from '../VexerCore/blocks/FinalCTABlock'
import { GrandSlamOfferBlock } from '../VexerCore/blocks/GrandSlamOfferBlock'
import { HowItWorksBlock } from '../VexerCore/blocks/HowItWorksBlock'
import { HookAndPromiseBlock } from '../VexerCore/blocks/HookAndPromiseBlock'
import DualPaymentBlock from '../VexerCore/blocks/DualPaymentBlock'
import { MobileCarouselBlock } from '../VexerCore/blocks/MobileCarouselBlock'
import { OfferStackBlock } from '../VexerCore/blocks/OfferStackBlock'
import { PainAgitationBlock } from '../VexerCore/blocks/PainAgitationBlock'
import { PainAndCostBlock } from '../VexerCore/blocks/PainAndCostBlock'
import { RiskReversalBlock } from '../VexerCore/blocks/RiskReversalBlock'
import SocialProofBlock from '../VexerCore/blocks/SocialProofBlock'
import { SolutionBlock } from '../VexerCore/blocks/SolutionBlock'
import { TransformationGridBlock } from '../VexerCore/blocks/TransformationGridBlock'
import UrgencyTimerBlock from '../VexerCore/blocks/UrgencyTimerBlock'
import { UniqueMechanismBlock } from '../VexerCore/blocks/UniqueMechanismBlock'
import VersatilityBlock from '../VexerCore/blocks/VersatilityBlock'
import { VideoBlock } from '../VexerCore/blocks/VideoBlock'
import type {
  BovedaDinamicaBlockData,
  DualPaymentBlockData,
  FAQBlockData,
  FAQAccordionBlockData,
  FeaturesBenefitsBlockData,
  FinalCTABlockData,
  GrandSlamOfferBlockData,
  HowItWorksBlockData,
  HookAndPromiseBlockData,
  LayoutBlock,
  LayoutTheme,
  MobileCarouselBlockData,
  OfferStackBlockData,
  PainAgitationBlockData,
  PainAndCostBlockData,
  RiskReversalBlockData,
  SocialProofBlockData,
  SolutionPresentationBlockData,
  TransformationGridBlockData,
  UrgencyTimerBlockData,
  UniqueMechanismBlockData,
  VersatilityBlockData,
  VideoBlockData,
} from '../VexerCore/blocks/types'
import { resolveMedia } from '../../utils/mediaResolver'

type MediaDictionary = Record<string, string>

function shouldResolveMediaField(fieldName: string): boolean {
  return /(^src$|_key$|_url$|image|img|photo|thumbnail|cover|gallery)/i.test(fieldName)
}

function resolveBlockMediaData<T>(value: T, dictionary?: MediaDictionary): T {
  if (!dictionary || Object.keys(dictionary).length === 0) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveBlockMediaData(item, dictionary)) as T
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const candidate = value as Record<string, unknown>
  const next: Record<string, unknown> = {}

  Object.entries(candidate).forEach(([key, fieldValue]) => {
    if (typeof fieldValue === 'string' && shouldResolveMediaField(key)) {
      next[key] = resolveMedia(fieldValue, dictionary)
      return
    }

    if (Array.isArray(fieldValue) || (fieldValue && typeof fieldValue === 'object')) {
      next[key] = resolveBlockMediaData(fieldValue, dictionary)
      return
    }

    next[key] = fieldValue
  })

  return next as T
}

type LayoutBlocksRendererProps = {
  blocks: LayoutBlock[]
  onCtaClick?: CtaClickHandler
  onBovedaCtaClick?: CtaClickHandler
  ctaClassName?: string
  ctaTitleClassName?: string
  ctaSubClassName?: string
  theme?: LayoutTheme
  mediaDictionary?: MediaDictionary
  fallback?: ReactNode
  product?: any
}

function getBlockShellClassName(index: number, blockType?: LayoutBlock['type']): string {
  if (blockType === 'urgency_timer') {
    return index === 0 ? 'px-6 pb-2 md:px-8 md:pb-3' : 'px-6 py-2 md:px-8 md:py-3'
  }

  if (index === 0 && blockType === 'hook_and_promise') {
    return 'px-6 pb-10 md:px-8 md:pb-14'
  }

  return index === 0 ? 'px-6 pb-16 md:px-8 md:pb-20' : 'px-6 py-16 md:px-8 md:py-20'
}

function hasHookAndPromiseContent(block?: LayoutBlock): block is HookAndPromiseBlockData {
  if (!block || block.type !== 'hook_and_promise') {
    return false
  }

  const bullets = Array.isArray(block.primary_benefit_bullets)
    ? block.primary_benefit_bullets.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    : []

  return Boolean(block.headline?.trim() || block.subheadline?.trim() || bullets.length > 0)
}

function renderLayoutBlock(
  block: LayoutBlock,
  index: number,
  options: Pick<
    LayoutBlocksRendererProps,
    'onCtaClick' | 'onBovedaCtaClick' | 'ctaClassName' | 'ctaTitleClassName' | 'ctaSubClassName' | 'theme' | 'mediaDictionary' | 'product'
  > & {
    inlineBovedaData?: BovedaDinamicaBlockData | null
  },
): ReactNode {
  const resolvedBlock = resolveBlockMediaData(block, options.mediaDictionary)

  switch (block.type) {
    case 'mobile_carousel':
      return <MobileCarouselBlock key={`${block.type}-${index}`} data={resolvedBlock as MobileCarouselBlockData} product={options.product} />
    case 'boveda_dinamica':
      return (
        <BovedaDinamicaBlock
          key={`${block.type}-${index}`}
          data={resolvedBlock as BovedaDinamicaBlockData}
          product={options.product}
          theme={options.theme}
          onOpenDrawer={options.onBovedaCtaClick ?? options.onCtaClick}
        />
      )
    case 'hook_and_promise':
      return (
        <HookAndPromiseBlock
          key={`${block.type}-${index}`}
          data={resolvedBlock as HookAndPromiseBlockData}
          theme={options.theme}
          onCtaClick={options.onCtaClick}
          onOpenDrawer={options.onBovedaCtaClick ?? options.onCtaClick}
          product={options.product}
          inlineBovedaData={options.inlineBovedaData}
        />
      )
    case 'dual_payment':
      return <DualPaymentBlock key={`${block.type}-${index}`} data={resolvedBlock as DualPaymentBlockData} theme={options.theme} />
    case 'pain_agitation':
      return <PainAgitationBlock key={`${block.type}-${index}`} data={resolvedBlock as PainAgitationBlockData} theme={options.theme} />
    case 'pain_and_cost':
      return (
        <PainAndCostBlock
          key={`${block.type}-${index}`}
          data={resolvedBlock as PainAndCostBlockData}
          theme={options.theme}
          onCtaClick={options.onCtaClick}
        />
      )
    case 'solution_presentation':
      return <SolutionBlock key={`${block.type}-${index}`} data={resolvedBlock as SolutionPresentationBlockData} theme={options.theme} />
    case 'unique_mechanism':
      return (
        <UniqueMechanismBlock
          key={`${block.type}-${index}`}
          data={resolvedBlock as UniqueMechanismBlockData}
          theme={options.theme}
          onCtaClick={options.onCtaClick}
          product={options.product}
        />
      )
    case 'transformation_grid':
      return <TransformationGridBlock key={`${block.type}-${index}`} data={resolvedBlock as TransformationGridBlockData} theme={options.theme} />
    case 'features_and_benefits':
      return <FeaturesBenefitsBlock key={`${block.type}-${index}`} data={resolvedBlock as FeaturesBenefitsBlockData} theme={options.theme} />
    case 'how_it_works':
      return <HowItWorksBlock key={`${block.type}-${index}`} data={resolvedBlock as HowItWorksBlockData} theme={options.theme} />
    case 'offer_stack':
      return (
        <OfferStackBlock
          key={`${block.type}-${index}`}
          data={resolvedBlock as OfferStackBlockData}
          theme={options.theme}
          onCtaClick={options.onCtaClick}
          ctaClassName={options.ctaClassName}
          ctaTitleClassName={options.ctaTitleClassName}
          ctaSubClassName={options.ctaSubClassName}
        />
      )
    case 'grand_slam_offer':
      return (
        <GrandSlamOfferBlock
          key={`${block.type}-${index}`}
          data={resolvedBlock as GrandSlamOfferBlockData}
          theme={options.theme}
          onCtaClick={options.onCtaClick}
          product={options.product}
        />
      )
    case 'faq_accordion':
      return <FAQAccordionBlock key={`${block.type}-${index}`} data={resolvedBlock as FAQAccordionBlockData} theme={options.theme} />
    case 'faq':
      return <FAQBlock key={`${block.type}-${index}`} data={resolvedBlock as FAQBlockData} theme={options.theme} />
    case 'final_cta':
      return (
        <FinalCTABlock
          key={`${block.type}-${index}`}
          data={resolvedBlock as FinalCTABlockData}
          theme={options.theme}
          onCtaClick={options.onCtaClick}
          ctaClassName={options.ctaClassName}
          ctaTitleClassName={options.ctaTitleClassName}
          ctaSubClassName={options.ctaSubClassName}
        />
      )
    case 'risk_reversal':
      return (
        <RiskReversalBlock
          key={`${block.type}-${index}`}
          data={resolvedBlock as RiskReversalBlockData}
          theme={options.theme}
          onCtaClick={options.onCtaClick}
        />
      )
    case 'social_proof':
      return <SocialProofBlock key={`${block.type}-${index}`} data={resolvedBlock as SocialProofBlockData} theme={options.theme} />
    case 'versatility':
      return <VersatilityBlock key={`${block.type}-${index}`} data={resolvedBlock as VersatilityBlockData} theme={options.theme} />
    case 'urgency_timer':
      return <UrgencyTimerBlock key={`${block.type}-${index}`} data={resolvedBlock as UrgencyTimerBlockData} theme={options.theme} />
    case 'video_block':
      return <VideoBlock key={`${block.type}-${index}`} block={resolvedBlock as VideoBlockData} />
    default:
      return null
  }
}

function LayoutBlocksRenderer({
  blocks,
  onCtaClick,
  onBovedaCtaClick,
  ctaClassName,
  ctaTitleClassName,
  ctaSubClassName,
  theme = 'light',
  mediaDictionary,
  fallback = null,
  product,
}: LayoutBlocksRendererProps) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return <>{fallback}</>
  }

  const shouldInlineBoveda =
    blocks.length > 1 &&
    blocks[0]?.type === 'hook_and_promise' &&
    hasHookAndPromiseContent(blocks[0]) &&
    blocks[1]?.type === 'boveda_dinamica'

  return (
    <>
      {blocks.map((block, index) => {
        if (shouldInlineBoveda && index === 1 && block.type === 'boveda_dinamica') {
          return null
        }

        const renderedBlock = renderLayoutBlock(block, index, {
          onCtaClick,
          onBovedaCtaClick,
          ctaClassName,
          ctaTitleClassName,
          ctaSubClassName,
          theme,
          mediaDictionary,
          product,
          inlineBovedaData:
            shouldInlineBoveda && index === 0 && block.type === 'hook_and_promise'
              ? (resolveBlockMediaData(blocks[1], mediaDictionary) as BovedaDinamicaBlockData)
              : null,
        })

        if (!renderedBlock) {
          return null
        }

        if (block.type === 'mobile_carousel') {
          return renderedBlock
        }

        return (
          <section
            key={`${block.type}-shell-${index}`}
            className={getBlockShellClassName(index, block.type)}
          >
            {renderedBlock}
          </section>
        )
      })}
    </>
  )
}

export type { LayoutBlocksRendererProps }
export { LayoutBlocksRenderer }
export default LayoutBlocksRenderer
