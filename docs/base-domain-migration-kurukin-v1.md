# Base Domain Migration Kurukin v1

## Objetivo

Migrar Leadflow para que el dominio base del sistema sea:

- `leadflow.kurukin.com` para la app
- `api.leadflow.kurukin.com` para la API

## Decisión de runtime

- host único de app para `site`, `admin`, `team` y `member`
- host fijo separado para la API
- cookies y redirects alineados a `leadflow.kurukin.com`

## Cambios aplicados

- defaults de `webPublicConfig` alineados a `leadflow.kurukin.com`
- defaults de `getApiRuntimeConfig` alineados a `leadflow.kurukin.com` y `api.leadflow.kurukin.com`
- redirects de auth resueltos contra el host único de app
- `.env.example` de `apps/web`, `apps/api` y `infra/swarm` migrados a Kurukin
- stacks Swarm actualizados para routers explícitos de:
  - `leadflow.kurukin.com`
  - `api.leadflow.kurukin.com`

## Validación funcional por código

- login server-first llama a `api.leadflow.kurukin.com`
- logout server-first llama a `api.leadflow.kurukin.com`
- redirects por rol terminan en:
  - `/admin`
  - `/team`
  - `/member`
    siempre bajo `leadflow.kurukin.com`
- el runtime público sigue resolviendo `host + path`

## Fuera de alcance

- migración DNS real en infraestructura
- deploy real del cambio
- validación end-to-end contra Cloudflare/Traefik del entorno productivo
