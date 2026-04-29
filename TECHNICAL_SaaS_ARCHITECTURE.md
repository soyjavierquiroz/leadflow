# Leadflow Technical SaaS Architecture

## Scope

Este documento describe la arquitectura operativa vigente del runtime SaaS de Leadflow en Swarm.

Flujo canónico:

`Internet -> Traefik -> Docker Swarm -> web -> api -> Prisma/Postgres -> n8n dispatcher`

## Topología real

### 1. Edge y routing

- Traefik publica los hosts externos y termina TLS.
- El stack productivo canónico es `infra/swarm/docker-stack.yml`.
- El servicio `web` expone:
  - un router explícito para `LEADFLOW_SITE_HOST`
  - un router catch-all `HostRegexp(\`{host:.+}\`)` para tráfico SaaS y publicaciones públicas
- El servicio `api` expone un router explícito para `LEADFLOW_API_HOST`.

Resultado:

- el tráfico público y dominios SaaS entra por `web`
- el backend HTTP entra por `api`
- Traefik no necesita una label por cada dominio cliente

### 2. Servicio web

El frontend vive en `apps/web` y corre como runtime Next.js.

Responsabilidades principales:

- resolver publicaciones públicas por `host + path`
- renderizar el funnel público
- consumir el backend por `NEXT_PUBLIC_API_URL`
- exponer configuración SaaS pública desde `apps/web/lib/public-env.ts`

Variables públicas relevantes:

- `NEXT_PUBLIC_APP_BASE_DOMAIN`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_MEMBERS_URL`
- `NEXT_PUBLIC_ADMIN_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SAAS_CUSTOMER_CNAME_TARGET`
- `NEXT_PUBLIC_SAAS_FALLBACK_ORIGIN`

### 3. Servicio API

El backend vive en `apps/api` y corre con NestJS + Fastify.

Responsabilidades principales:

- auth y sesiones
- runtime público del funnel
- captura y asignación de leads
- acceso a dominio y publicaciones
- integración con Evolution
- dispatch hacia n8n

El servicio `api` necesita `DATABASE_URL` en runtime. Prisma lo toma desde `apps/api/prisma/schema.prisma` mediante `env("DATABASE_URL")`.

Variables operativas críticas:

- `DATABASE_URL`
- `APP_BASE_DOMAIN`
- `API_URL`
- `SITE_URL`
- `MEMBERS_URL`
- `ADMIN_URL`
- `CORS_ALLOWED_ORIGINS`
- `EVOLUTION_API_INTERNAL_BASE_URL`
- `EVOLUTION_API_KEY`
- `N8N_WEBHOOK_INTERNAL_BASE`
- `N8N_WEBHOOK_ID`
- `N8N_DISPATCHER_WEBHOOK_URL`
- `N8N_DISPATCHER_API_KEY`
- `N8N_AUTOMATION_WEBHOOK_BASE_URL`
- `MESSAGING_AUTOMATION_WEBHOOK_BASE_URL`

### 3.3 Kurukin AI Gateway y sesiones de orquestación

La arquitectura vigente de Smart Wiring y Lego Maker separa claramente responsabilidades:

- `apps/api/src/modules/ai-config` resuelve `runtimeContext`, arma el `system_prompt` y valida el alcance del usuario o `instance_name`.
- La ejecución de IA vive en el Kurukin AI Gateway, tratado como servicio stateless externo al monorepo.
- En producción el gateway se expone por la infraestructura de Kurukin (`ia.kuruk.in`); para redes internas o pruebas el backend admite override mediante `IA_GATEWAY_BASE_URL`, con fallback local a `http://ia_gateway:3000`.

Contrato HTTP actual entre Leadflow y el gateway:

- `POST /v1/session/init`
- `POST /v1/execute`
- `POST /v1/session/close`

Leadflow no persiste la memoria conversacional del Smart Wiring dentro de la API. La sesión se direcciona con un ID canónico generado en `AiConfigService.buildOrchestrationSessionId()`:

- formato: `${instanceName}-${funnelId}`

La memoria efectiva de esa sesión vive en Redis del lado del gateway. El backend de Leadflow sigue siendo stateless respecto a la orquestación: solo reconstruye contexto, envía prompts y reutiliza el mismo `sessionId` mientras el editor permanezca activo.

Impacto operativo:

- reinicios de `web` o `api` no deberían destruir el estado de orquestación si el gateway y Redis siguen disponibles
- el editor puede reintentar `execute` sobre la misma clave canónica
- el cierre explícito de sesión evita dejar contexto huérfano en el gateway

### 3.1 Cloudflare SaaS Domains Troubleshooting

