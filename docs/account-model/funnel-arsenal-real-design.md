# Funnel Arsenal real: biblioteca de Master Funnels clonables

Fecha: 2026-06-25 (UTC)

## Resumen ejecutivo

El Arsenal actual ya tiene la entidad correcta para catalogar ofertas (`FunnelArsenalTemplate`), pero todavia mezcla dos ideas distintas:

- ficha comercial de recomendacion por `BusinessBlueprint`;
- funnel real operativo de LeadFlow.

Un funnel real no es `templateKey + label + pathSuggestion`. En el codigo actual el funnel real es un agregado compuesto por `Funnel`, `FunnelInstance`, `FunnelStep[]`, `FunnelInstance.conversionContract.flowGraph`, JSON de bloques/media/settings, `FunnelTemplate`, `FunnelPublication`, `Domain`, tracking, handoff y runtime publico. Por eso, el camino de menor resistencia no es reemplazar el Arsenal, sino convertirlo en un indice que apunta a un `sourceFunnelInstanceId` master y construir un servicio de clonacion profunda, seguro e idempotente.

Recomendacion: conservar `FunnelArsenalTemplate` como catalogo (Opcion A), endurecerlo gradualmente para que los templates activos "reales" requieran `sourceFunnelInstanceId`, crear un tenant interno `LeadFlow Arsenal`, y agregar un servicio nuevo `FunnelInstanceCloneService` que copie el agregado estructural y regenere IDs, paths y publicaciones sin copiar secretos ni datos operativos.

## Diagnostico del modelo actual

### Modelo persistente

Fuente principal: `apps/api/prisma/schema.prisma`.

`Workspace`

- Posee `teams`, `funnels`, `domains`, `funnelTemplates`, `funnelInstances`, `funnelSteps`, `funnelPublications`, `trackingProfiles`, `handoffStrategies`, `leads`, `assignments`, `events`, `funnelEvents` y `commercialProfiles`.
- `accountType` ya diferencia cuentas individuales/equipos desde el modelo de cuenta.

`Team`

- Es el owner operativo de funnels publicados.
- Tiene `teamType`, `domains`, `funnelInstances`, `funnelSteps`, `funnelPublications`, `trackingProfiles`, `handoffStrategies`, `rotationPools`, `adWheels`, `assignments` y `commercialProfile`.

`CommercialProfile`

- Vive por `teamId` unico.
- Define `vertical`, `businessModel`, `blueprintKey`, `blueprintVersion`, `businessName` y datos comerciales.
- El Arsenal usa `blueprintKey` para filtrar templates visibles.

`Funnel`

- Modelo legacy/operativo base.
- Campos criticos: `workspaceId`, `name`, `description`, `code`, `thumbnailUrl`, `config`, `status`, `isTemplate`, `stages`, `entrySources`, `defaultTeamId`, `defaultRotationPoolId`.
- Restriccion: `@@unique([workspaceId, code])`.
- Se conecta 1:1 opcional con `FunnelInstance` via `FunnelInstance.funnelId`.

`FunnelTemplate`

- Template tecnico JSON-driven.
- Campos criticos: `workspaceId?`, `code`, `status`, `version`, `funnelType`, `blocksJson`, `mediaMap`, `settingsJson`, `allowedOverridesJson`, `defaultHandoffStrategyId`.
- Restriccion: `code` unico.
- Riesgo importante: varios servicios solo permiten usar templates del workspace del team o globales (`workspaceId = null`). Un Master Funnel en un workspace interno deberia usar `FunnelTemplate` global, o el clonador debe crear/copiar un template accesible al target.

`FunnelArsenalTemplate`

- Catalogo actual del Arsenal.
- Campos: `templateKey`, `blueprintKey`, `vertical`, `label`, `description`, `goal`, `recommendedFor`, `cta`, `pathSuggestion`, `difficulty`, `status`, `blocksPresetKey`, `funnelTemplateId`, `sourceFunnelId`, `sourceFunnelInstanceId`.
- No tiene relaciones Prisma formales hacia `Funnel`, `FunnelInstance` ni `FunnelTemplate`; son strings indexados.
- Hoy funciona como metadata y como puntero opcional.

`FunnelInstance`

- Instancia real editable/publicable.
- Campos criticos para clonar: `workspaceId`, `teamId`, `templateId`, `funnelId`, `name`, `code`, `thumbnailUrl`, `status`, `structuralType`, `conversionContract`, `settingsJson`, `mediaMap`.
- Campos operativos que no deben copiarse tal cual: `rotationPoolId`, `trackingProfileId`, `handoffStrategyId`.
- Restriccion: `@@unique([teamId, code])`.
- `conversionContract.flowGraph` es el FlowGraph vivo; no existe tabla separada.

`FunnelStep`

- Paso real del funnel.
- Campos criticos: `stepType`, `slug`, `position`, `isEntryStep`, `isConversionStep`, `blocksJson`, `mediaMap`, `settingsJson`.
- Restricciones: `@@unique([funnelInstanceId, position])` y `@@unique([funnelInstanceId, slug])`.

