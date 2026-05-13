# Reveal & Handoff v1

Fecha: 2026-03-21 (UTC)

Actualizacion: 2026-05-13 (UTC)

## Objetivo

Cerrar el ciclo visible del funnel publico en Leadflow:

`lead captado -> sponsor asignado -> reveal -> CTA o redirect a WhatsApp`

Esta fase no integra todavia proveedores externos. El objetivo es dejar resuelto el handoff visible y trazable dentro del runtime publico.

## Que significa reveal en Leadflow

`Reveal` es el momento en que el thank-you del funnel muestra al sponsor asignado para esa sesion de captura.

En v1 el reveal usa:

- el `Assignment` resuelto durante el submit publico
- un subconjunto seguro de datos visibles del `Sponsor`
- el contexto local de la sesion del runtime para renderizar el thank-you sin requerir auth

Los datos visibles del sponsor en esta fase son:

- `id`
- `displayName`
- `email`
- `phone`

## Handoff modes implementados

Se soportan dos modos publicos en v1:

- `thank_you_then_whatsapp`
- `immediate_whatsapp`

Equivalencias con el modelo actual:

- `HandoffStrategy.type = content_continuation` puede resolver a `thank_you_then_whatsapp` cuando `settingsJson.mode` asi lo declara
- `HandoffStrategy.type = immediate_whatsapp` resuelve por defecto a `immediate_whatsapp`

## Como se obtiene el sponsor asignado en el thank-you

1. El submit publico crea o actualiza `Visitor` y `Lead`.
2. El runtime ejecuta assignment por round robin sobre el pool operativo.
3. La respuesta de `POST /v1/public/funnel-runtime/submissions` devuelve:
   - `assignment`
   - `nextStep`
   - `handoff`
4. La web persiste ese contexto en `sessionStorage`.
5. El bloque `sponsor_reveal_placeholder` lee la sesion, revela el sponsor asignado y construye el CTA operativo.

Actualizacion 2026-05-13:

- `apps/web/lib/public-funnel-assigned-sponsor.ts` centraliza la resolucion del asesor visible.
- La prioridad es: sponsor de la captura en sesion, `lastAssignment`, sponsor de `handoff`, sponsor/advisor del runtime.
- Los bloques `sponsor_reveal_placeholder`, `thank_you_reveal` y `whatsapp_handoff_cta` ya no resuelven sponsors por separado.
- La UI espera hidratacion cliente antes de revelar o redirigir para evitar mostrar un advisor estatico distinto al assignment real.
- Si se detecta discrepancia entre advisor previo en sesion y advisor del runtime, se registra warning `[Wheels-Sync]`.

## Como se construye el enlace a WhatsApp

El generador v1:

- normaliza el numero removiendo espacios, simbolos y prefijos no numericos
- conserva solo digitos aptos para `wa.me`
- rellena un mensaje inicial usando `messageTemplate`
- codifica el texto y construye `https://wa.me/<phone>?text=...`

Variables soportadas en el mensaje:

- `{{sponsorName}}`
- `{{leadName}}`
- `{{leadEmail}}`
- `{{leadPhone}}`
- `{{funnelName}}`
- `{{publicationPath}}`

## Comportamiento visible por modo

### `thank_you_then_whatsapp`

- el usuario llega al thank-you
- ve el sponsor asignado
- ve un CTA claro para abrir WhatsApp
- `cta_clicked` y `handoff_completed` se emiten cuando hace click

### `immediate_whatsapp`

- el usuario llega al thank-you
- el reveal muestra sponsor y fallback visual
- la pagina dispara redirect automatico a WhatsApp despues de hidratacion cliente y de un delay corto
- si el redirect no ocurre, queda un CTA manual disponible
- `cta_clicked` y `handoff_completed` se emiten cuando se ejecuta el redirect o el click manual

## Limpieza de contexto de sesion

La sesion publica queda scopeada por `publicationId`:

- `leadflow:publication:<publicationId>:anonymous-id`
- `leadflow:publication:<publicationId>:submission-context`
- `leadflow:publication:<publicationId>:entry-context`

Si la hidratacion detecta mismatch de publicacion, lead inexistente o publicacion invalida, la web limpia la sesion afectada, remueve `ctx` de la URL y recarga la ruta actual.

El contexto de entry pagado solo se reutiliza si la URL actual mantiene evidencia de campana (`/promo/*`, `/p/*`, click ids o `utm_source=ads`). Esto evita que una sesion pagada vieja contamine visitas organicas posteriores.

## Tracking conectado en esta fase

Se reutiliza `Tracking Events v1` para:

- `handoff_started` desde API al crear assignment
- `cta_clicked` desde web al activar el CTA o redirect
- `handoff_completed` desde web cuando realmente se dispara el handoff visible

## Seed de prueba

El seed deja dos publicaciones visibles:

- `/gracias` sobre la publicacion root `/` con modo `thank_you_then_whatsapp`
- `/oportunidad/gracias` sobre la publicacion `/oportunidad` con modo `immediate_whatsapp`

Tambien deja sponsors demo con telefono para que el enlace a WhatsApp sea testeable localmente.

## Fuera de alcance intencional

- integracion real con Evolution API
- integracion con n8n
- inbox conversacional
- confirmacion real de entrega o lectura en WhatsApp
- plantillas dinamicas avanzadas por canal
- reglas complejas de reveal por compliance o privacidad
