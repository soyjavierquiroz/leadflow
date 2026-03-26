# External Domains / Publication Resolver v1

## Objetivo

Preparar Leadflow para publicar funnels reales en multiples hosts y subrutas, con resolucion server-side robusta por `host + path`.

## Modelo final

Relaciones:

- `team` 1:N `domains`
- `domain` 1:N `funnel_publications`
- `funnel_publication` N:1 `funnel_instance`

`Domain` queda con estos campos operativos:

- `host`: host configurado y visible en UI
- `normalizedHost`: host normalizado para lookup exacto
- `domainType`: `system_subdomain`, `custom_apex`, `custom_subdomain`
- `isPrimary`: marca el host principal del team
- `canonicalHost`: host canonico opcional
- `redirectToPrimary`: flag de canonicalidad futura
- `status`

`FunnelPublication` mantiene:

- `domainId`
- `funnelInstanceId`
- `pathPrefix`: persistido siempre normalizado
- `status`
- `isPrimary`
- overrides opcionales de tracking y handoff

## Tipos de dominio

- `system_subdomain`: subdominio gestionado por la plataforma, por ejemplo un host del sistema para previews o tenants.
- `custom_apex`: dominio raiz externo, por ejemplo `marca.com`.
- `custom_subdomain`: subdominio externo, por ejemplo `promo.marca.com`.

## Resolucion por `host + path`

Precedencia exacta:

1. normalizar `host`
2. buscar `Domain.normalizedHost` exacto
3. normalizar `path`
4. filtrar solo publicaciones activas cuyo domain este activo y cuyo funnel instance este activo
5. quedarse con las publicaciones cuyo `pathPrefix` sea prefijo valido del request
6. elegir la coincidencia con `longest-prefix-match`
7. si no hay match, responder `404`

Ejemplos:

- `acme.com/` resuelve la publicacion root `/`
- `acme.com/oportunidad` resuelve `/oportunidad`
- `acme.com/oportunidad/gracias` sigue dentro de la publicacion `/oportunidad`
- si existen `/`, `/oportunidad` y `/oportunidad/webinar`, la mas especifica gana

## Validaciones

- `normalizedHost` se guarda en minusculas y sin puerto
- `pathPrefix` se guarda con slash inicial, sin slash final salvo `/`
- no se permiten duplicados del mismo `domainId + pathPrefix`
- como `normalizedHost` es unico, eso equivale a bloquear duplicados del mismo `host + pathPrefix`

## Seed / demo

La seed deja:

- un domain principal `localhost`
- una publicacion root `/`
- una publicacion secundaria `/oportunidad`
- un segundo domain del mismo team: `promo.acme.test`

## Preparacion para dominios externos reales

Esta fase ya deja listo el modelo para conectar dominios reales despues:

- registrar multiples hosts por team
- asociar funnels distintos por subruta en el mismo host
- distinguir dominio raiz externo vs subdominio externo vs subdominio del sistema
- introducir canonicalidad sin romper el runtime actual

Para la siguiente fase faltara conectar:

- verificacion de ownership del dominio
- instrucciones DNS por tipo de dominio
- provisioning SSL
- redirects canonicos reales
- lifecycle operativo de activacion, verificacion y fallo

## Fuera de alcance en v1

- automatizacion de DNS
- Traefik
- Cloudflare
- redirects HTTP automaticos por `canonicalHost`
- multi-tenant routing infra-level
- panel completo de verificacion y onboarding de dominios
