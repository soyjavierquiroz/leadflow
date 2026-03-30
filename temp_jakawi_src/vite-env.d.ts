/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORDPRESS_API_URL: string
  readonly VITE_DEV_TENANT_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
