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
