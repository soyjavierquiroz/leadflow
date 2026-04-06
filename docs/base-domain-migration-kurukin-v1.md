# Base Domain Migration Kurukin v1

## Objetivo

Migrar Leadflow para que el dominio base del sistema sea:

- `leadflow.kuruk.in` para la app
- `api.leadflow.kuruk.in` para la API

## Decisión de runtime

- host único de app para `site`, `admin`, `team` y `member`
- host fijo separado para la API
- cookies y redirects alineados a `leadflow.kuruk.in`

## Cambios aplicados

- defaults de `webPublicConfig` alineados a `leadflow.kuruk.in`
- defaults de `getApiRuntimeConfig` alineados a `leadflow.kuruk.in` y `api.leadflow.kuruk.in`
- redirects de auth resueltos contra el host único de app
- `.env.example` de `apps/web`, `apps/api` y `infra/swarm` migrados a Kurukin
- stacks Swarm actualizados para routers explícitos de:
  - `leadflow.kuruk.in`
  - `api.leadflow.kuruk.in`

## Validación funcional por código

- login server-first llama a `api.leadflow.kuruk.in`
- logout server-first llama a `api.leadflow.kuruk.in`
- redirects por rol terminan en:
  - `/admin`
  - `/team`
  - `/member`
    siempre bajo `leadflow.kuruk.in`
- el runtime público sigue resolviendo `host + path`

## Fuera de alcance

- migración DNS real en infraestructura
- deploy real del cambio
- validación end-to-end contra Cloudflare/Traefik del entorno productivo
