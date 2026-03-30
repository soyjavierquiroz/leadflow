import { KurukinPlayer } from '../../../components/ui/kurukin-video-player'
import type { VideoBlock as VideoBlockType } from '../../types'

type VideoBlockProps = {
  block: VideoBlockType
}

export function VideoBlock({ block }: VideoBlockProps) {
  if (!block.video_id) {
    return null
  }

  const widthClasses: Record<NonNullable<VideoBlockType['desktop_width']>, string> = {
    sm: 'md:max-w-sm',
    md: 'md:max-w-md',
    lg: 'md:max-w-lg',
    xl: 'md:max-w-2xl',
    full: 'md:max-w-3xl',
  }
  const desktopWidthClass = widthClasses[block.desktop_width || 'full']

  return (
    <section className="w-full bg-[var(--brand-bg)] py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {block.headline ? (
          <h2 className="mb-8 text-center text-3xl font-black text-[var(--brand-text)] md:text-4xl">{block.headline}</h2>
        ) : null}

        <div
          className={`mx-auto w-full ${desktopWidthClass} rounded-2xl bg-[var(--brand-cardBg)] p-2 shadow-xl border border-[var(--brand-borderColor)] sm:p-4`}
        >
          <KurukinPlayer
            provider={block.provider || 'youtube'}
            videoId={block.video_id}
            aspectRatio={block.aspect_ratio || 'video'}
            hideYoutubeUi={block.hide_youtube_ui !== false}
            mutedPreview={block.muted_preview}
          />
        </div>

        {block.subheadline ? (
          <p className="mt-6 text-center text-lg font-medium text-[var(--brand-text)] opacity-80">{block.subheadline}</p>
        ) : null}
      </div>
    </section>
  )
}
