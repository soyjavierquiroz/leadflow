import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { CheckoutRecoveryPage } from './pages/CheckoutRecoveryPage'
import { IrrigadorTest } from './pages/IrrigadorTest'
import { IrrigadorVSL } from './pages/IrrigadorVSL'
import { LandingV1 } from './pages/LandingV1'
import { RelojOferta } from './pages/RelojOferta'
import { RelojPremium } from './pages/RelojPremium'
import { SecureQRBridgePage } from './pages/SecureQRBridgePage'
import { StorefrontComingSoon } from './pages/StorefrontComingSoon'
import { UniversalProductPage } from './pages/UniversalProductPage'
import { VipAirlock } from './pages/VipAirlock'

function App() {
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/'

  // Bypass total para preview estático de diseño.
  // Evita cualquier flujo que dispare llamadas a la API /resolve.
  if (pathname === '/landing-v1') {
    return <LandingV1 />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/landing-v1" element={<LandingV1 />} />
        <Route path="/checkout/recovery" element={<CheckoutRecoveryPage />} />
        <Route path="/irrigador-clean" element={<IrrigadorTest />} />
        <Route path="/irrigador-vsl" element={<IrrigadorVSL />} />
        <Route path="/reloj-dark" element={<RelojPremium />} />
        <Route path="/reloj-orange" element={<RelojOferta />} />
        <Route path="/secure-qr/:token" element={<SecureQRBridgePage />} />
        <Route path="/secure-checkout/:token" element={<VipAirlock />} />
        <Route path="/" element={<StorefrontComingSoon />} />
        <Route path="/:slug" element={<UniversalProductPage />} />
        <Route path="/:category/:slug" element={<UniversalProductPage />} />
        <Route path="/*" element={<UniversalProductPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