`FunnelStepHistory`

- Historial editorial por step.
- No debe clonarse por defecto; el clon debe empezar limpio.

`FunnelPublication`

- Binding publico de `Domain + pathPrefix -> FunnelInstance`.
- Campos criticos: `workspaceId`, `teamId`, `domainId`, `funnelInstanceId`, `seoTitle`, `seoDescription`, `ogImageUrl`, `faviconUrl`, `manifestVersion`, `runtimeHealthStatus`, `pathPrefix`, `status`, `isActive`, `isPrimary`.
- Campos sensibles: `metaPixelId`, `tiktokPixelId`, `metaCapiToken`, `tiktokAccessToken`, `trackingProfileId`, `handoffStrategyId`.
- Restriccion: `@@unique([domainId, pathPrefix])`.

`Domain`

- Representa host publicable.
- Campos criticos: `workspaceId`, `teamId`, `host`, `normalizedHost`, `status`, `domainType`, `isPrimary`, `canonicalHost`, `redirectToPrimary`.
- Restriccion: `normalizedHost` unico global.
- Consecuencia: no se puede crear un `Domain` `leadflow.kuruk.in` por cada team. Si se usa un host compartido, debe haber un unico `Domain` para ese host, o se deben usar subdominios unicos por team.

`TrackingProfile`, `ConversionEventMapping`, `HandoffStrategy`, `RotationPool`, `AdWheel`, `Lead`, `Assignment`, `FunnelEvent`, `DomainEvent`, `TrackedLink`

- Son operativos o de integracion.
- Pueden afectar runtime, pero no forman parte segura del paquete base que se debe clonar desde un Master Funnel para otro tenant.

## Servicios y flujos actuales

### Arsenal actual

Archivos:

- `apps/api/src/modules/funnel-arsenal/funnel-arsenal.service.ts`
- `apps/api/src/modules/funnel-arsenal/funnel-arsenal.controller.ts`
- `apps/api/src/modules/funnel-arsenal/system-funnel-arsenal.controller.ts`
- `apps/web/components/member-operations/funnel-arsenal-client.tsx`
- `apps/web/components/system/system-funnel-arsenal-client.tsx`
- `packages/shared/account-model/src/index.ts`

Flujo actual:

- `GET /v1/funnel-arsenal/me` valida perfil comercial y lista templates activos por `blueprintKey`.
- `POST /v1/funnel-arsenal/me/:templateKey/enable` habilita un template.
- Si `sourceFunnelInstanceId` existe, llama a `cloneSourceFunnelInstance`.
- Si no existe, crea un funnel minimo de dos pasos desde metadata.
- Crea `FunnelPublication` activa en el primer dominio activo del team.

Deuda critica:

- `cloneSourceFunnelInstance` copia `FunnelInstance.conversionContract` tal cual y despues crea steps nuevos. Si el `conversionContract.flowGraph` contiene IDs de steps del master, el clon queda con un FlowGraph que apunta a steps del source. Para funnels multi-step reales, esto es un bug estructural.
- No copia publicaciones del source, lo cual es correcto.
- No copia tracking/handoff/rotation, lo cual es seguro.
- No valida que el `sourceFunnelInstanceId` pertenezca a un tenant de sistema o que sea un master aprobado.
- No limpia posibles secretos embebidos accidentalmente dentro de `settingsJson`, `mediaMap` o `blocksJson`.

### Builder/Hybrid publications

Archivos:

- `apps/api/src/modules/hybrid-funnel-publications/hybrid-funnel-publications.service.ts`
- `apps/api/src/modules/hybrid-funnel-publications/hybrid-funnel-publications.controller.ts`
- `apps/api/src/modules/hybrid-funnel-publications/system-hybrid-funnel-publications.controller.ts`

El Builder moderno edita funnels a traves de una publicacion hibrida. `createForTeam` crea:

- `Funnel`
- `FunnelInstance`
- `FunnelStep` landing `captura`
- `FunnelStep` thank_you `confirmado`
- `FunnelPublication` activa

`updateForTeam` edita steps, JSON, SEO basico y publicacion. Este servicio es util para crear y mantener Master Funnels, pero no es un clonador de masters completos.

### FlowGraph

Archivos:

- `apps/api/src/modules/funnel-graph/funnel-graph-mutation.service.ts`
- `apps/api/src/modules/funnels/blueprint.service.ts`
- `packages/shared/funnel-lint/src/flow-graph.types.ts`
- `packages/shared/funnel-lint/src/lint-funnel-draft.ts`

El FlowGraph se guarda en:

```text
FunnelInstance.conversionContract.flowGraph
```

Nodos y edges referencian `FunnelStep.id`:

- `entryStepId`
- `nodes[stepId]`
- `node.stepId`
- `exit.toStepId`

Por tanto, clonar un funnel real exige crear primero un mapa `oldStepId -> newStepId` y reescribir todo el graph.

### Publicaciones clasicas

Archivos:

