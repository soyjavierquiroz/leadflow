# ActionLinkResolver v1

Fecha: 2026-05-31 (UTC)

## 1. Contexto

LeadFlow ya cuenta con una base funcional para enlaces identificados:

- `TrackedLink` persiste enlaces operativos enviados a automatizacion, con URL larga, short URL opcional, hash del `ctx`, estado, expiracion, contador de clicks y metadata.
- `FunnelEvent` es el ledger canonico para eventos de funnel, journey y lifecycle de links.
- `POST /v1/automation/generate-tracked-link` genera/reusa links especializados para abrir el VSL/presentacion con contexto firmado.
- El runtime publico puede hidratar el `ctx`, validar revocacion/expiracion y reconstruir el handoff de WhatsApp asignado.

El siguiente problema no es acortar URLs genericas, sino evitar que IA, Kloser o n8n escriban URLs finales dentro de mensajes. El flujo deseado es:

```text
IA/Kloser/n8n define una intencion permitida
-> ActionLinkResolver resuelve la URL correcta
-> LeadFlow crea o reusa un TrackedLink
-> LeadFlow registra FunnelEvent
-> n8n solo envia el mensaje
```

## 2. Decision

Para v1:

- No crear una tabla fisica `ActionLink`.
- Usar `TrackedLink` como tabla fisica de persistencia.
- Crear `ActionLinkResolver` como capa logica de resolucion, policy, idempotencia y eventos.
- Mantener `generate-tracked-link` como contrato legacy-compatible.
- Migrar `generate-tracked-link` posteriormente para que use `ActionLinkResolver` internamente sin cambiar su respuesta.

La razon principal es que `TrackedLink` ya cubre la parte durable critica: identidad, expiracion, revocacion, clicks, shortener y relacion con el funnel. Duplicar esa responsabilidad en una tabla nueva aumentaria el riesgo de divergencia antes de tener acciones no-VSL reales.

## 3. Principios

- IA, Kloser y n8n no escriben URLs finales.
- n8n recibe una URL ya resuelta o pide resolver por `actionKey`.
- El resolver valida accion, contexto, policy y ownership antes de emitir un link.
- El resolver crea o reusa `TrackedLink`.
- El resolver registra `FunnelEvent`.
- El tracking nunca debe depender de detectar URLs en texto libre.
- `generic.open_url` queda deshabilitado en fase 1.
- LeadFlow conserva la propiedad de funnel, assignment, ownership, `TrackedLink` y `FunnelEvent`.
- Kloser decide misiones y seguimiento, no URLs finales.

## 4. Conceptos

`ActionLink`

Enlace enviable al lead, producido desde una intencion permitida y respaldado por un `TrackedLink`. No es una tabla nueva en v1; es una abstraccion logica sobre la persistencia existente.

`ActionLinkResolver`

Servicio que recibe una intencion, valida contexto y policy, resuelve el destino, crea o reusa un `TrackedLink`, y devuelve una URL enviable.

`actionKey`

Identificador canonico y namespaced de la accion. Ejemplo: `leadflow.open_vsl`.

`appKey`

Namespace de la aplicacion o proveedor que resuelve la accion. En fase 1: `leadflow`.

`purpose`

Razon operacional del link y parte de la idempotencia. Ejemplos: `vsl_initial`, `vsl_reminder`, `vsl_finish_reminder`, `vsl_followup`.

`channel`

Canal previsto para entregar el link. Ejemplo: `whatsapp`.

`params`

Parametros estructurados para resolver la accion. Para `leadflow.open_vsl`, `params.stepKey` indica el paso del funnel y debe tener default `presentacion`.

`provider`

Proveedor que entrega la URL final enviable. Para shortener: `yourls` o `fallback_long_url`.

`result`

Respuesta normalizada del resolver: URL enviable, URL larga, short URL opcional, provider, `trackedLinkId`, expiracion, cache hit y metadata.

`idempotencyKey`

Clave opcional enviada por cliente para correlacionar retries o lotes. No debe reemplazar la idempotencia server-side.

`paramsHash`

Hash canonico de `params` normalizados. Futuramente permite diferenciar acciones con el mismo `actionKey` y `purpose` pero distinto destino logico.

