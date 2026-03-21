# Funnel & Tracking Model v1

Fecha: 2026-03-21 (UTC)

## Objetivo
Definir una base estructural para funnels y tracking en Leadflow que soporte SaaS multi-tenant, multi-domain y multi-funnel, sin implementar aun integraciones reales con Meta, TikTok o handoff operativo.

## Definicion formal de funnel en Leadflow
Un `Funnel` en Leadflow es una unidad operativa de captacion y conversion que organiza una secuencia de pasos, reglas de handoff y tracking de eventos para un objetivo comercial concreto dentro de un `Workspace`.

En terminos de producto, un funnel debe permitir:
- capturar trafico y visitantes
- convertir visitantes en leads
- registrar avance por pasos
- disparar handoff inmediato o diferido
- asociar conversiones a un dominio, un pool de asignacion y uno o mas perfiles de tracking

## Distincion recomendada para v1

### `FunnelTemplate`
Plantilla reutilizable que define la estructura abstracta del funnel.

Responsabilidad:
- tipo de funnel
- catalogo y orden de steps
- configuracion base de tracking
- estrategia de handoff por defecto

No representa una publicacion real ni un dominio real.

### `FunnelInstance`
Implementacion concreta de una plantilla dentro de un `Workspace`.

Responsabilidad:
- dominio o path donde vive
- team y rotation pool por defecto
- tracking profile efectivo
- estado operativo
- overrides de copy, pasos o handoff si aplica

Es la entidad que recibe trafico real, genera leads y se conecta a persistencia operativa.

### `FunnelStep`
Unidad de experiencia dentro de un funnel.

Responsabilidad:
- tipo de paso
- orden
- condicion de entrada o salida
- evento(s) de tracking esperados
- criterio de conversion local

El step no debe contener logica comercial compleja embebida; debe describir la experiencia y sus transiciones.

## Tipos de funnel recomendados para v1

### `simple_capture`
Un solo paso orientado a captar datos y generar lead.

Uso:
- campañas directas
- formularios simples
- testing rapido de oferta

### `landing_thank_you_whatsapp`
Landing de conversion seguida por thank you con CTA de WhatsApp.

Uso:
- captacion con handoff conversacional inmediato
- campañas donde la accion prioritaria es iniciar contacto

### `landing_vsl_conversion`
Landing o bridge page, reproduccion VSL y conversion posterior.

Uso:
- ofertas que requieren educacion previa
- trafico templado o frio

### `landing_lead_presentation`
Captura del lead antes de mostrar una presentacion o siguiente activo.

Uso:
- lead gating
- secuencias donde la identificacion debe ocurrir antes del contenido principal

### `three_step_progressive`
Funnel de tres pasos con progresion guiada.

Uso:
- calificacion ligera
- micro-compromisos antes de conversion final

### `handoff_immediate`
Funnel cuya conversion principal activa un handoff inmediato al sponsor o canal externo.

### `handoff_deferred`
Funnel cuya conversion principal crea lead y deja el handoff para un paso posterior, una cola o una automatizacion.

## Tipos de step recomendados para v1
- `landing`: pagina principal de entrada.
- `lead_capture`: formulario o captura principal del lead.
- `thank_you`: confirmacion y siguiente accion.
- `vsl`: video sales letter o contenido audiovisual principal.
- `presentation`: contenido puente o de profundizacion.
- `qualification`: preguntas de filtrado o perfilado.
- `cta_bridge`: paso con CTA dominante hacia siguiente etapa.
- `handoff`: paso que inicia transferencia a WhatsApp, sponsor o cola.
- `confirmation`: confirmacion final despues de handoff o registro.
- `redirect`: salida controlada a URL externa o interna.

## Estrategias de handoff y post-conversion

### `immediate_whatsapp`
Al crear el lead o completar el step de conversion, se conduce al usuario a WhatsApp.

### `immediate_internal_assignment`
La conversion genera lead y assignment en el mismo flujo, con handoff a sponsor interno.

### `deferred_queue`
La conversion genera lead, pero el handoff se difiere a una cola operativa o proceso posterior.

### `deferred_review`
El lead queda pendiente para validacion humana antes de asignarse o contactarse.

### `scheduled_followup`
El funnel cierra la conversion y propone agenda, callback o contacto en una ventana posterior.

### `content_continuation`
Luego de capturar el lead, el usuario continua a una presentacion, VSL o thank you enriquecido sin handoff inmediato.

## Asociaciones clave del funnel

### Funnel y domain
Cada `FunnelInstance` debe poder vincularse a un dominio, subdominio o combinacion dominio + path.

Objetivo:
- soportar multi-domain sin hardcodes
- permitir varios funnels en un mismo dominio por path
- permitir un funnel por dominio completo cuando la estrategia lo requiera

Recomendacion v1:
- separar la nocion de funnel de la nocion de binding DNS/publicacion
- modelar la publicacion mediante una entidad de `DomainBinding`

