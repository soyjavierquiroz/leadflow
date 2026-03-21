# Public Funnel Runtime v1

Fecha: 2026-03-21 (UTC)

## Objetivo

Implementar el runtime publico minimo de Leadflow para resolver `host + path` hacia una `FunnelPublication`, cargar la `FunnelInstance` correcta, seleccionar el `FunnelStep` actual y renderizar su `blocks_json` en `apps/web`.

## Alcance implementado

- resolucion publica por `host + path`
- carga de publicacion activa
- carga de `FunnelInstance` y `FunnelStep`
- renderer JSON-driven inicial en `apps/web`
- soporte para root `/`
- soporte para subrutas limpias
- modo de preview local por query param en desarrollo
- integracion del bloque `form_placeholder` con submit publico real
- persistencia local de contexto de sesion para mostrar sponsor en el thank-you
- handoff mode efectivo disponible para thank-you o redirect inmediato
- CTA a WhatsApp construido desde el contexto real del assignment
- emision browser-side de eventos clave del runtime

## Endpoints publicos implementados

- `GET /v1/public/funnel-runtime/resolve?host=...&path=...`
- `GET /v1/public/funnel-runtime/publications/:publicationId`
- `GET /v1/public/funnel-runtime/publications/:publicationId/steps/:stepSlug`

## Reglas de resolucion `host + path`

1. `host` debe coincidir exactamente con un `Domain.host` activo.
2. El `path` se normaliza antes de evaluar rutas.
3. Solo participan `FunnelPublication` activas.
4. Se consideran todas las publicaciones activas del host cuyo `pathPrefix` sea prefijo valido del request.
5. Gana la ruta mas especifica.
6. La publicacion root `/` funciona como fallback natural cuando ninguna ruta mas especifica gana.
7. Si no existe publicacion valida, la API responde `404`.

## Resolucion de step

Una vez elegida la publicacion:

- si el request coincide exactamente con `pathPrefix`, se carga el `entry step`
- si el request agrega una subruta relativa, esa subruta intenta resolver `FunnelStep.slug`
- si el slug no existe para esa instancia, la API responde `404`

Ejemplos con el seed actual:

- `localhost + /` -> publicacion `/`, entry step
- `localhost + /gracias` -> publicacion `/`, step `gracias`
- `localhost + /oportunidad` -> publicacion `/oportunidad`, entry step
- `localhost + /oportunidad/gracias` -> publicacion `/oportunidad`, step `gracias`

## Runtime web implementado

- Ruta publica: `apps/web/app/(site)/[[...slug]]/page.tsx`
- Not found limpio: `apps/web/app/(site)/not-found.tsx`
- Renderer MVP: `apps/web/components/public-funnel/funnel-runtime-page.tsx`
- Cliente server-side hacia API: `apps/web/lib/funnel-runtime.ts`
- Cliente browser-side para submit y sesion: `apps/web/lib/public-funnel-session.ts`
- Cliente browser-side para tracking: `apps/web/lib/public-runtime-tracking.ts`

El runtime en web:

- detecta `host` desde headers del request
- usa `path` desde la ruta actual
- consulta la API server-side
- renderiza el step actual con bloques JSON
- muestra `404` limpio si no hay publicacion o step valido
- resuelve submit del formulario desde un componente cliente aislado
- puede revelar sponsor asignado en el siguiente step usando contexto local de la sesion
- soporta `thank_you_then_whatsapp` e `immediate_whatsapp`
- emite `funnel_viewed`, `step_viewed`, `form_started`, `form_submitted`, `cta_clicked` y `handoff_completed`

## Preview local

En desarrollo se puede usar:

- `?previewHost=localhost`
- `?previewHost=exitosos.com`

Regla:

- solo se respeta en entornos no productivos
- no reemplaza el modelo final basado en dominio; solo facilita pruebas locales

## Bloques MVP implementados

- `hero`
- `text`
- `video`
- `cta`
- `faq`
- `form_placeholder`
- `thank_you`
- `sponsor_reveal_placeholder`

## Seed ajustado para runtime

El seed de desarrollo ahora deja:

- `Domain` activo para `localhost`
- una publicacion root `/`
- una publicacion adicional en `/oportunidad`
- steps renderizables con `blocks_json`
- `media_map` y `settings_json` utiles para prueba visual
- sponsors demo con telefono visible para handoff
- estrategias demo para:
  - reveal con CTA manual en `/gracias`
  - redirect inmediato en `/oportunidad/gracias`

## Limitaciones intencionales de esta fase

- no hay tracking real a Meta/TikTok
- no hay integracion real con Evolution API, n8n ni confirmacion de entrega de WhatsApp
- no hay editor visual de templates
- no hay auth publica ni privada aplicada a este runtime
- no hay antifraude complejo ni sticky assignment
- no hay deduplicacion avanzada de browser/server

## Que queda listo para la siguiente fase

- hacer dispatch real a Meta/TikTok
- integrar providers externos para handoff y confirmaciones reales
- introducir reglas avanzadas de routing y filtros
- introducir permisos y auth sobre el modelo consolidado