- `apps/api/src/modules/funnel-publications/funnel-publications.service.ts`
- `apps/api/src/modules/funnel-publications/system-publications.service.ts`

Estos servicios crean/actualizan publicaciones y validan dominio, instancia, estado activo y conflicto de path. Son reutilizables para reglas de path y validacion, pero hoy no resuelven el caso "publicar en host fallback compartido para un team que no posee ese Domain".

### Runtime publico

Archivos:

- `apps/api/src/modules/public-funnel-runtime/public-funnel-runtime.service.ts`
- `apps/web/app/(site)/[[...slug]]/page.tsx`
- `apps/web/app/(public)/runtime/[hostname]/[[...slug]]/page.tsx`

Resolucion actual:

1. Normaliza host y path.
2. Busca publicaciones activas cuyo `domain.normalizedHost` coincida y cuyo funnel este activo.
3. Filtra por `matchesPublicationPath(path, publication.pathPrefix)`.
4. Gana el `pathPrefix` mas especifico.
5. El step actual se resuelve por path relativo contra `FunnelStep.slug`.

El runtime es compatible con paths tipo `/u/{teamSlug}/evaluacion`, `/p/{teamSlug}/evaluacion` o `/f/{publicationId}` siempre que exista una `FunnelPublication` activa con ese `pathPrefix`.

## Que significa clonar correctamente un funnel

Clonar correctamente no es duplicar una fila. Es crear un nuevo agregado target, owned por el team destino, que renderice igual que el master pero sin datos operativos del master.

### Debe clonarse

`Funnel`

- Crear nuevo `Funnel`.
- Copiar `description`, `thumbnailUrl`, `stages`, `entrySources` y `config` sanitizado.
- Generar `code` unico por workspace.
- Setear `workspaceId` target, `defaultTeamId` target, `defaultRotationPoolId = null`, `isTemplate = false`, `status = active` o `draft` segun estrategia.

`FunnelInstance`

- Crear nueva instancia.
- Copiar `structuralType`, `conversionContract` sanitizado y con FlowGraph reescrito, `settingsJson`, `mediaMap`, `thumbnailUrl`.
- Generar `code` unico por team.
- Setear `workspaceId` target, `teamId` target, `funnelId` nuevo.
- Setear `rotationPoolId = null`, `trackingProfileId = null`.
- `handoffStrategyId` deberia ser `null` por defecto, salvo que exista una estrategia global segura y explicitamente permitida.

`FunnelStep[]`

- Crear todos los steps del source en orden.
- Copiar `stepType`, `slug`, `position`, `isEntryStep`, `isConversionStep`, `blocksJson`, `mediaMap`, `settingsJson`.
- Resolver colisiones internas de `slug`/`position` si el source esta corrupto.
- Guardar mapa `oldStepId -> newStepId`.

`FlowGraph`

- Reescribir `entryStepId`.
- Reescribir keys de `nodes`.
- Reescribir `node.stepId`.
- Reescribir cada `exit.toStepId`.
- Preservar `role`, `isTerminal`, `externalUrlTemplate`, `meta`, `defaultOutcome`, labels y priorities.
- Ejecutar `lintFunnelDraft` despues de clonar.

JSON de contenido

- Copiar `blocksJson`, `mediaMap`, `settingsJson` de instancia y steps.
- Sanitizar campos de secretos por nombre y por ubicaciones conocidas.
- Revisar referencias internas a IDs de step, publication, domain o team si aparecen dentro de JSON.

SEO

- Copiar SEO editorial basico desde master si esta en `FunnelPublication` o `settingsJson`: `seoTitle`, `seoDescription`, `ogImageUrl`, `faviconUrl`.
- Permitir override con `businessName` del `CommercialProfile`.

Source references

- Guardar metadata de procedencia en `Funnel.config` y/o `FunnelInstance.conversionContract`:
  - `source = "funnel_arsenal"`
  - `templateKey`
  - `blueprintKey`
  - `clonedFromFunnelInstanceId`
  - `clonedFromFunnelId`
  - version futura del master si existe.

`FunnelTemplate`

- Preferencia: usar `FunnelTemplate.workspaceId = null` en masters.
- Si el source usa template de workspace interno, el clonador debe crear/copiar una version target o mapearlo a un template global equivalente. Si no, futuras ediciones pueden fallar por validacion de `assertTemplate`.

### Debe crearse nuevo, no copiarse

`FunnelPublication`

- Crear publicacion nueva para el target.
- Usar dominio target o fallback de plataforma.
- Generar `pathPrefix` unico.
- `status/isActive` segun estrategia de publicacion.
- `trackingProfileId`, `handoffStrategyId`, pixel IDs y CAPI tokens deben empezar vacios.

IDs y ownership

- Todos los IDs son nuevos.
- `workspaceId` y `teamId` son del target.
- `code` y `pathPrefix` se recalculan.

Runtime context

- Despues de clonar, llamar a `RuntimeContextConfigSyncService.syncFunnelContextForInstance` para que el contexto operativo quede alineado.

## Que NO debe clonarse

