# Domain Strategy v1

## Objetivo
Definir estrategia de dominio desacoplada para que Leadflow cambie de dominio en lanzamiento sin cambios de codigo o arquitectura.

## Estado actual
- Dominio temporal de staging: `exitosos.com`.
- Dominio definitivo de lanzamiento: pendiente de definicion.
- IP de referencia para fase de infraestructura: `104.236.36.75`.

## Principio rector
El dominio es configuracion de entorno, no una constante del producto.

## Convencion recomendada
Variables base:
- `APP_ENV`
- `APP_BASE_DOMAIN`

Variables de routing/URLs:
- `LEADFLOW_SITE_HOST`
- `LEADFLOW_MEMBERS_HOST`
- `LEADFLOW_ADMIN_HOST`
- `LEADFLOW_API_HOST`
- `SITE_URL`
- `MEMBERS_URL`
- `ADMIN_URL`
- `API_URL`

## Mapa funcional (agnostico al dominio)
- `SITE_URL` -> sitio publico (captacion y entrada comercial)
- `MEMBERS_URL` -> panel sponsors/members
- `ADMIN_URL` -> panel admin/operaciones
- `API_URL` -> API publica controlada

## Reglas de implementacion
1. No hardcodear hostnames en componentes, utilidades ni logica de negocio.
2. Resolver dominios solo desde variables de entorno y configuracion central.
3. Mantener la misma semantica funcional (`site/members/admin/api`) en cualquier dominio.
4. Tratar docs de incidentes TLS y deploy como documentacion de staging, no como dominio canonico del producto.

## Estado actual de esta fase
- Estrategia documentada.
- Monorepo preparado para cambio de dominio por configuracion.
- Sin deploy.
- Sin cambios de DNS aplicados.
