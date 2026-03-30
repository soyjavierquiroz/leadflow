import type { UIConfig } from '../templates/types'

export type MediaDictionary = Record<string, string>

export interface BovedaOferta {
  cantidad: number
  titulo: string
  etiqueta_oferta?: string
  etiqueta_destacada?: string
  combo_key?: string
  activo?: boolean
  descripcion_corta?: string
  desc_corta?: string
  image_key?: string
  precio_venta: number
  precio_tachado?: number
  qr_url: string
  banco: string
  titular: string
  descripcion_qr: string
  glosa_bancaria?: string
}

export interface BovedaSalida extends BovedaOferta {
  activo: boolean
  etiqueta_descuento?: string
  texto_boton?: string
}

export interface BovedaActiva {
  ofertas: BovedaOferta[]
  oferta_salida?: BovedaSalida
}

export interface ResumenOfertaPrincipal {
  precio_final: number | string
  precio_tachado: number | string
  ahorro_neto: number | string
}

export interface LandingVexer {
  id: number
  display_name: string
  nombre_comercial: string
  dominio: string
  whatsapp: string
  pixel_meta?: string
  pixel_tiktok?: string
  google_analytics_id?: string
  gtm_id?: string
  script_global_head?: string
  script_global_footer?: string
}

export interface LandingProduct {
  product_id: number
  slug?: string
  sku?: string
  path?: string
  company_whatsapp?: string
  media_folder?: string
  media_dictionary?: MediaDictionary
  boveda_activa?: BovedaActiva
  resumen_oferta_principal?: ResumenOfertaPrincipal
  qr_vault?: Record<string, string> | BovedaActiva
  layout_blocks?: unknown[]
  seo_data?: {
    title?: string
    description?: string
    og_image?: string
  }
  wc: {
    id: number
    slug?: string
    sku?: string
    name: string
    description: string
    price_regular: string
    price_sale: string
    images: any[]
  }
  vexer?: LandingVexer
  vexer_custom: {
    precio_final: string
    descripcion: string
    activo: boolean
    orden: string
  }
}

export type ProductLike = Pick<LandingProduct, 'boveda_activa' | 'media_dictionary' | 'resumen_oferta_principal' | 'wc' | 'vexer_custom'> & {
  sku?: string
  price?: string | number
  regular_price?: string | number
}

export interface LandingDataResponse {
  status: 'ok'
  template: string
  global_config?: {
    theme?: string
    palette?: string
  }
  company_whatsapp?: string
  media_folder?: string
  media_dictionary?: MediaDictionary
  boveda_activa?: BovedaActiva
  qr_vault?: Record<string, string> | BovedaActiva
  layout_blocks?: unknown[]
  seo_data?: {
    title?: string
    description?: string
    og_image?: string
  }
  vexer?: LandingVexer
  ui_config: UIConfig
  product: LandingProduct
  products?: LandingProduct[]
}