No clonar por seguridad o por ownership:

- `FunnelPublication` del master.
- `Domain` del master.
- `Domain.cloudflareCustomHostnameId`, `cloudflareStatusJson`, DNS y TLS.
- `metaCapiToken`, `tiktokAccessToken`.
- `metaPixelId`, `tiktokPixelId`, salvo que el usuario los configure despues.
- `TrackingProfile` y `ConversionEventMapping` del master, salvo un flujo futuro de "copiar como draft sin secretos" explicitamente disenado.
- `RotationPool`, `RotationMember`, `defaultRotationPoolId`.
- `HandoffStrategy` de team, conexiones de WhatsApp, Evolution, Kloser, n8n o bindings de handoff.
- `Lead`, `Visitor`, `Assignment`, `FunnelEvent`, `DomainEvent`, analytics y eventos.
- `AdWheel`, participantes, turnos o campanas.
- `TrackedLink`, `SponsorVanityShortLink`, ref links, shortlinks y `ctx` tokens.
- `FunnelStepHistory`.
- Runtime sessions o cualquier estado browser/server temporal.
- `createdBy` historico, autores, ownership del master.
- Cualquier secreto embebido en `settingsJson`, `blocksJson`, `mediaMap` o `config`.

## Evaluacion de opciones A/B/C/D

### Opcion A: usar `FunnelArsenalTemplate` como indice hacia `sourceFunnelInstanceId`

Ventajas:

- Es el menor cambio: la tabla ya existe, la UI admin ya permite guardar `sourceFunnelInstanceId`, member ya lista por blueprint y `enable` ya tiene un branch de clonacion.
- Mantiene `templateKey`, `blueprintKey`, `vertical`, `recommendedFor`, `difficulty`, `pathSuggestion` como metadata comercial.
- Permite migracion gradual: templates sin source siguen funcionando con fallback minimo mientras se crean masters reales.

Desventajas:

- El nombre `Template` queda semanticamente pobre para un master completo.
- No tiene FK ni versionado formal del source.
- Puede apuntar a cualquier `FunnelInstance` si no agregamos validaciones.

Recomendacion: elegir esta opcion ahora, con reglas:

- `status = active` + `sourceFunnelInstanceId != null` para templates reales.
- Validar que el source pertenezca al tenant interno Arsenal.
- Agregar auditoria/validacion antes de activar.
- Dejar `sourceFunnelId` como metadata secundaria o derivable.

### Opcion B: crear `MasterFunnel` o `FunnelBlueprint`

Ventajas:

- Semantica limpia.
- Permite versionado, approvals, estados de revision y relaciones FK.
- Buen destino futuro si el Arsenal se vuelve marketplace/enterprise library.

Desventajas:

- Requiere migracion, nuevos CRUDs, nuevas relaciones y cambios de UI.
- Duplica temporalmente el catalogo actual.
- No reduce el problema duro: igual hace falta deep clone seguro.

Recomendacion: no ahora. Considerarla Fase 3 cuando existan versionado, approvals o marketplace multi-empresa.

### Opcion C: marcar `FunnelInstance.isMaster = true`

Ventajas:

- Semantica cerca del objeto real.
- Facilitaria queries de masters.

Desventajas:

- Requiere migracion.
- Mezcla catalogo comercial con instancia tecnica.
- No resuelve filtros por `blueprintKey`, copy, difficulty, recommendedFor.
- Puede contaminar interfaces operativas si no se separan bien los tenants.

Recomendacion: no como primer paso. Puede agregarse luego como bandera complementaria, no como modelo principal.

### Opcion D: usar `FunnelTemplate` como master

Ventajas:

- Ya es el concepto tecnico de template.
- Es globalizable (`workspaceId = null`).

Desventajas:

- `FunnelTemplate` no contiene steps reales, publicaciones, FlowGraph completo con IDs reales, ni la experiencia editorial completa del Builder.
- El Builder moderno opera sobre `FunnelInstance`/`FunnelStep` y publicaciones hibridas, no solo `FunnelTemplate`.
- Forzarlo como master implicaria redisenar Builder y runtime.

Recomendacion: no para Arsenal real. `FunnelTemplate` debe seguir como base tecnica, no como Master Funnel completo.

## Recomendacion tecnica

Usar `FunnelArsenalTemplate` como catalogo y `sourceFunnelInstanceId` como puntero al Master Funnel real.

Agregar un servicio dedicado:

```text
FunnelArsenalTemplate
  -> sourceFunnelInstanceId
      -> clone full FunnelInstance aggregate
          -> create target Funnel
          -> create target FunnelInstance
          -> create target FunnelSteps
          -> rewrite FlowGraph
          -> create target FunnelPublication
```

Nombre sugerido:

- `FunnelInstanceCloneService`
- o `FunnelArsenalCloneService` si queda acoplado al Arsenal.

Responsabilidades del servicio:

