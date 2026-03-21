# Ownership, Publication & Template Model v1

Fecha: 2026-03-21 (UTC)

## Objetivo
Consolidar las reglas estructurales de Leadflow para ownership, publicacion y templates antes de ampliar flows, auth o persistencia nueva.

## Reglas de producto aprobadas
1. El sponsor individual no es dueno del funnel.
2. El `Team` es la unidad operativa que posee funnel, dominio, pool y tracking.
3. El `Super Admin` controla templates, JSON, bloques y estructura.
4. Las paginas son JSON-driven.
5. Un dominio puede servir multiples funnels por `host + path`.
6. Los equipos no editan paginas libremente; solo configuran campos permitidos.

## Niveles de ownership

### `Super Admin`
Rol de plataforma y diseno estructural.

Responsabilidades:
- crear y versionar `FunnelTemplate`
- definir `FunnelStep` estructural
- administrar `blocks_json`, `media_map` y `settings_json` base
- definir `HandoffStrategy` reutilizable
- definir `TrackingProfile` base y mappings globales cuando aplique
- controlar librerias de bloques, media y templates

No debe operar funnels como si fuera un sponsor.

### `Team Admin`
Rol operativo principal del negocio dentro de un tenant.

Responsabilidades:
- crear o activar `FunnelInstance` desde templates aprobados
- configurar `DomainBinding` o `FunnelPublication`
- asignar `RotationPool`
- seleccionar `TrackingProfile` permitido
- cargar campos editables habilitados por template
- operar sponsors y reglas de publicacion del team

El `Team Admin` es el dueno operativo real del funnel publicado.

### `Sponsor` o `Member`
Rol de ejecucion comercial.

Responsabilidades:
- recibir leads o handoffs
- actualizar su disponibilidad y datos operativos permitidos
- consultar su actividad y performance futura

No debe poder redefinir funnel, dominio, tracking ni estructura de pagina.

## Ownership por entidad

### Domain
Owner operativo: `Team`

Owner estructural/plataforma:
- `Super Admin` puede aprobar reglas globales o validar estandares

Regla:
- un dominio publicado sirve a un team
- un workspace puede contener varios teams y varios dominios, pero la explotacion diaria pertenece al team

### Funnel
Owner operativo: `Team`

Owner estructural:
- `Super Admin` es owner del template
- `Team Admin` es owner de la instancia publicada

Regla:
- el sponsor nunca es owner del funnel

### Tracking Profile
Owner operativo: `Team`

Owner estructural:
- `Super Admin` puede proveer perfiles base, mappings default y protecciones

Regla:
- el perfil efectivo que usa una publicacion debe quedar asociado al team o habilitado para ese team

### Rotation Pool
Owner operativo: `Team`

Regla:
- el pool pertenece al team
- los sponsors participan como miembros del pool, no como owners

### Sponsor Profile
Owner operativo: `Team`

Edicion acotada por:
- `Team Admin`
- el propio `Sponsor/Member` en campos permitidos

Regla:
- el sponsor controla solo su perfil limitado, no los activos estructurales del sistema

## Que puede editar cada rol

### `Super Admin`
Puede editar:
- templates
- steps estructurales
- blocks y schema JSON
- libreria de bloques
- reglas de validacion de fields permitidos
- handoff strategies base
- tracking profiles base
- conversion mappings base
- defaults globales de publicacion

No puede delegar al team cambios que rompan la estructura aprobada sin versionar template.

### `Team Admin`
Puede editar:
- instancias de funnel del team
- nombre operativo, estado y activacion
- dominios y bindings del team
- path de publicacion
- rotation pool asociado
- tracking profile permitido
- campos configurables expuestos por template
- contenido editable permitido en `settings_json`
- sponsors, membresias de pool y parametros operativos del team

No puede editar:
- estructura base del template
- steps bloqueados por plataforma
- bloques arbitrarios fuera del schema permitido
- mappings globales protegidos
- reglas core de resolucion o publicacion del sistema

### `Sponsor/Member`
Puede editar:
- disponibilidad
- datos de contacto propios
- preferencias operativas permitidas
- datos de perfil acotados

No puede editar:
- dominios
- funnels
- templates
- tracking profiles
- rotation pools
- bindings de publicacion
- bloques o JSON estructural

## Modelo de publicacion publica

## `Domain`
Representa un host publicable.

Campos conceptuales minimos:
- `host`
- `workspaceId`
- `teamId`
- `status`
- `isPrimary`
- `kind` (`apex`, `subdomain`, futuro)

Responsabilidad:
- registrar el host disponible
- conservar ownership operativo del team
- separar DNS/infra del enrutamiento funcional de funnel

