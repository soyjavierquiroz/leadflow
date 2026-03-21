# App Shells + UI Base v1

Fecha: 2026-03-21 (UTC)

## Objetivo
Construir las primeras superficies privadas visibles de Leadflow en `apps/web` para que el producto ya se entienda en pantalla desde los tres roles base:
- `Super Admin`
- `Team Admin`
- `Sponsor / Member`

Sin auth real todavia, pero con estructura de layouts y navegacion preparada para integrarla despues.

## Superficies creadas

### Super Admin
- `/admin`
- `/admin/teams`
- `/admin/templates`
- `/admin/publications`

Uso esperado:
- lectura de catalogo estructural
- supervision de ownership por team
- control de publicaciones activas
- visibilidad de readiness operativo de la plataforma

### Team Admin
- `/team`
- `/team/funnels`
- `/team/publications`
- `/team/sponsors`
- `/team/pools`
- `/team/leads`

Uso esperado:
- operar funnels e instancias del team
- revisar publicaciones por host + path
- observar sponsors, pools y carga operativa
- leer pipeline de leads conectado al runtime publico

### Sponsor / Member
- `/member`
- `/member/leads`
- `/member/profile`

Uso esperado:
- revisar leads asignados
- tener una vista personal de capacidad y handoffs
- preparar el punto de entrada para auth y preferencias futuras del sponsor

## Layouts y navegacion base
Se implementaron app shells consistentes con:
- sidebar persistente
- top bar con contexto de superficie
- badges de fuente de datos
- headers de seccion
- grids de KPIs
- tablas y cards reutilizables

La navegacion queda montada por superficie:
- `/(admin)`
- `/(team)`
- `/(member)`

Adicionalmente:
- `/members` queda como redirect legacy hacia `/member`

## Componentes UI reutilizables
Se crearon en `apps/web/components/app-shell`:
- `app-shell-layout`
- `app-sidebar`
- `top-bar`
- `section-header`
- `kpi-card`
- `data-table`
- `empty-state`
- `status-badge`
- `sponsor-card`
- `publication-card`

## Datos reales conectados
Cuando la API esta disponible, el shell usa fetch real para:
- `GET /v1/workspaces`
- `GET /v1/funnel-templates`
- `GET /v1/funnel-instances`
- `GET /v1/funnel-publications`
- `GET /v1/domains`
- `GET /v1/sponsors`
- `GET /v1/rotation-pools`
- `GET /v1/leads`
- `GET /v1/assignments`
- `GET /v1/events`

Esto alimenta:
- dashboards de admin
- vistas operativas de team
- leads del member demo
- cards de publications y sponsors

## Mock temporal y claramente separado
Se creo una capa aislada en `apps/web/lib/app-shell` con fallback controlado.

Lo que sigue mockeado temporalmente:
- metadata de `teams`
  - motivo: no existe endpoint HTTP dedicado de lectura para `teams`
  - estrategia: se derivan conteos reales desde sponsors, funnels, publications, pools, leads y assignments; solo nombre/codigo/descripcion del team siguen mock
- preferencias de `member profile`
  - motivo: no hay auth ni storage de perfil final
  - estrategia: datos mock separados del sponsor real
- datasets de respaldo
  - motivo: permitir `build`, preview local y shells visibles aun si la API no esta levantada

## Integracion futura con auth
Esta fase no implementa auth real ni bloquea rutas.

Pero deja preparada la integracion futura porque:
- cada superficie ya tiene layout propio
- la navegacion esta separada por rol conceptual
- el fetch de datos vive en una capa centralizada
- el sponsor actual y el team actual pueden pasar luego a resolverse desde session
- los guards podran colocarse a nivel de layout sin rehacer paginas

Integracion prevista despues:
1. resolver usuario autenticado
2. resolver rol efectivo (`Super Admin`, `Team Admin`, `Sponsor`)
3. mapear team/sponsor/workspace desde session
4. reemplazar mocks de contexto por datos de auth
5. restringir rutas por layout o middleware

## Restricciones respetadas
- no se implemento auth real
- no se tocaron Traefik ni Cloudflare
- no se implemento editor visual de funnels
- no se integraron WhatsApp, n8n ni Evolution
- no se toco el runtime publico fuera de mantener compatibilidad

## Validacion esperada
- `pnpm install`
- `pnpm build`
- `pnpm lint`
- `pnpm test`
- validacion manual de rutas visibles

## Que deja listo esta fase
- integrar auth real y permisos por superficie
- sumar acciones mutativas sobre funnels, sponsors y publicaciones
- mejorar read models y joins desde API
- reemplazar mocks remanentes por endpoints dedicados