- Cargar source con `funnel`, `template`, `steps`, publicaciones opcionales para SEO.
- Validar source master.
- Sanitizar JSON y secretos.
- Crear funnel/instance/steps target.
- Reescribir FlowGraph.
- Resolver code y path.
- Crear publication opcional.
- Sincronizar runtime context.
- Devolver `publicationId`, `publicUrl`, `funnelInstanceId`, `pathPrefix`.

## Super Admin: como crear Master Funnels hoy

Forma mas facil con el codigo actual:

1. Crear un workspace/team interno tipo `LeadFlow Arsenal`.
2. Crear un dominio interno de edicion, por ejemplo `arsenal-internal.leadflow.kuruk.in` o un host protegido equivalente.
3. Usar el Builder/Hybrid Publication actual para crear y editar el funnel completo.
4. Cuando el funnel este aprobado, registrar su `sourceFunnelInstanceId` en `/admin/funnel-arsenal` junto con `blueprintKey`, `vertical`, `label`, `description`, `recommendedFor`, `difficulty`, `pathSuggestion`, `status`.

Por que un tenant interno:

- El Builder actual necesita contexto de team y, para hybrid, normalmente una publicacion editable.
- Mantiene aislados dominios, leads, publicaciones y pruebas.
- Permite permisos de Super Admin sin mezclar activos reales de clientes.

Reglas para ese tenant:

- Nombre sugerido: `LeadFlow Arsenal`.
- No usarlo para capturar leads reales.
- No conectar pixels, CAPI, WhatsApp real, ad wheels ni tracking productivo.
- Usar `FunnelTemplate` globales (`workspaceId = null`) o asegurarse de que el clonador copie/mapee templates.
- Las publicaciones internas del master no se clonan.
- Idealmente bloquear indexacion y no exponer links de master como producto final.

## Member/Team: habilitar un embudo

Flujo recomendado:

1. Usuario ve templates filtrados por `CommercialProfile.blueprintKey`.
2. Click `Habilitar`.
3. Backend valida perfil, disponibilidad del template y source master.
4. Backend clona el Master Funnel al `Team` del usuario.
5. Backend crea `FunnelPublication` propia.
6. Backend resuelve path unico.
7. Tracking/secrets quedan vacios.
8. Devuelve URL publica real.

Servicios reutilizables:

- `FunnelArsenalService` para perfil, catalogo, idempotencia por template y respuesta a member.
- `normalizePublicationPathPrefix` y reglas de conflicto de `FunnelPublicationsService`.
- `RuntimeContextConfigSyncService`.
- `lintFunnelDraft`.
- `PublicFunnelRuntimeService` no se toca; debe seguir resolviendo por host/path.

Servicios a crear o refactorizar:

- `FunnelInstanceCloneService` con reescritura de FlowGraph.
- `PublicationPathAllocator` opcional para centralizar paths y fallback.
- Validador de Master Funnel para asegurar que el source es clonable.
- Sanitizador JSON de secretos reutilizable.

Mayor riesgo:

- Reescritura incompleta de FlowGraph.
- Templates no globales que rompan futuras ediciones.
- Secretos embebidos en JSON.
- Colisiones de path en host compartido.
- Crear publicaciones activas sin dominio fallback seguro.

## Publicaciones al habilitar

Opciones:

### A. Crear publicacion activa automaticamente

Mejor UX para individual basico.

Es segura si:

- Hay dominio fallback controlado.
- Path es unico.
- Funnel clonado pasa lint minimo.
- Tracking/secrets estan vacios.
- El master no trae handoff real de otro tenant.

Recomendacion: usar A para cuentas individuales cuando el fallback este resuelto.

### B. Solo crear FunnelInstance y publicar despues

Mas seguro tecnicamente, peor UX.

Recomendado si:

- No existe dominio fallback.
- El master tiene warnings de lint.
- El team requiere configurar dominio/tracking antes de publicar.

### C. Crear publication draft y mostrar "Publicar"

Balance razonable para team admins.

Recomendacion:

- Individual basico: A.
- Team comercial/empresa: C si hay configuracion pendiente.
- Fallback temporal mientras se construye dominio compartido: B o C.

## Dominios y estrategia de paths

### Estado actual

- `Domain.normalizedHost` es unico global.
- Los servicios de creacion de publicaciones para team validan que domain y funnel pertenezcan al mismo team.
- El runtime podria resolver publicaciones en un host compartido, pero el modelo/documentacion actual tratan `Domain` como owner de un team.

### Si el usuario ya tiene dominio activo

Usar el dominio primario del team.

Path:

```text
/{pathSuggestion}
```

Si hay conflicto:

```text
/{pathSuggestion}-2
/{pathSuggestion}-3
```

### Si el usuario individual no tiene dominio

Hay dos rutas tecnicas:

1. Subdominio unico por team: `{teamSlug}.leadflow.kuruk.in/{pathSuggestion}`
2. Host compartido: `leadflow.kuruk.in/u/{teamSlug}/{pathSuggestion}`

Menor riesgo con las invariantes actuales: subdominio unico por team, porque cada team puede tener su propio `Domain` con `normalizedHost` unico.