## `FunnelPublication`
Entidad recomendada para publicacion efectiva de una instancia de funnel.

Alternativa de naming:
- `DomainBinding`

Recomendacion:
- usar `FunnelPublication` si queremos enfatizar resolucion publica
- tratar `DomainBinding` como alias conceptual de la misma entidad

Campos conceptuales minimos:
- `domainId`
- `funnelInstanceId`
- `teamId`
- `pathPrefix`
- `isPrimary`
- `status`
- `trackingProfileId`
- `handoffStrategyId` opcional

## Resolucion por `host + path`
La publicacion debe resolverse por:
1. `host` exacto
2. `pathPrefix` normalizado
3. estado activo

Algoritmo recomendado:
1. buscar todas las publicaciones activas del `host`
2. normalizar el path solicitado
3. elegir la coincidencia cuyo `pathPrefix` sea prefijo valido del request
4. si hay multiples coincidencias, gana la ruta mas especifica
5. si ninguna coincide, usar `/` solo si existe una publicacion root activa

## Reglas de precedencia
- la ruta mas especifica gana
- `/producto/oferta` gana sobre `/producto`
- `/producto` gana sobre `/`
- el host debe coincidir exactamente antes de evaluar path
- no debe haber dos publicaciones activas con el mismo `host + pathPrefix`

## Soporte minimo requerido

### Root `/`
Debe soportarse como landing principal de un dominio.

### Subrutas limpias
Debe soportarse:
- `/oportunidad`
- `/producto`
- `/masterclass`
- rutas similares sin necesidad de subdominio nuevo

### Subdominios
Debe quedar soportado como opcion, no como unica estrategia.

Ejemplos:
- `promo.dominio.com/`
- `curso.dominio.com/vsl`

## Modelo recomendado de funnel/template para v1

### `FunnelTemplate`
Activo estructural controlado por `Super Admin`.

Debe contener:
- metadata del tipo de funnel
- steps base
- `blocks_json`
- `media_map`
- `settings_json` base
- fields configurables permitidos para el team
- version

### `FunnelInstance`
Activo operativo controlado por `Team`.

Debe contener:
- referencia a template
- owner `teamId`
- estado operativo
- overrides permitidos
- `rotationPoolId`
- `trackingProfileId`
- `handoffStrategyId`

### `FunnelStep`
Paso tipado, ordenado y versionable.

Debe describir:
- `stepType`
- posicion
- slug
- condiciones de entrada/salida futuras
- schema de settings permitido
- blocks asignados al paso

### `blocks_json`
Representacion declarativa de bloques de pagina.

Debe almacenar:
- arbol o lista ordenada de bloques
- tipo de bloque
- props permitidas
- referencias a contenido editable

No debe almacenar logica arbitraria ejecutable.

### `media_map`
Mapa declarativo de assets usados por el template o la instancia.

Debe permitir:
- reemplazo controlado de imagenes y videos
- reutilizacion de assets
- separacion entre contenido y layout

### `settings_json`
Configuracion declarativa y segura.

Debe separar:
- settings estructurales solo plataforma
- settings operativos editables por team
- flags experimentales futuras

### `HandoffStrategy`
Politica declarativa de post-conversion.

Ownership recomendado:
- plantilla base por `Super Admin`
- seleccion efectiva por `Team Admin`

### `TrackingProfile`
Configuracion del tracking publicitario y de conversion.

Ownership recomendado:
- perfil base reusable de plataforma
- perfil efectivo del team o habilitado para team

### `ConversionEventMapping`
Regla de traduccion entre evento interno y evento de proveedor.

Control recomendado:
- gestionado por plataforma
- consumido por team solo via seleccion de perfil

## Regla de edicion segura
Las paginas de Leadflow deben ser JSON-driven, pero no page-builder libre para el team.

Regla:
- el `Super Admin` define estructura y campos editables
- el `Team Admin` configura solo slots, textos, medias y settings permitidos
- el `Sponsor` no toca la composicion de la pagina

## Decision estructural recomendada
- `Workspace` se mantiene como frontera tenant
- `Team` se convierte en owner operativo de funnel, dominio, tracking y pool
- `Sponsor` queda como actor comercial y destinatario de assignment
- `Super Admin` controla templates, bloques y gobernanza estructural

## Que implementar despues de esta fase
1. expansion de dominio/persistencia para reflejar ownership real por `Team`
2. modelo de `Domain` + `FunnelPublication`
3. separacion formal entre `FunnelTemplate` y `FunnelInstance`
4. surfaces de configuracion restringida para `Team Admin`
