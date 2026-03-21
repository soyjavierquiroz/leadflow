# @leadflow/web

Frontend shell en Next.js App Router para Leadflow.

## Segmentos actuales
- `/(site)` -> sitio publico (`/`)
- `/(members)` -> shell de sponsors (`/members`)
- `/(admin)` -> shell administrativo (`/admin`)

## Configuracion por entorno
Definida en `lib/public-env.ts` a partir de variables `NEXT_PUBLIC_*`.

Variables soportadas:
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_MEMBERS_URL`
- `NEXT_PUBLIC_ADMIN_URL`
- `NEXT_PUBLIC_API_URL`

Usar `apps/web/.env.example` como base de configuracion local.