Mejor URL de producto si se quiere host compartido: `/u/{teamSlug}/{pathSuggestion}`. Es compatible con el runtime actual, pero requiere una decision explicita de arquitectura: permitir publicaciones de muchos teams bajo un unico `Domain` de plataforma, o crear un servicio especial de Arsenal que maneje ese dominio compartido sin romper los servicios existentes.

No recomiendo `leadflow.kuruk.in/{pathSuggestion}` para fallback global, porque `/evaluacion` colisionaria entre muchos usuarios.

No recomiendo `/f/{publicationId}` como URL principal humana. Es buen fallback tecnico o permalink interno, pero es pobre para compartir y SEO.

Recomendacion practica:

- Fase 1: usar dominio activo del team; si no existe, mantener error actual o crear subdominio unico por team.
- Fase 2: agregar fallback compartido `leadflow.kuruk.in/u/{teamSlug}/{pathSuggestion}` con una abstraccion clara de "platform shared domain".
- Siempre usar path tenant-scoped en host compartido.

## Como evitar colisiones

Reglas:

- En dominio propio o subdominio unico: empezar con `pathSuggestion` y sufijar `-2`, `-3`.
- En host compartido: prefijar por tenant:

```text
/u/{teamSlug}/{pathSuggestion}
```

- Si `teamSlug` colisiona o cambia, usar `team.code` estable o slug persistido.
- Reservar namespaces del runtime: `/ref`, `/promo`, `/admin`, `/team`, `/member`, `/login`, `/api`, `/f`, `/u`, `/p`.
- Mantener `@@unique([domainId, pathPrefix])` como bloqueo final.

Mejor opcion compatible con runtime actual:

```text
/u/{teamSlug}/{pathSuggestion}
```

si se adopta host compartido.

Mejor opcion compatible con ownership actual:

```text
https://{teamSlug}.leadflow.kuruk.in/{pathSuggestion}
```

si se puede operar wildcard/subdominios de plataforma.

## Deuda tecnica del Arsenal actual

Conservar:

- `FunnelArsenalTemplate` como catalogo.
- `templateKey`, `blueprintKey`, `vertical`, `label`, `description`, `goal`, `recommendedFor`, `cta`, `pathSuggestion`, `difficulty`, `status`.
- UI `/admin/funnel-arsenal` como superficie de registro.
- UI `/member/funnels` como superficie de habilitacion.
- Idempotencia por `arsenal-{templateKey}`.

Refactorizar:

- Extraer clonacion a un servicio dedicado.
- Reescribir FlowGraph durante clonacion.
- Validar source master antes de activar.
- Resolver templates globales vs workspace internos.
- Centralizar path allocation.
- Sanitizar secretos.
- Distinguir `enabled` por templateKey/source, no solo por `funnelInstance.code` si en el futuro hay versiones.

Eliminar o deprecar:

- Creacion minima desde metadata para templates activos reales.
- `blocksPresetKey` como fuente principal del funnel. Puede quedar como fallback legacy.
- `sourceFunnelId` manual si se puede derivar desde `sourceFunnelInstanceId`.

No tocar todavia:

- Runtime publico.
- Modelo de leads/assignments.
- Ad wheels.
- Tracking/CAPI productivo.
- Cloudflare/domain onboarding.
- Builder visual mas alla de usarlo para crear masters.

## Migracion sin romper

Fase de compatibilidad:

1. Mantener templates actuales estaticos y DB.
2. Seguir mostrando cards aunque no tengan `sourceFunnelInstanceId`.
3. Para nuevos templates reales, exigir `sourceFunnelInstanceId`.
4. Cambiar `enable` para:
   - si hay source: usar deep clone nuevo;
   - si no hay source: usar fallback minimo solo para legacy.
5. Agregar advertencia admin: `active` sin source = legacy/minimal.
6. Poblar gradualmente masters por blueprint.
7. Cuando todos los templates productivos tengan source, archivar o marcar legacy los que sigan siendo metadata.

Sin migracion inmediata:

- No hace falta crear `MasterFunnel` ahora.
- No hace falta cambiar schema para empezar, salvo que queramos FK/flags mas adelante.

Migracion futura opcional:

- Agregar `masterStatus`, `version`, `sourceFunnelInstanceId` FK formal o nueva entidad `MasterFunnel`.
- Agregar `isMaster` en `FunnelInstance` solo como ayuda de filtrado, no como catalogo.

## Plan por fases

### Fase 0: decision y guardrails

- Aprobar que `FunnelArsenalTemplate` sigue como catalogo.
- Crear tenant interno `LeadFlow Arsenal`.
- Definir dominio interno de edicion.
- Documentar regla: masters no tienen datos reales ni secretos.

Esfuerzo: 0.5-1 dia.

### Fase 1: clonador profundo seguro