## 5. API propuesta

Endpoint principal futuro:

```http
POST /v1/action-links/resolve
```

Input:

```json
{
  "leadId": "...",
  "assignmentId": "...",
  "appKey": "leadflow",
  "actionKey": "leadflow.open_vsl",
  "purpose": "vsl_reminder",
  "channel": "whatsapp",
  "params": {
    "stepKey": "presentacion"
  },
  "idempotencyKey": "optional"
}
```

Output:

```json
{
  "ok": true,
  "actionKey": "leadflow.open_vsl",
  "purpose": "vsl_reminder",
  "url": "...",
  "longUrl": "...",
  "shortUrl": "...",
  "provider": "fallback_long_url|yourls",
  "trackedLinkId": "...",
  "cached": true,
  "expiresAt": "...",
  "metadata": {}
}
```

Alias opcional de compatibilidad para automatizaciones:

```http
POST /v1/automation/resolve-action-link
```

El recurso canonico recomendado es `/v1/action-links/resolve`; el alias solo deberia existir si facilita migrar workflows existentes.

## 6. Fase 1 action mapping

Accion real soportada:

### `leadflow.open_vsl`

Reglas:

- `params.stepKey` default: `presentacion`.
- Usa el `ctx` firmado existente del runtime publico.
- Crea o reusa `TrackedLink` activo.
- Puede preservar el handoff de WhatsApp asignado mediante el wrapper legacy `generate-tracked-link`.
- `actionKey = leadflow.open_vsl`.
- `appKey = leadflow`.
- `TrackedLink.action = open_vsl`.

Acciones explicitamente no soportadas en fase 1:

- `generic.open_url`
- `calendar.book_call`
- `meeting.join_zoom`
- `leadflow.open_registration`
- `content.open_asset`
- `wallet.open_payment`

Estas acciones quedan documentadas como providers/stubs futuros. No deben aceptar URLs finales desde IA, Kloser ni n8n hasta tener fuente de verdad y policy propias.

## 7. Idempotencia

La idempotencia actual del VSL se basa en:

```text
leadId + assignmentId + funnelStepId + purpose + status active
```

Antes de crear un link nuevo, el flujo actual expira links activos vencidos para esa combinacion. Luego busca un link activo vigente. Si no lo encuentra, intenta crear. Si la creacion choca con una constraint unica por carrera concurrente, hace refetch del link activo.

Patron a conservar:

```text
find active
-> create
-> catch P2002
-> refetch active
```

Idempotencia deseada para acciones futuras:

```text
workspace/team + leadId + assignmentId + actionKey + purpose + channel + paramsHash
```

Ejemplos de `purpose`:

- `vsl_initial`
- `vsl_reminder`
- `vsl_finish_reminder`

La decision de compartir o separar links por `purpose` debe ser explicita. Si el negocio necesita medir misiones distintas, usar propositos distintos. Si solo cambia el texto del mensaje y se quiere estabilizar el mismo destino, puede reusarse el mismo `purpose`.

## 8. Estrategia FunnelEvent

En fase 1 se mantienen los eventos existentes:

- `tracked_link_created`
- `tracked_link_reused`
- `tracked_link_opened`
- `tracked_link_revoked`

No emitir todavia eventos duplicados como `action_link_created` o `action_link_reused`.

El evento debe seguir usando:

- `eventFamily = action_link`
- `trackedLinkId`
- `actionLinkKey`
- `purpose` en payload o metadata
- `channel` en payload o metadata cuando el resolver lo reciba

Evento futuro opcional:

- `action_link_resolved`

Ese evento podria servir para observabilidad de requests al resolver, especialmente cuando un request termina en reuse. No debe duplicar innecesariamente el lifecycle fisico de `TrackedLink`.

## 9. Compatibilidad

`POST /v1/automation/generate-tracked-link` permanece intacto.

Mas adelante debe convertirse en wrapper sobre `ActionLinkResolver` con:

```text
actionKey = leadflow.open_vsl
purpose = vsl_followup
channel = whatsapp
params.stepKey = dto.stepKey
```

La respuesta legacy debe conservar:

