import { useEffect, useMemo, useState } from 'react'
import { renderHighlightedText } from './highlightHeadline'
import type { LayoutTheme, UrgencyTimerBlockData } from './types'

type UrgencyTimerBlockProps = {
  data: UrgencyTimerBlockData
  theme?: LayoutTheme
}

type TimeLeft = {
  hours: number
  minutes: number
  seconds: number
}

function getTimeLeftUntilEndOfDay(now = new Date()): TimeLeft {
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)

  const diffMs = Math.max(0, endOfDay.getTime() - now.getTime())
  const totalSeconds = Math.floor(diffMs / 1000)

  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

function formatTimeUnit(value: number): string {
  return String(value).padStart(2, '0')
}

function formatCountdown(timeLeft: TimeLeft): string {
  return `${formatTimeUnit(timeLeft.hours)}:${formatTimeUnit(timeLeft.minutes)}:${formatTimeUnit(timeLeft.seconds)}`
}

function UrgencyTimerBlock({ data, theme: _theme = 'light' }: UrgencyTimerBlockProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => getTimeLeftUntilEndOfDay())
  const today = useMemo(() => new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'long' }).format(new Date()), [])
  const supportingText = data.subheadline?.trim() || data.subtitle?.trim() || ''
  const defaultPrefixText = '⚠️ Atención:'
  const defaultMainText = 'Oferta reservada solo por hoy, {date}.'
  const defaultSuffixText = 'El stock expira en:'
  const finalPrefixText = (data.prefix_text || defaultPrefixText).trim()
  const finalMainText = (data.main_text || defaultMainText).replace('{date}', today).trim()
  const finalSuffixText = (data.suffix_text || defaultSuffixText).trim()

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTimeLeft(getTimeLeftUntilEndOfDay())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  return (
    <section className="mb-0.5 w-full py-0 text-[var(--brand-text-main)]">
      <div className="space-y-1 rounded-sm border border-red-200 border-l-4 border-l-red-600 bg-red-100 px-3 py-1.5 text-[#111827] md:px-4 md:py-2">
        {data.headline ? <h3 className="max-w-4xl text-3xl font-black leading-tight tracking-tight md:text-4xl">{renderHighlightedText(data.headline)}</h3> : null}
        {supportingText ? <p className="max-w-3xl text-sm leading-tight text-[#111827]/80 md:text-base">{supportingText}</p> : null}

        <p className="text-base font-semibold leading-tight text-[#111827] md:text-lg">
          <span className="font-bold uppercase text-red-700">{finalPrefixText}</span>{' '}
          {finalMainText}{' '}
          <span className="font-semibold text-[#111827]">{finalSuffixText}</span>{' '}
          <span className="font-black text-2xl tracking-tight tabular-nums text-red-600">{formatCountdown(timeLeft)}</span>
        </p>
      </div>
    </section>
  )
}

export { UrgencyTimerBlock }
export default UrgencyTimerBlock