- Crear `FunnelInstanceCloneService`.
- Cargar source con `funnel`, `template`, `steps`, publicaciones opcionales.
- Crear target `Funnel`, `FunnelInstance`, `FunnelStep[]`.
- Reescribir `conversionContract.flowGraph`.
- Sanitizar secrets.
- Tests unitarios de:
  - clon multi-step;
  - graph rewrite;
  - no tokens/pixels/domains;
  - code/path collision;
  - template workspace global/copy.

Esfuerzo: 2-4 dias.

### Fase 2: integrar Arsenal

- Reemplazar `cloneSourceFunnelInstance` por el clonador.
- Mantener fallback minimo para legacy.
- Devolver `funnelInstanceId` ademas de `publicationId/publicUrl` si conviene para UI.
- Validar `sourceFunnelInstanceId` antes de activar template.
- Agregar mensajes admin de calidad del master.

Esfuerzo: 1-2 dias.

### Fase 3: dominio fallback

- Opcion menor riesgo: auto-crear/asegurar system subdomain por team.
- Opcion host compartido: introducir `PlatformSharedDomainPublicationService` y path `/u/{teamSlug}/{path}`.
- Agregar reservas de path namespaces.
- Tests de colision y runtime.

Esfuerzo: 2-4 dias segun estrategia.

### Fase 4: Super Admin workflow

- Mejorar `/admin/funnel-arsenal` para seleccionar master desde lista, no pegar ID manual.
- Mostrar estado: clonable, missing source, graph warnings, template workspace risk.
- Boton "Registrar en Arsenal" desde una publicacion/funnel del tenant Arsenal.

Esfuerzo: 2-3 dias.

### Fase 5: versionado y hardening

- Versionar masters.
- Soportar upgrades de funnels ya habilitados.
- Considerar entidad `MasterFunnel` si aparece marketplace/approval/empresa.

Esfuerzo: 4-8 dias.

## Archivos y modulos a tocar

Backend:

- `apps/api/src/modules/funnel-arsenal/funnel-arsenal.service.ts`
- `apps/api/src/modules/funnel-arsenal/funnel-arsenal.module.ts`
- Nuevo: `apps/api/src/modules/funnel-arsenal/funnel-arsenal-clone.service.ts` o modulo compartido `funnel-cloning`.
- `apps/api/src/modules/funnel-arsenal/funnel-arsenal.service.spec.ts`
- `apps/api/src/modules/funnel-publications/funnel-publications.service.ts` si se extrae allocator.
- `apps/api/src/modules/shared/publication-resolution.utils.ts` si se agregan helpers de paths reservados.
- `apps/api/src/modules/runtime-context/runtime-context-config-sync.service.ts` solo para reutilizar, no modificar necesariamente.
- `packages/shared/funnel-lint` para tests/validacion si hace falta.

Frontend:

- `apps/web/components/system/system-funnel-arsenal-client.tsx`
- `apps/web/lib/system-funnel-arsenal.ts`
- `apps/web/components/member-operations/funnel-arsenal-client.tsx` solo si cambia payload.

Docs:

- `docs/account-model/funnel-arsenal.md`
- Este documento.

Prisma:

- No requerido para Fase 1 si se conserva Opcion A.
- Futuro opcional: FK/versionado/master flags.

## Riesgos

- FlowGraph roto por IDs antiguos.
- Master con `FunnelTemplate.workspaceId` interno no editable por target.
- Secretos en JSON copiados accidentalmente.
- Publicaciones activas en host compartido sin namespace tenant.
- Dominio fallback no alineado con ownership actual.
- Runtime context no sincronizado tras clon.
- SEO/OG del master apuntando a assets privados o dominios internos.
- Idempotencia por `templateKey` impide crear una nueva version si no se define estrategia.

## Estimacion de esfuerzo

Camino minimo seguro para transformar el Arsenal:

- Analisis/guardrails: 0.5-1 dia.
- Deep clone + tests: 2-4 dias.
- Integracion Arsenal: 1-2 dias.
- Fallback domain/path: 2-4 dias.
- UI admin mejorada: 2-3 dias.

Total recomendado: 1.5 a 2.5 semanas para una version solida, sin versionado avanzado.

Version mas pequena:

- Solo deep clone + fix FlowGraph + usar dominios activos existentes: 3-5 dias.

## Decision propuesta

Avanzar con Opcion A ahora:

```text
FunnelArsenalTemplate = catalogo comercial
sourceFunnelInstanceId = Master Funnel real
LeadFlow Arsenal tenant = lugar donde se construyen masters
FunnelInstanceCloneService = clonador seguro
```

No crear `MasterFunnel` todavia. Primero resolver bien la clonacion del agregado real. Una vez que el clonador sea confiable, el catalogo puede evolucionar a `MasterFunnel` o versionado sin rehacer la parte mas riesgosa.

## Implementacion Fase 13

Estado implementado:

- `FunnelArsenalTemplate` se mantiene como indice/catalogo global.
- El contenido real preferido vive en `FunnelArsenalTemplate.sourceFunnelInstanceId`.
- `FunnelMasterClonerService` clona el agregado real hacia el team destino.
- `POST /v1/funnel-arsenal/me/:templateKey/enable` usa `master_clone` si existe source y conserva `fallback` minimo si no existe.
- La respuesta de enable incluye `source`, `funnelInstanceId`, `publicationId`, `publicUrl` y `pathPrefix`.
- `/system/funnel-arsenal` permite guardar `sourceFunnelInstanceId` manual y devuelve etiqueta si el source existe.

