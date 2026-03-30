import type { ButtonHTMLAttributes, ReactNode } from 'react'

type PrimaryButtonProps = {
  children: ReactNode
  className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>

function PrimaryButton({ children, className = '', type = 'button', ...props }: PrimaryButtonProps) {
  return (
    <button
      type={type}
      className={[
        'inline-flex w-full min-h-14 items-center justify-center rounded-full px-8 py-4 lg:w-auto',
        'border border-[#ffaa22] bg-gradient-to-b from-[#ffec64] to-[#ffab23]',
        'text-center text-sm font-black uppercase tracking-[0.08em] text-gray-900 [text-shadow:0_1px_0_rgba(255,255,255,0.5)]',
        'transition-all duration-200 ease-out',
        'animate-cta-pulse hover:-translate-y-0.5',
        'hover:from-[#ffab23] hover:to-[#ffec64]',
        'hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.65),_0_14px_28px_rgba(255,171,35,0.46)]',
        'active:translate-y-1 active:scale-95 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.6),_0_10px_20px_rgba(255,171,35,0.4)]',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}

export type { PrimaryButtonProps }
export { PrimaryButton }
export default PrimaryButton
