import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { SmartPhoneInput } from '../../components/ui/SmartPhoneInput'
import { BOLIVIAN_CITIES, matchBolivianCity } from '../../components/checkout/cities'
import { THEMES, type ThemeKey } from '../../config/themes'
import { useVisitor } from '../../context/VisitorContext'
import { useStorefrontData, type StorefrontProduct } from '../../hooks/useStorefrontData'
import './styles.css'

const trustItems = [
  { icon: '🔒', label: 'Pago Seguro' },
  { icon: '🛡️', label: 'Garantia' },
  { icon: '🚚', label: 'Envio Rapido' },
]

function parseCurrencyToNumber(value: string | number | undefined): number {
  if (typeof value === 'number') {
    return value
  }
  if (!value) {
    return 0
  }
  const normalized = value.replace(/[^\d.,]/g, '').replace(/,/g, '')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatTotal(value: number): string {
  return value.toFixed(2)
}

function formatBsInteger(value: number): string {
  return Math.round(value).toString()
}

export function StorefrontView() {
  const { visitorData } = useVisitor()
  const { data, isLoading, error } = useStorefrontData()
  const navigate = useNavigate()
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>('core-fuego')
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<StorefrontProduct | null>(null)
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false)
  const [hasSeenOffer, setHasSeenOffer] = useState(false)
  const [checkoutStep, setCheckoutStep] = useState<1 | 2>(1)
  const [selectedPack, setSelectedPack] = useState(1)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    city: '',
    address: '',
  })
  const activeTheme = THEMES[currentTheme]
  const featuredProducts = data.featured_products
  const extendedProducts = data.extended_products

  useEffect(() => {
    const incomingTheme = data.theme
    if (incomingTheme && Object.prototype.hasOwnProperty.call(THEMES, incomingTheme)) {
      setCurrentTheme(incomingTheme)
    }
  }, [data.theme])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const root = document.documentElement
    const theme = THEMES[currentTheme]

    root.style.setProperty('--brand-primary', theme.primary)
    root.style.setProperty('--brand-accent', theme.accent)
    root.style.setProperty('--brand-bg', theme.bg)
    root.style.setProperty('--brand-text', theme.text)
    root.style.setProperty('--brand-cardBg', theme.cardBg)
    root.style.setProperty('--brand-borderColor', theme.borderColor)
    root.style.setProperty('--brand-border', theme.borderColor)
    root.style.colorScheme = currentTheme.includes('cyber') || currentTheme.includes('dark') ? 'dark' : 'light'
  }, [currentTheme])

  const wrapperStyle = {
    '--brand-primary': activeTheme.primary,
    '--brand-primary-hover': activeTheme.primary,
    '--brand-accent': activeTheme.accent,
    '--brand-bg': activeTheme.bg,
    '--brand-text': activeTheme.text,
    '--brand-borderColor': activeTheme.borderColor,
    '--brand-border': activeTheme.borderColor,
    '--brand-cardBg': activeTheme.cardBg,
    backgroundColor: 'var(--brand-bg)',
    color: 'var(--brand-text)',
  } as CSSProperties

  const handleAttemptClose = () => {
    if (!hasSeenOffer) {
      setIsCheckoutOpen(false)
      setIsOfferModalOpen(true)
      setHasSeenOffer(true)
    } else {
      setIsCheckoutOpen(false)
      setIsOfferModalOpen(false)
    }
  }

  const openCheckoutForProduct = (product: StorefrontProduct) => {
    setSelectedProduct(product)
    setCheckoutStep(1)
    setSelectedPack(1)
    setIsCheckoutOpen(true)
  }

  const goToProductDetail = (product: StorefrontProduct) => {
    const destination = (product.path || product.slug || '').trim().replace(/^\/+/, '')
    if (!destination) {
      openCheckoutForProduct(product)
      return
    }

    navigate(`/${destination}`, {
      state: {
        fromStorefront: true,
      },
    })
  }

  const handleStep1Submit = (e: FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.phone || !formData.address || !formData.city || formData.city === 'Otra...') {
      alert('Completa tus datos')
      return
    }
    setCheckoutStep(2)
  }

  const getWhatsAppLink = (isQR: boolean) => {
    const unitPrice = parseCurrencyToNumber(selectedProduct?.price)
    const total = formatTotal(unitPrice * selectedPack)
    const productTitle = selectedProduct?.title || selectedProduct?.name || 'Producto'
    const msg = isQR
      ? `¡Hola! Ya pagué por QR mi pedido.\n\n*Producto:* ${productTitle} (x${selectedPack})\n*Total:* Bs. ${total}\n*A nombre de:* ${formData.name}\n\nAquí envío mi comprobante 📄`
      : `¡Hola! Quiero confirmar mi pedido para PAGO AL RECIBIR.\n\n*Producto:* ${productTitle} (x${selectedPack})\n*Total:* Bs. ${total}\n*Dirección:* ${formData.address}, ${formData.city}\n*A nombre de:* ${formData.name}`
    return `https://wa.me/59178402065?text=${encodeURIComponent(msg)}`
  }

  useEffect(() => {
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !hasSeenOffer && !isCheckoutOpen) {
        setIsOfferModalOpen(true)
        setHasSeenOffer(true)
      }
    }

    document.addEventListener('mouseleave', handleMouseLeave)
    return () => document.removeEventListener('mouseleave', handleMouseLeave)
  }, [hasSeenOffer, isCheckoutOpen])

  useEffect(() => {
    if (formData.city) {
      return
    }
    const detectedCity = matchBolivianCity(visitorData?.city)
    if (detectedCity) {
      setFormData((prev) => ({ ...prev, city: detectedCity }))
    }
  }, [formData.city, visitorData?.city])

  const isPresetCity = BOLIVIAN_CITIES.includes(formData.city)
  const showCustomCityInput = formData.city === 'Otra...' || (!isPresetCity && formData.city !== '')

  if (isLoading) {
    return (
      <div className="storefront-wrapper min-h-screen animate-pulse" style={wrapperStyle}>
        <div className="h-8 w-full bg-[var(--brand-primary)] opacity-80" />
        <section className="px-4 py-6">
          <div className="mx-auto h-[50vh] max-w-7xl rounded-3xl bg-black/20" />
        </section>
        <section className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-6 h-8 w-64 rounded-xl bg-black/10" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={`featured-skeleton-${index}`} className="h-80 rounded-2xl bg-black/10" />
            ))}
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-6">
          <div className="mb-6 h-7 w-48 rounded-xl bg-black/10" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`catalog-skeleton-${index}`} className="h-52 rounded-xl bg-black/10" />
            ))}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="storefront-wrapper min-h-screen transition-colors duration-500" style={wrapperStyle}>
      <section className="relative">
        <div className="bg-[var(--brand-primary)] py-2 text-center text-xs font-bold uppercase tracking-wide text-white">
          🔥 ENVIO GRATIS Y PAGO CONTRA ENTREGA EN TODA BOLIVIA 🔥
        </div>

        <header className="absolute left-0 right-0 top-12 z-20">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-8">
            <span className="text-lg font-black tracking-widest text-white drop-shadow-sm md:text-xl">VEXER STORE</span>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition hover:bg-white/30"
              aria-label="Abrir carrito"
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.3 10.1a2 2 0 002 1.6h7.7a2 2 0 002-1.6L21 7H7" />
                <circle cx="10" cy="19" r="1.5" />
                <circle cx="18" cy="19" r="1.5" />
              </svg>
            </button>
          </div>
        </header>

        <div
          className="relative flex min-h-[70vh] items-center justify-center bg-fixed bg-cover bg-center px-4 py-24 md:min-h-[80vh]"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80')",
          }}
        >
          <div className="absolute inset-0 z-0 bg-black/60" />
          <div className="relative z-10 mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-black leading-tight text-white md:text-6xl">Descubre Ofertas Que Se Agotan Hoy</h1>
            <p className="mt-4 text-lg text-gray-200">
              Productos seleccionados para vender mas, con entrega rapida y pago contra entrega en Bolivia.
            </p>
            <button
              type="button"
              className="mt-8 rounded-full bg-[var(--brand-primary)] px-8 py-4 font-bold text-white transition hover:scale-105 hover:bg-[var(--brand-primary-hover)]"
            >
              Ver Productos Destacados
            </button>
          </div>
        </div>
      </section>

      <section className="border-b bg-white py-4" style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.borderColor }}>
        <div className="mx-auto flex max-w-7xl flex-row items-center justify-center gap-2 px-4 text-center sm:gap-6">
          {trustItems.map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-1 whitespace-nowrap text-[9px] font-bold uppercase tracking-wide sm:flex-row sm:gap-2 sm:text-xs"
            >
              <span className="text-sm sm:text-base" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[var(--brand-bg)]">
        {error ? (
          <div className="mx-auto max-w-7xl px-4 pt-4">
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
              {error}
            </div>
          </div>
        ) : null}
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-20 lg:px-8">
          <h2 className="mb-8 text-center text-2xl font-black md:mb-12 md:text-4xl">Nuestros Productos Estrella</h2>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            {featuredProducts.map((product) => (
              <article
                key={product.id}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.borderColor }}
                onClick={() => goToProductDetail(product)}
              >
                {product.badge ? (
                  <div
                    className="absolute left-3 top-3 z-10 rounded-full px-3 py-1 text-[11px] font-bold"
                    style={{ backgroundColor: activeTheme.accent, color: activeTheme.cardBg }}
                  >
                    {product.badge}
                  </div>
                ) : null}
                <img src={product.image} alt={product.title} className="aspect-[5/4] w-full object-cover" loading="lazy" />
                <div className="space-y-3 p-5">
                  <h3 className="storefront-line-clamp-2 min-h-[3.2rem] text-base font-semibold md:text-lg">{product.title}</h3>
                  <p className="text-sm text-[var(--brand-text)] opacity-50 line-through">Bs {formatBsInteger(product.originalPrice)}</p>
                  <p className="text-2xl font-black text-[var(--brand-primary)]">Bs {formatBsInteger(product.price)}</p>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary)] hover:text-white"
                    onClick={(event) => {
                      event.stopPropagation()
                      goToProductDetail(product)
                    }}
                  >
                    Ver Oferta
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="flex w-full justify-center py-4 opacity-50">
          <div className="h-1 w-24 rounded-full" style={{ backgroundColor: THEMES[currentTheme].borderColor }}></div>
        </div>

        <div className="mx-auto mb-12 max-w-7xl rounded-3xl bg-black/5 px-4 py-12 dark:bg-white/5 sm:px-6 md:py-16 lg:px-8">
          <div className="mb-8 text-center">
            <h3 className="mb-2 text-xl font-black md:text-2xl">Catálogo Express</h3>
            <p className="text-sm opacity-70">Añade estos productos a tu pedido con un solo clic</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
            {extendedProducts.map((product) => (
              <article
                key={product.id}
                className="cursor-pointer overflow-hidden rounded-xl border shadow-sm transition duration-300 hover:shadow-md"
                style={{ backgroundColor: activeTheme.cardBg, borderColor: activeTheme.borderColor }}
                onClick={() => goToProductDetail(product)}
              >
                <img src={product.image} alt={product.title} className="aspect-square w-full object-cover" loading="lazy" />
                <div className="space-y-2 p-4">
                  <h3 className="storefront-line-clamp-2 min-h-[3rem] text-sm font-semibold md:text-base">{product.title}</h3>
                  <p className="text-xs text-[var(--brand-text)] opacity-50 line-through">Bs {formatBsInteger(product.originalPrice)}</p>
                  <p className="text-xl font-bold text-[var(--brand-primary)]">Bs {formatBsInteger(product.price)}</p>
                  <button
                    type="button"
                    className="w-full rounded-lg border border-[var(--brand-primary)] px-4 py-2 text-[11px] font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--brand-primary)] hover:text-white md:py-3 md:text-sm"
                    onClick={(event) => {
                      event.stopPropagation()
                      goToProductDetail(product)
                    }}
                  >
                    Ver Oferta
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t py-10 text-center text-sm opacity-80" style={{ borderColor: activeTheme.borderColor }}>
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold uppercase tracking-widest">
            <a href="#" className="hover:text-[var(--brand-primary)]">
              Politica de Envios
            </a>
            <a href="#" className="hover:text-[var(--brand-primary)]">
              Politica de Cambios
            </a>
            <a href="#" className="hover:text-[var(--brand-primary)]">
              Terminos y Condiciones
            </a>
          </div>
          <p>© {new Date().getFullYear()} VEXER STORE. Todos los derechos reservados.</p>
          <p className="text-xs">Pagos: 💳 Visa, Mastercard, QR, Tigo Money y Contra Entrega</p>
        </div>
      </footer>

      {isCheckoutOpen && selectedProduct && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleAttemptClose}></div>

          <div
            className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl shadow-2xl"
            style={{
              backgroundColor: THEMES[currentTheme].cardBg,
              color: THEMES[currentTheme].text,
              colorScheme: currentTheme.includes('cyber') ? 'dark' : 'light',
            }}
          >
            <div className="flex items-center justify-between border-b bg-gray-50/50 px-5 py-4" style={{ borderColor: THEMES[currentTheme].borderColor }}>
              <h3 className="flex items-center gap-2 text-lg font-bold">
                Finaliza Tu Pedido
                <span className="rounded-full bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-700">Paso {checkoutStep} de 2</span>
              </h3>
              <button onClick={handleAttemptClose} className="p-1 text-2xl leading-none hover:opacity-70" aria-label="Cerrar checkout">
                &times;
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              {checkoutStep === 1 ? (
                <form onSubmit={handleStep1Submit} className="animate-fade-in-up space-y-5">
                  <div className="mb-2 flex items-center gap-4">
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-gray-200">
                      {selectedProduct.image ? (
                        <img src={selectedProduct.image} alt={selectedProduct.title || selectedProduct.name || 'Producto'} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <h4 className="text-sm font-semibold leading-tight">{selectedProduct.title || selectedProduct.name}</h4>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-black uppercase text-gray-400">Selecciona tu pack y ahorra</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((pack) => {
                        const packTotal = parseCurrencyToNumber(selectedProduct.price) * pack
                        const isSelected = selectedPack === pack
                        return (
                          <div
                            key={pack}
                            onClick={() => setSelectedPack(pack)}
                            className={`cursor-pointer rounded-lg border p-2 text-center transition-all ${isSelected ? 'border-2 shadow-sm' : 'opacity-70 hover:opacity-100'}`}
                            style={{ borderColor: isSelected ? THEMES[currentTheme].primary : THEMES[currentTheme].borderColor }}
                          >
                            <div className="text-lg font-black" style={{ color: isSelected ? THEMES[currentTheme].primary : 'inherit' }}>
                              {pack}x
                            </div>
                            <div className="text-xs font-bold">Bs {formatBsInteger(packTotal)}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider opacity-70">Nombre completo</label>
                      <input
                        type="text"
                        placeholder="Nombre completo (Ej: Maria Gomez)"
                        className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm focus:ring-1"
                        style={{ borderColor: THEMES[currentTheme].borderColor, outlineColor: THEMES[currentTheme].primary }}
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider opacity-70">Telefono</label>
                      <SmartPhoneInput
                        required
                        defaultCountry="BO"
                        value={formData.phone}
                        onChange={(phone) => setFormData({ ...formData, phone })}
                        className={[
                          '[&_.PhoneInput]:rounded-lg [&_.PhoneInput]:!border-[var(--brand-border)] [&_.PhoneInput]:!bg-[var(--brand-cardBg)]',
                          '[&_.PhoneInput]:focus-within:!ring-1 [&_.PhoneInput]:focus-within:!ring-[var(--brand-primary)]',
                          '[&_.PhoneInputCountry]:!border-[var(--brand-border)] [&_.PhoneInputCountry]:!bg-[var(--brand-cardBg)]',
                          '[&_.PhoneInputInput]:!bg-[var(--brand-cardBg)] [&_.PhoneInputInput]:!text-[var(--brand-text)]',
                          '[&_.PhoneInputInput]:!placeholder:text-slate-500 [&_.SmartPhoneCallingCode]:!text-[var(--brand-text)]',
                        ].join(' ')}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider opacity-70">Ciudad</label>
                      <div className="space-y-3">
                        <select
                          required
                          className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm focus:ring-1"
                          style={{
                            borderColor: THEMES[currentTheme].borderColor,
                            outlineColor: THEMES[currentTheme].primary,
                            backgroundColor: THEMES[currentTheme].cardBg,
                            color: THEMES[currentTheme].text,
                          }}
                          value={isPresetCity ? formData.city : formData.city ? 'Otra...' : ''}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        >
                          <option value="" disabled>
                            Selecciona tu ciudad...
                          </option>
                          {BOLIVIAN_CITIES.map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                        </select>

                        {showCustomCityInput ? (
                          <input
                            type="text"
                            required
                            placeholder="Escribe el nombre de tu ciudad/provincia..."
                            className="w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm focus:ring-1"
                            style={{ borderColor: THEMES[currentTheme].borderColor, outlineColor: THEMES[currentTheme].primary }}
                            value={formData.city === 'Otra...' ? '' : isPresetCity ? '' : formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          />
                        ) : null}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider opacity-70">Direccion de entrega</label>
                      <textarea
                        placeholder="Direccion de entrega (Barrio, calle...)"
                        className="h-20 w-full rounded-lg border bg-transparent px-3 py-2.5 text-sm focus:ring-1"
                        style={{ borderColor: THEMES[currentTheme].borderColor, outlineColor: THEMES[currentTheme].primary }}
                        required
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      ></textarea>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full transform rounded-xl py-4 text-lg font-black uppercase text-white shadow-lg transition-transform hover:scale-[1.02] hover:opacity-90"
                    style={{ backgroundColor: THEMES[currentTheme].primary }}
                  >
                    Realizar mi pedido
                  </button>
                </form>
              ) : (
                <div className="animate-fade-in-up space-y-5 text-center">
                  <div
                    className="rounded-xl border p-4 text-left"
                    style={{ borderColor: THEMES[currentTheme].accent, backgroundColor: `${THEMES[currentTheme].accent}10` }}
                  >
                    <p className="text-sm font-bold" style={{ color: THEMES[currentTheme].primary }}>
                      Pedido Reservado: #{Math.floor(Math.random() * 900) + 100}
                    </p>
                    <p className="mt-1 text-xs">{selectedProduct.title || selectedProduct.name}</p>
                    <p className="mt-1 text-xs font-bold">
                      Cantidad: {selectedPack} unidad(es) • Total Bs {formatBsInteger(parseCurrencyToNumber(selectedProduct.price) * selectedPack)}
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-slate-900 py-2 text-center text-[10px] font-bold uppercase text-white">
                      🚀 Beneficio Activo: Envio VIP + Puntos Jakawi
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed bg-white p-4" style={{ borderColor: THEMES[currentTheme].borderColor }}>
                    <p className="mb-2 font-bold text-gray-800">BANCO GANADERO S.A.</p>
                    <div className="flex h-48 w-48 items-center justify-center rounded border bg-gray-200">
                      <span className="text-xs text-gray-400">[IMAGEN QR AQUI]</span>
                    </div>
                    <p className="mt-2 text-xl font-black text-gray-800">Bs {formatBsInteger(parseCurrencyToNumber(selectedProduct.price) * selectedPack)}</p>
                  </div>

                  <p className="px-4 text-xs font-medium text-gray-500">
                    Escanea el QR y envia tu comprobante para conservar tus beneficios.
                  </p>

                  <div className="space-y-3 pt-2">
                    <a
                      href={getWhatsAppLink(true)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full rounded-xl bg-[#10b981] py-4 text-sm font-black uppercase text-white shadow-lg transition-colors hover:bg-[#059669]"
                    >
                      Ya pague, Enviar Comprobante
                    </a>
                    <a
                      href={getWhatsAppLink(false)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-xs font-semibold underline opacity-70 hover:opacity-100"
                      style={{ color: THEMES[currentTheme].text }}
                    >
                      Prefiero pagar al recibir
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isOfferModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setIsOfferModalOpen(false)}></div>

          <div
            className="animate-fade-in-up relative w-full max-w-sm overflow-hidden rounded-3xl border-[3px] p-8 text-center shadow-2xl"
            style={{
              backgroundColor: THEMES[currentTheme].cardBg,
              color: THEMES[currentTheme].text,
              borderColor: THEMES[currentTheme].accent,
              boxShadow: `0 0 50px -15px ${THEMES[currentTheme].accent}80`,
            }}
          >
            <h2 className="mb-2 text-3xl font-black uppercase" style={{ color: THEMES[currentTheme].primary }}>
              ¡Espera!
            </h2>
            <p className="mb-6 text-sm font-bold opacity-80">
              No te vayas con las manos vacias. ¡Acabas de desbloquear un descuento especial!
            </p>

            <div
              className="mx-auto mb-6 flex h-24 w-24 rotate-3 transform items-center justify-center rounded-full border-4 shadow-xl"
              style={{
                backgroundColor: THEMES[currentTheme].accent,
                color: THEMES[currentTheme].cardBg,
                borderColor: THEMES[currentTheme].cardBg,
              }}
            >
              <span className="text-3xl font-black drop-shadow-sm">-10%</span>
            </div>

            <button
              onClick={() => {
                setIsOfferModalOpen(false)
                if (!selectedProduct) {
                  const fallbackProduct = featuredProducts[0] || extendedProducts[0] || null
                  setSelectedProduct(fallbackProduct)
                }
                setCheckoutStep(1)
                setSelectedPack(1)
                setIsCheckoutOpen(true)
              }}
              className="mb-3 w-full rounded-xl py-4 text-sm font-black uppercase tracking-wider shadow-lg transition-opacity hover:opacity-90"
              style={{
                backgroundColor: THEMES[currentTheme].primary,
                color: THEMES[currentTheme].cardBg,
                boxShadow: `0 10px 25px -5px ${THEMES[currentTheme].accent}66`,
              }}
            >
              ¡Completar pedido con 10% DTO!
            </button>

            <button onClick={() => setIsOfferModalOpen(false)} className="w-full rounded-xl py-3 text-sm font-bold opacity-60 transition-colors hover:opacity-100">
              No, gracias. Perder mi descuento.
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-50 flex max-w-xs flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 text-black shadow-2xl">
        <span className="border-b pb-1 text-[10px] font-black uppercase tracking-widest text-gray-500">Paletas Curadas</span>

        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase text-gray-400">Core</span>
          <div className="flex gap-2">
            <button onClick={() => setCurrentTheme('core-fuego')} className="rounded bg-red-500 px-2 py-1 text-xs text-white">
              Fuego
            </button>
            <button onClick={() => setCurrentTheme('core-eco')} className="rounded bg-emerald-500 px-2 py-1 text-xs text-white">
              Eco
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase text-gray-400">Cyber</span>
          <div className="flex gap-2">
            <button onClick={() => setCurrentTheme('cyber-matrix')} className="rounded border border-green-400 bg-slate-900 px-2 py-1 text-xs text-green-400">
              Matrix
            </button>
            <button onClick={() => setCurrentTheme('cyber-synth')} className="rounded border border-pink-500 bg-slate-900 px-2 py-1 text-xs text-sky-400">
              Synth
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold uppercase text-gray-400">Aura</span>
          <div className="flex gap-2">
            <button onClick={() => setCurrentTheme('aura-mono')} className="rounded border bg-gray-100 px-2 py-1 text-xs text-black">
              Mono
            </button>
            <button onClick={() => setCurrentTheme('aura-rose')} className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-800">
              Rose
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StorefrontView