Incidente consolidado:

- El flujo de `Custom Hostnames` en Cloudflare depende obligatoriamente de dos credenciales en runtime:
  - `CLOUDFLARE_ZONE_ID`
  - `CLOUDFLARE_API_TOKEN`
- Si alguna falta, Leadflow puede persistir el `Domain` y calcular `dnsTarget`, pero no podrá crear ni refrescar el custom hostname remoto.

Permiso de menor privilegio:

- El token de Cloudflare no debe ser global.
- Para el flujo vigente de onboarding SaaS, el permiso mínimo requerido es:
  - `Zone -> SSL and Certificates -> Edit`
- Esto permite operar `Custom Hostnames` sin exponer privilegios innecesarios sobre toda la cuenta.

Edge case de validación HTTP:

- Para `custom_subdomain` con validación `http`, Cloudflare puede emitir el certificado y devolver un snapshot donde `ssl.status === "active"` aunque el resto del payload no cumpla la condición estricta previa de la máquina de estados.
- Antes del parche, `deriveDomainLifecycle()` en `apps/api/src/modules/domains/domain-onboarding.utils.ts` exigía una combinación más rígida y podía dejar dominios funcionales en `pending_validation` o `pending`.
- Leadflow ahora trata `ssl.status === "active"` como condición de éxito absoluta y promueve el dominio a:
  - `status: active`
  - `onboardingStatus: active`
  - `verificationStatus: verified`
  - `sslStatus: active`
- Este ajuste evita falsos negativos cuando Cloudflare ya considera operativo el hostname aunque la estructura completa del snapshot no venga en el formato esperado por la lógica anterior.

### 3.2 Infraestructura de Correos / Notificaciones

La infraestructura de correos transaccionales y notificaciones técnicas queda
estandarizada sobre AWS SES mediante el SDK oficial `@aws-sdk/client-ses`.

Decisión arquitectónica vigente:

- Se completa la migración total a AWS SES como proveedor único de envío.
- Se eliminan proveedores legacy del flujo operativo: Sendgrid, SMTP genérico y
  Resend.
- El backend debe usar `@aws-sdk/client-ses` para emitir correos desde el
  servicio de mailer compartido.

Domain Alignment:

- Los envíos técnicos salen desde el subdominio alineado
  `soporte@mail.kurukin.com`.
- Las respuestas de clientes se enrutan a `soporte@kurukin.com`, administrado
  en Workspace.
- Esta separación protege la reputación del dominio principal y mantiene los
  rebotes/respuestas humanas fuera del canal técnico de envío.

Seguridad:

- SES opera con credenciales IAM permanentes con formato `AKIA...`.
- La política activa para esas credenciales es `AmazonSESFullAccess`.
- Las credenciales deben inyectarse por entorno y no deben versionarse en el
  repositorio.

Resiliencia:

- El flujo de creación de tenants queda blindado con `try/catch` alrededor del
  envío de correos.
- Si AWS SES responde con error transitorio o `500`, el fallo se captura y no
  debe corromper la base de datos ni bloquear la experiencia de creación del
  tenant.
- El envío de notificaciones es un efecto secundario posterior al cambio de
  estado principal; la consistencia del tenant tiene prioridad sobre el correo.

### 4. Datos y Prisma

Leadflow usa PostgreSQL vía Prisma.

Estado actual del repo:

- el stack local `infra/swarm/docker-stack.local.yml` sí inyecta `DATABASE_URL`
- el stack productivo `infra/swarm/docker-stack.yml` ahora también expone `DATABASE_URL` como variable requerida del entorno
- el host de Postgres no está fijado en el repo productivo; se debe proveer desde el entorno del manager o Portainer

Conclusión:

- la conexión API -> DB es obligatoria y explícita
- si `DATABASE_URL` no está presente en producción, el runtime puede arrancar pero fallará al tocar datos

### 5. Dispatcher a n8n

El flujo actual del dispatcher sale desde:

- `apps/api/src/modules/public-funnel-runtime/lead-capture-assignment.service.ts`
- `apps/api/src/modules/messaging-automation/lead-dispatcher.service.ts`

Secuencia:

1. se crea o reutiliza un lead
2. se genera una asignación
3. si la asignación es nueva, el backend dispara `dispatchLeadContextUpsert`
4. `LeadDispatcherService` arma el payload
5. `postWithRetry` envía un `POST` a `N8N_DISPATCHER_WEBHOOK_URL`

Instrumentación productiva preservada:

- `Dispatcher URL: ...`
- `Sending payload to n8n...`
- `Lead dispatcher failed`

