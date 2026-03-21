# Domain Strategy v1

## Dominio base oficial
- Dominio base: `exitosos.com`
- IP objetivo de servidor para fase posterior: `104.236.36.75`

## Mapa de dominios objetivo
- `https://exitosos.com` -> sitio publico (marketing + entrada comercial)
- `https://members.exitosos.com` -> panel sponsors/members
- `https://admin.exitosos.com` -> panel admin/operaciones
- `https://api.exitosos.com` -> API publica controlada

## Estrategia de separacion
1. `site` enfocado a captacion y contenido publico.
2. `members` enfocado a operacion de sponsors.
3. `admin` enfocado a gobernanza y configuracion.
4. `api` desacoplada como superficie de integracion.

## Consideraciones de enrutamiento (fase posterior)
- Traefik gestionara routing por host.
- Cada host apuntara a servicios internos separados o rutas dedicadas.
- Politicas CORS de API permitiran solo origenes web autorizados.

## Estado actual de esta fase
- Estrategia documentada.
- Shell de app preparado para la separacion.
- Sin deploy.
- Sin cambios de DNS aplicados.