- `token`
- `longUrl`
- `shortUrl`
- `url`
- `whatsappUrl`
- `cached`
- `trackedLinkId`
- `shortCode`

En respuestas cached, `token` debe seguir siendo `null` para no reexponer el token plano.

## 10. Seguridad

Fase 1:

- `SystemApiGuard` es suficiente para proteger endpoints internos de automatizacion.
- El resolver debe validar lead, assignment, publication, team y ownership server-side.
- No confiar en `workspaceId` ni `teamId` enviados por payload.
- No exponer `ctx` token en respuestas cached.
- `generic.open_url` permanece deshabilitado.

Futuro:

- Separar credenciales por cliente: n8n, Kloser e internal.
- Agregar policy por `appKey/actionKey`.
- Para links externos, exigir `https`, allowlist por dominio y prohibir open redirects.
- Definir TTL por accion y no depender siempre del TTL global de identidad.

## 11. Relacion con Runtime Context

Runtime Context es fuente canonica de:

- tenant
- app
- vertical
- runtime_config
- bindings operativos de canal cuando aplique

LeadFlow sigue siendo duenio de:

- funnel
- assignment
- ownership
- `TrackedLink`
- `FunnelEvent` de funnel

El resolver puede ser appKey-based. En v1 solo existe el provider LeadFlow, pero el contrato debe permitir que otra app resuelva sus propias acciones en el futuro sin mover la propiedad de los links de LeadFlow al Runtime Context.

## 12. Relacion con Kloser y n8n

Separacion de responsabilidades:

- Kloser decide mision, estrategia y siguiente accion.
- LeadFlow resuelve la URL.
- n8n envia el mensaje.

Payload recomendado hacia n8n:

```json
{
  "actionKey": "leadflow.open_vsl",
  "purpose": "vsl_reminder",
  "url": "...",
  "trackedLinkId": "...",
  "cached": true,
  "metadata": {}
}
```

Kloser y n8n no deben generar URLs finales ni aplicar shortener por su cuenta. Si necesitan un link, deben pedirlo por `actionKey` o recibirlo ya resuelto desde LeadFlow.

## 13. Cleanup y cascade

Politicas recomendadas:

- Lead spam o deleted: revocar links activos y preservar auditoria donde sea posible.
- Cambio de assignment: revocar links dependientes del asesor, ownership o handoff asignado.
- Funnel unpublished: links activos deben revocarse o responder `410 TRACKED_LINK_UNAVAILABLE`.
- Mision cancelada: revocacion policy-driven; no toda cancelacion operacional implica que el link deba morir.
- Hard delete: puede hacer cascade sobre `TrackedLink`, pero `FunnelEvent` debe preservar historia mediante relaciones nullable cuando aplique.

La regla practica es revocar cuando el link ya no representa un destino seguro, autorizado o correcto para ese lead. Borrar fisicamente debe ser la excepcion, no el mecanismo normal de control operacional.

## 14. Migration plan por commits

Orden recomendado:

1. Docs only: crear `docs/action-link-resolver-v1.md`.
2. Crear `ActionLinkResolverService` base con soporte unico para `leadflow.open_vsl`, sin endpoint.
3. Hacer que `generate-tracked-link` use el resolver internamente con respuesta unchanged.
4. Crear `POST /v1/action-links/resolve` solo para `leadflow.open_vsl`.
5. Mas adelante, hardening de schema para `channel`, `actionKey`, `paramsHash`, `idempotencyKey` o campos de target si las acciones no-VSL lo requieren.

Fuera de alcance de esta fase:

- EventRouter
- Kloser sink
- CAPI/TikTok
- browser pixels
- acciones genericas externas
- pagos, calendario, Zoom o assets reales

## 15. Riesgos

- Duplicar `TrackedLink` con una tabla `ActionLink` prematura.
- Romper el contrato actual de `generate-tracked-link`.
- Definir mala idempotencia y crear demasiados links.
- Habilitar `generic.open_url` antes de tener allowlist y policy.
- Emitir eventos duplicados y ensuciar `FunnelEvent`.
- Acoplar Kloser a internals de LeadFlow.
- Resolver payment, calendar o Zoom sin fuente de verdad.
- Permitir que IA o n8n vuelvan a escribir URLs finales en texto.