Eso permite distinguir tres fallos distintos:

- variable vacía o URL inválida
- intento de envío sí ejecutado pero fallido
- error silencioso ahora capturado en `LeadCaptureAssignmentService`

### 6. n8n inbound y automatización adicional

Además del dispatcher principal, existen dos contratos separados:

- `N8N_WEBHOOK_INTERNAL_BASE` + `N8N_WEBHOOK_ID`
  - usados por `EvolutionApiClient` para construir webhooks inbound
- `N8N_AUTOMATION_WEBHOOK_BASE_URL`
  - usado por `N8nAutomationClient` para automatizaciones downstream

No deben confundirse:

- `N8N_DISPATCHER_WEBHOOK_URL` es el webhook específico de lead context upsert
- `N8N_AUTOMATION_WEBHOOK_BASE_URL` es un base URL para otras automatizaciones
- `N8N_WEBHOOK_INTERNAL_BASE` es la base interna para callbacks de Evolution hacia n8n

## Redes y límites de responsabilidad

Redes del stack productivo:

- `traefik_public`
- `general_network`
- `leadflow_core`
- `leadflow_automation`

Asignación:

- `web` se conecta a `traefik_public` y `leadflow_core`
- `api` se conecta a `traefik_public`, `general_network`, `leadflow_core` y `leadflow_automation`

Interpretación:

- `web` sirve la superficie HTTP pública
- `api` mantiene conectividad adicional hacia dependencias internas y automatización

## Contrato de bloques del builder

La capa de edición de funnels ahora usa un contrato más estricto entre catálogo, editor y runtime:

- `BuilderBlockDefinitionV2` define `schema`, `example`, `compatibleStepTypes`, `requiredCapabilities`, `emitsOutcomes` y `autoWiring`.
- `apps/web/components/team-operations/BlockCard.tsx` hace deep mapping recursivo sobre objetos JSON anidados para construir controles editables sin depender de listas manuales superficiales.
- El caso más sensible es `hook_and_promise`, donde el editor ya cubre `content.top_bar`, `content.hook_text`, `content.cta_lead_in`, `content.proof_header` y `content.urgency_box.{text,mechanism}` además del resto del contrato visible en `registry.ts`.

Resultado:

- menos desalineación entre JSON, UI del builder y render público
- menos campos huérfanos en bloques con estructuras anidadas
- auto-wiring más predecible para `lead_capture_config` y bloques compatibles

## Fuente de verdad operativa

Archivos canónicos:

- stack productivo: `infra/swarm/docker-stack.yml`
- stack local: `infra/swarm/docker-stack.local.yml`
- ejemplo de variables Swarm: `infra/swarm/.env.example`
- ejemplo API: `apps/api/.env.example`
- ejemplo web: `apps/web/.env.example`

Archivos retirados por obsolescencia:

- `docker-swarm.yml`
- `README_INIT.md`
- `temp_jakawi_src/`

## Riesgos operativos actuales

### Riesgo 1: inconsistencias entre entorno y stack

El código usa correctamente:

- `DATABASE_URL` para Prisma
- `N8N_DISPATCHER_WEBHOOK_URL` para el dispatcher

El riesgo está en el despliegue si Portainer o el manager no proveen esas variables.

### Riesgo 2: múltiples superficies de configuración

El repo tenía duplicación entre:

- stack productivo real en `infra/swarm/`
- stack alternativo en raíz
- ejemplos de entorno con URLs antiguas del dispatcher

Ese ruido ya fue reducido dejando una sola narrativa canónica.

### Riesgo 3: salud del dispatcher depende de un evento real

Con la instrumentación actual ya vimos en producción que:

- la API arranca
- `N8N_DISPATCHER_WEBHOOK_URL` se carga correctamente

Todavía hace falta observar un envío real de formulario para cerrar el circuito de:

- `Sending payload to n8n...`
- o `Lead dispatcher failed`

## Verificación operativa recomendada

### Arranque de API

```bash
docker service logs --since 5m --tail 200 leadflow_api
```

Señales esperadas:

- `Nest application successfully started`
- `Dispatcher URL: ...`

### Captura de un submit real

```bash
docker service logs -f --tail 200 leadflow_api 2>&1 | grep --line-buffered -E 'Dispatcher URL:|Sending payload to n8n|Lead dispatcher failed'
```

Interpretación:

- si ves `Dispatcher URL: null`, el problema es configuración
- si ves `Sending payload to n8n...` y luego error, el problema está en red, URL o respuesta del webhook
- si no ves ninguna línea al enviar un formulario, el problema está antes del dispatcher en el flujo de assignment