### Funnel y rotation pool
Cada `FunnelInstance` puede tener:
- un `defaultRotationPool`
- overrides por step o por estrategia futura

En v1 basta con asociacion por defecto a nivel funnel. El override por step puede documentarse, pero dejarse para fase posterior.

### Funnel y tracking profile
Cada `FunnelInstance` debe apuntar a un `TrackingProfile` efectivo que concentre:
- proveedor o canal (`meta`, `tiktok`, futuros)
- pixel id / token / account id segun plataforma
- reglas de mapeo de eventos
- deduplicacion browser/server

## Eventos de tracking recomendados

### Eventos de funnel
- `funnel_viewed`
- `funnel_started`
- `funnel_completed`
- `funnel_abandoned`
- `lead_created`
- `handoff_started`
- `handoff_completed`

### Eventos de step
- `step_viewed`
- `step_completed`
- `step_skipped`
- `cta_clicked`
- `form_started`
- `form_submitted`
- `qualification_answered`
- `video_started`
- `video_progress`
- `video_completed`
- `redirect_triggered`

### Eventos operativos internos recomendados
- `assignment_requested`
- `assignment_created`
- `assignment_failed`
- `tracking_dispatch_queued`
- `tracking_dispatch_confirmed`
- `tracking_dispatch_failed`

## Eventos recomendados para Meta
Mapeo inicial sugerido:
- `funnel_viewed` -> `PageView`
- `step_viewed` en landing principal -> `ViewContent`
- `form_submitted` o `lead_created` -> `Lead`
- `qualification_answered` completa -> `CompleteRegistration`
- `handoff_started` a WhatsApp/contacto -> `Contact`

Criterios:
- usar `Lead` cuando exista identificacion real del prospecto
- usar `Contact` cuando el objetivo sea iniciar conversacion o handoff
- evitar eventos de ecommerce que no representen el comportamiento real del funnel

## Eventos recomendados para TikTok
Mapeo inicial sugerido:
- `funnel_viewed` -> `PageView`
- `step_viewed` en activo principal -> `ViewContent`
- `form_submitted` -> `SubmitForm`
- `lead_created` -> `CompleteRegistration`
- `handoff_started` -> `Contact`

Criterios:
- mantener mapeos simples y consistentes en MVP
- priorizar eventos con significado estable entre funnels distintos

## Estrategia de deduplicacion browser/server
Recomendacion v1:
- emitir eventos browser para visibilidad inmediata y optimizacion de pixel
- emitir eventos server para conversiones criticas y auditoria
- compartir un `eventId` estable entre ambos canales para la misma conversion
- asociar cada evento a:
  - `workspaceId`
  - `funnelInstanceId`
  - `funnelStepId` si aplica
  - `visitorId` o `leadId`
  - `sessionId`/`anonymousId` cuando exista
- guardar timestamps y source (`browser` o `server`) para reconciliacion

Regla practica MVP:
- browser + server solo para eventos de conversion relevantes
- browser only para eventos blandos como vistas o scroll profundo si luego se agregan
- deduplicacion basada en `eventId + provider + eventName`

## Que entra en MVP
- definicion de `FunnelTemplate`, `FunnelInstance` y `FunnelStep`
- catalogo estable de funnel types y step types
- asociacion conceptual de funnel con domain, rotation pool y tracking profile
- taxonomia de eventos interna de tracking
- mapeo base hacia Meta y TikTok
- estrategia de deduplicacion browser/server documentada
- propuesta de expansion del dominio y la persistencia

## Que queda para mas adelante
- integracion real con Meta Conversions API
- integracion real con TikTok Events API
- handoff real con WhatsApp
- reglas condicionales complejas por step
- A/B testing formal de funnels
- overrides por sponsor, geo, source o campaign
- attribution avanzada multi-touch
- tracking de revenue y closed-loop reporting

## Evaluacion del modelo actual
El modelo persistido actual cubre la base comercial de Leadflow, pero el concepto de `Funnel` sigue siendo demasiado plano para el producto multi-step y multi-domain que queremos soportar.

Limitaciones actuales:
- `Funnel.stages` como array de strings no describe steps con semantica rica.
- no existe separacion entre plantilla y despliegue operativo.
- no existe binding explicito entre funnel y dominio/path.
- no existe tracking profile por funnel.
- no existe modelado formal de handoff.

## Entidades sugeridas para la siguiente expansion
- `FunnelTemplate`
- `FunnelInstance`
- `FunnelStep`
- `TrackingProfile`
- `ConversionEventMapping`
- `DomainBinding`
- `HandoffStrategy`

Estas entidades deberian introducirse en una fase posterior de expansion del dominio y de persistencia, sin romper los agregados ya operativos de `Lead`, `Visitor`, `Assignment` y `RotationPool`.
