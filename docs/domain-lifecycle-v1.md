# Domain Lifecycle v1

Fecha: 2026-03-21 (UTC)

## Objetivo
Formalizar el ciclo de vida del dominio de Leadflow para operar staging hoy y cambiar al dominio definitivo de lanzamiento sin rehacer codigo ni arquitectura.

## Dominio temporal actual
- Base staging temporal: `exitosos.com`
- Hosts staging actuales:
  - `exitosos.com`
  - `members.exitosos.com`
  - `admin.exitosos.com`
  - `api.exitosos.com`

## Dominio definitivo futuro
- Aun no definido.
- Se documentara como `APP_BASE_DOMAIN=<dominio-final>` en la ventana de release.

## Principio de diseno
Leadflow debe ser domain-agnostic:
- El dominio vive en configuracion (`.env.example` y variables runtime).
- La aplicacion no debe contener hostnames hardcodeados.
- Las rutas funcionales siguen siendo `site`, `members`, `admin` y `api` independientemente del dominio.

## Variables canonicas para el cambio
Variables globales:
- `APP_ENV`
- `APP_BASE_DOMAIN`

Hosts (Traefik):
- `LEADFLOW_SITE_HOST`
- `LEADFLOW_MEMBERS_HOST`
- `LEADFLOW_ADMIN_HOST`
- `LEADFLOW_API_HOST`

URLs (web/api runtime):
- `SITE_URL`
- `MEMBERS_URL`
- `ADMIN_URL`
- `API_URL`
- `CORS_ALLOWED_ORIGINS`

## Como cambiar al dominio final sin romper el sistema
1. Definir nuevo dominio en variables de entorno (`infra/swarm/.env` en servidor o mecanismo equivalente).
2. Actualizar hosts y URLs en bloque:
   - `APP_BASE_DOMAIN`
   - `LEADFLOW_*_HOST`
   - `*_URL`
   - `CORS_ALLOWED_ORIGINS`
3. Configurar DNS del nuevo dominio apuntando al edge de Cloudflare/origen segun politica vigente.
4. Validar routers por host en Traefik (sin cambiar arquitectura de servicios).
5. Validar certificados TLS del nuevo dominio (origen + Cloudflare strict).
6. Ejecutar smoke tests funcionales:
   - `SITE_URL`
   - `MEMBERS_URL`
   - `ADMIN_URL`
   - `API_URL/health`
7. Si todo es correcto, retirar gradual el dominio temporal de staging o mantenerlo solo para QA, segun politica operativa.

## Que depende de DNS / Traefik / Cloudflare
- Resolucion de hostnames (`A/AAAA/CNAME`) en DNS.
- Proxy y modo SSL/TLS en Cloudflare (`DNS only`/`Proxied`, Full strict).
- Routing por host y certificados en Traefik (`Host(...)`, `tls`, `certresolver`).
- Renovacion y almacenamiento ACME en Traefik.

## Que NO debe depender del dominio
- Componentes React/Next y layouts de UI.
- Logica de negocio de API (modulos, servicios, controladores).
- Contratos internos entre paquetes del monorepo.
- Flujos funcionales core de Leadflow (captacion, asignacion, administracion).

## Guardrails
- No hardcodear `exitosos.com` fuera de configuracion de staging y docs operativas de staging.
- No mezclar cambios de dominio con cambios de arquitectura.
- Mantener una sola fuente de verdad de dominio por entorno (archivo/env central).