### Modelo auditado

Entidades estructurales clonables:

- `Funnel`: base target nueva con `workspaceId`, `defaultTeamId`, `code`, `name`, `description`, `stages`, `entrySources` y `config` saneado.
- `FunnelInstance`: instancia target nueva con `workspaceId`, `teamId`, `templateId`, `funnelId`, `code`, `structuralType`, `conversionContract`, `settingsJson` y `mediaMap` saneados.
- `FunnelStep`: steps target nuevos con ids nuevos, `slug`, `stepType`, `position`, `isEntryStep`, `isConversionStep`, `blocksJson`, `mediaMap` y `settingsJson`.
- `FunnelPublication`: no se clona; se crea una publicacion nueva del target.

Campos de ownership comercial:

- `workspaceId`, `teamId`, `defaultTeamId`, `rotationPoolId`, `trackingProfileId`, `handoffStrategyId`, `domainId`, `publicationId`.
- En el clone estos campos se asignan al target o quedan `null` cuando corresponden a configuracion comercial del source.

Campos runtime:

- `FunnelInstance.conversionContract`
- `FunnelInstance.settingsJson`
- `FunnelInstance.mediaMap`
- `FunnelStep.slug`
- `FunnelStep.blocksJson`
- `FunnelStep.mediaMap`
- `FunnelStep.settingsJson`
- `FunnelPublication.pathPrefix`
- `FunnelPublication.seoTitle`, `seoDescription`, `ogImageUrl`, `faviconUrl`, `runtimeHealthStatus`.

Campos secrets o sensibles que se resetean/no copian:

- `trackingProfileId`
- `handoffStrategyId`
- `metaPixelId`
- `tiktokPixelId`
- `metaCapiToken`
- `tiktokAccessToken`
- claves JSON con `secret`, `token`, `authorization`, `cookie`, `api-key`, `access-token`, `capi`, `pixel`, `webhook`.
- URLs firmadas con query params tipo `signature`, `expires`, `policy`, `token`, `x-amz-*`, `x-goog-*`.

Entidades que no se clonan:

- `Domain`
- publicaciones activas del master
- `Lead`
- `Assignment` / `CrmLeadAssignment`
- `FunnelEvent` / eventos runtime
- `Visitor` / sesiones runtime
- `TrackedLink` / shortlinks / ref links
- WhatsApp / messaging connections
- CAPI / tracking profiles / conversion mappings secretos
- automation dispatches

### Reescritura de FlowGraph

El clonador genera `stepIdMap` antes de crear steps:

```text
sourceStepIdA -> newStepIdA
sourceStepIdB -> newStepIdB
```

Luego recorre recursivamente `conversionContract`, `settingsJson`, `blocksJson`, `mediaMap` y `Funnel.config`.

Reglas:

- si una clave es referencia conocida (`stepId`, `sourceStepId`, `targetStepId`, `nextStepId`, `fromStepId`, `toStepId`, `entryStepId`, `conversionStepId`, `fallbackStepId`), el valor se reemplaza con el id nuevo.
- si cualquier string coincide exactamente con un source step id, tambien se reemplaza.
- las claves sensibles se eliminan.
- media publica se conserva por URL; media firmada se nulifica.

### Path y dominio

Si el team destino tiene dominio custom activo (`domainType != system_subdomain`):

```text
/{pathSuggestion}
```

Si no tiene dominio custom:

```text
https://leadflow.kuruk.in/u/{teamSlug}/{pathSuggestion}
```

La implementacion usa un unico `Domain` plataforma para el host de `PUBLIC_REF_BASE_URL` o `leadflow.kuruk.in` y reserva `pathPrefix` completo. Si hay colision, agrega sufijo:

```text
/u/margarita-pasos/evaluacion-2
```

No se usa `/ref/:slug` para funnels.

### Espacio interno Arsenal

Se agrego script idempotente:

```bash
pnpm --filter @leadflow/api seed:arsenal-workspace
```

Crea o reutiliza:

- Workspace: `LeadFlow Arsenal` (`leadflow-arsenal`)
- Team: `LeadFlow Arsenal Masters` (`leadflow-arsenal-masters`)

No se agrego campo `system/internal` nuevo. Por ahora el espacio queda claramente nombrado y documentado como tecnico, no comercial.

### Admin

El minimo viable de Fase 13 queda en `/system/funnel-arsenal`:

- pegar `sourceFunnelInstanceId`
- guardar metadatos de busqueda (`industry`, `businessModel`, `funnelType`, `funnelFormat`, `objective`, `stepsCount`, `language`, `country`, `market`)
- ver etiqueta del source si existe

Queda como opcion futura el boton "Guardar en Arsenal" desde builder/admin del FunnelInstance.
