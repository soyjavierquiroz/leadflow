import { renderHighlightedText } from './highlightHeadline'
import type { DualPaymentBlockData, DualPaymentOption, LayoutTheme } from './types'

const PREFERRED_PAYMENT_STORAGE_KEY = 'jakawi_preferred_payment'

type DualPaymentBlockProps = {
  data: DualPaymentBlockData
  theme?: LayoutTheme
}

type NormalizedOption = {
  title: string
  badge: string | undefined
  description: string
  isVip: boolean
  perks: string[]
}

function normalizeOptions(options: DualPaymentOption[]): NormalizedOption[] {
  return options
    .map((option, index): NormalizedOption | null => {
      const title = option.title?.trim() || (option.is_vip ? 'Pago anticipado VIP' : 'Pago contra entrega')
      const description =
        option.description?.trim() ||
        (option.is_vip
          ? 'Asegura tu pedido hoy y desbloquea beneficios premium desde el primer minuto.'
          : 'Recibes el producto primero y pagas al momento de la entrega con total tranquilidad.')
      const perks = (option.perks ?? []).filter((perk): perk is string => Boolean(perk?.trim())).map((perk) => perk.trim())

      if (!description && perks.length === 0 && !title) {
        return null
      }

      const normalized: NormalizedOption = {
        title,
        badge: option.badge?.trim() || (option.is_vip ? '🔥 RECOMENDADO' : index === 0 ? 'Confianza total' : undefined),
        description,
        isVip: Boolean(option.is_vip),
        perks,
      }

      return normalized
    })
    .filter((option): option is NormalizedOption => option !== null)
    .slice(0, 2)
}

function CashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        d="M4 7.5c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2v-9Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M8 12h8" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        d="m4 18 1.7-9 4.1 3.5L12 6l2.2 6.5L18.3 9 20 18H4Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M5 20h14" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

function CheckIcon({ vip }: { vip: boolean }) {
  return (
    <span
      className={`mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
        vip ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'
      }`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
        <path d="m3.5 8.2 2.5 2.5 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </svg>
    </span>
  )
}

function DualPaymentBlock({ data, theme: _theme = 'light' }: DualPaymentBlockProps) {
  const options = normalizeOptions(data.options ?? [])
  const supportingText = data.subheadline?.trim() || data.subtitle?.trim() || ''
  const scrollToBoveda = (paymentMethod: 'cod' | 'vip', selectedTitle: string) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return
    }

    window.sessionStorage.setItem(PREFERRED_PAYMENT_STORAGE_KEY, paymentMethod)
    window.dispatchEvent(new CustomEvent('jakawi_payment_selected', { detail: selectedTitle }))
    document.getElementById('boveda-ofertas')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!options.length) {
    return null
  }

  return (
    <section className="w-full py-1 text-[var(--brand-text-main)]">
      <div className="space-y-6">
        {data.headline ? <h3 className="max-w-4xl text-3xl font-black leading-tight tracking-tight md:text-4xl">{renderHighlightedText(data.headline)}</h3> : null}
        {supportingText ? <p className="max-w-3xl text-base leading-relaxed text-[var(--brand-text-main)]/80">{supportingText}</p> : null}

        <div className="flex flex-col gap-6">
          {options.map((option, index) => {
            const Icon = option.isVip ? CrownIcon : CashIcon

            return (
              <article
                key={`${option.title}-${index}`}
                className={`w-full rounded-[1.75rem] p-6 shadow-[0_18px_45px_-28px_rgba(17,24,39,0.28)] sm:p-8 ${
                  option.isVip
                    ? 'border-2 border-[#ffab23] bg-orange-50/40'
                    : 'border border-gray-200 bg-gray-50/50'
                }`}
              >
                <div className="flex h-full flex-col gap-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={`inline-flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${
                        option.isVip ? 'bg-[#fff4d6] text-[#d97706]' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Icon />
                    </div>

                    <div className="min-w-0">
                      {option.badge ? (
                        <span
                          className={`mb-3 inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                            option.isVip ? 'bg-[#ffab23] text-black' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {option.badge}
                        </span>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className={`${option.isVip ? 'text-xl font-black text-[#111827] sm:text-2xl' : 'text-lg font-bold text-gray-700 sm:text-xl'} leading-tight`}>
                          {option.title}
                        </h4>
                      </div>

                      <p className={`mt-2 text-sm leading-relaxed md:text-[15px] ${option.isVip ? 'text-slate-700' : 'text-slate-600'}`}>{option.description}</p>
                    </div>
                  </div>

                  <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                    {option.perks.map((perk, perkIndex) => (
                      <li key={`${perk}-${perkIndex}`} className="flex items-start gap-3 text-sm font-medium leading-relaxed text-[#111827]">
                        <CheckIcon vip={option.isVip} />
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => scrollToBoveda(option.isVip ? 'vip' : 'cod', option.title)}
                    className={`mt-6 w-full rounded-xl px-4 py-3 font-bold transition-all duration-200 ${
                      option.isVip
                        ? 'bg-gray-900 text-[#ffab23] shadow-md hover:scale-[1.02] hover:bg-black'
                        : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {`Elegir ${option.title}`}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export { DualPaymentBlock }
export default DualPaymentBlock
