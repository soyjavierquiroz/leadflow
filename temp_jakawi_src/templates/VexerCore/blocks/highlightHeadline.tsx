import type { ReactNode } from 'react'

function renderHighlightedText(text?: string): ReactNode {
  if (!text) {
    return null
  }

  const parts = text.split(/(\[\[.*?\]\])/g)

  return parts.map((part, index) => {
    if (part.startsWith('[[') && part.endsWith(']]')) {
      const content = part.slice(2, -2).trim()
      if (!content) {
        return null
      }

      return (
        <mark
          key={`${content}-${index}`}
          className="rounded-sm bg-yellow-200/80 px-1 py-0.5 text-[#111827]"
        >
          {content}
        </mark>
      )
    }

    return <span key={`${part}-${index}`}>{part}</span>
  })
}

export { renderHighlightedText }
export default renderHighlightedText
