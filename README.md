# Leadflow

Leadflow es un SaaS de captación, asignación y automatización de leads construido como monorepo con `web` y `api`.

## Arquitectura actual

Flujo operativo real:

`Traefik -> Docker Swarm -> web -> api -> Prisma/Postgres -> Runtime Context Central -> n8n dispatcher`

Leadflow ahora opera en un clúster Swarm unificado, conectado a las redes externas `traefik_public` y `general_network`.

La base de datos ya no está aislada por stack. El despliegue consume el clúster centralizado en `postgres_postgres`.

Piezas principales:

- `apps/web`: Next.js. Atiende el sitio principal y el runtime público por `HostRegexp`.
- `apps/api`: NestJS + Fastify. Expone auth, runtime público, asignación de leads e integraciones.
- `Prisma/Postgres`: persistencia transaccional del backend.
- `Runtime Context Central`: registro y resolución del contexto operativo antes de habilitar dispatch downstream.
- `n8n`: recibe eventos del dispatcher y automatizaciones complementarias.

## Onboarding central y dispatcher

`RuntimeContextCentralService` centraliza el onboarding de cada `MessagingConnection` contra el servicio Runtime Context Central.

- `markConnectionProvisioned()` persiste `runtimeContextStatus=PROVISIONED`, guarda el `tenantId` operativo y limpia timestamps/errores previos.
- `ensureConnectionReady()` solo continúa si existe `externalInstanceId`; si la conexión ya está en `READY`, hace short-circuit.
- Si la conexión todavía no está onboarded, el servicio marca `PROVISIONED`, ejecuta `register` contra Runtime Context Central y luego persiste `REGISTERED`.
- Para compatibilidad operativa, si `register` responde `404`, el cliente prueba automáticamente la ruta alternativa `/v1/context/register`; `resolve-full` hace el mismo fallback hacia `/v1/context/resolve-full`.
- Después entra en polling con `waitUntilResolvable()` contra `resolve-full` usando `RUNTIME_CONTEXT_RESOLVE_RETRIES` y `RUNTIME_CONTEXT_RESOLVE_DELAY_MS`.
- Cuando `resolve-full` devuelve `200`, la conexión pasa a `READY` y se guardan `runtimeContextReadyAt` y `runtimeContextLastCheckedAt`.
- Si `RUNTIME_CONTEXT_MODE=optional`, un fallo del microservicio central no bloquea el QR: la API marca la conexión como `READY` usando persistencia local en DB para entornos de desarrollo o despliegues sin Runtime Context Central.
- Si el registro o la resolución fallan, la conexión queda en `PROVISIONED` o `REGISTERED` según el último punto alcanzado y se persisten `runtimeContextLastErrorAt` y `runtimeContextLastErrorMessage`.

El guardrail del dispatcher vive en `LeadDispatcherService`:

- antes de construir el payload hacia n8n, `dispatchLeadContextUpsert()` exige `externalInstanceId`
- si `runtimeContextStatus !== READY`, delega en `RuntimeContextCentralService.ensureConnectionReady()`
- si la conexión no queda lista, retorna `null` y no dispara el `POST` al dispatcher
- solo cuando la conexión está en `READY` construye `LEAD_CONTEXT_UPSERT` y hace el envío a `N8N_DISPATCHER_WEBHOOK_URL`

Este bloqueo evita enviar payloads cuando Runtime Context Central todavía no resuelve la instancia, que era la causa de los `404` en `resolve-full`.

## Flujo lógico de onboarding

Secuencia operativa actual:

1. Leadflow crea o reutiliza la instancia en Evolution y configura el webhook inbound.
2. La conexión se marca en base como `PROVISIONED`.
3. Leadflow registra la instancia en Runtime Context Central con `provider=evolution`, `channel=whatsapp`, `instance_name`, `tenant_id` y `service_owner_key=lead-handler`.
4. La conexión pasa a `REGISTERED`.
5. Leadflow hace polling de verificación contra `resolve-full` hasta que Runtime Context Central devuelve `200`.
6. La conexión pasa a `READY`.
7. `LeadDispatcherService` queda habilitado para despachar el contexto estructurado hacia n8n.

## Fuente de verdad de despliegue

Usa solo estos archivos:

- producción: `infra/swarm/docker-stack.yml`
- desarrollo con Compose: `infra/docker/docker-compose.dev.yml`
- variables ejemplo de Swarm: `infra/swarm/.env.example`
- variables ejemplo de API: `apps/api/.env.example`
- variables ejemplo de web: `apps/web/.env.example`

Archivos obsoletos retirados:

- `docker-swarm.yml`
- `README_INIT.md`
- `temp_jakawi_src/`

## Requisitos

- Node.js `>= 20.16`
- `pnpm@9`
- Docker
- acceso a PostgreSQL para la API
- acceso a Traefik y Swarm para producción

## Estructura del repo

```text
apps/
  api/   NestJS + Prisma
  web/   Next.js app router
infra/
  docker/  entorno local con docker compose
  swarm/   stacks y ejemplos de variables para Swarm
packages/
  config/
  types/
  ui/
```

## Variables de entorno críticas

### API

La API necesita como mínimo:

- `DATABASE_URL`
- `APP_BASE_DOMAIN`
- `API_URL`
- `SITE_URL`
- `MEMBERS_URL`
- `ADMIN_URL`
- `CORS_ALLOWED_ORIGINS`
- `N8N_DISPATCHER_WEBHOOK_URL`

Variables de integración frecuentes:

- `EVOLUTION_API_INTERNAL_BASE_URL`
- `EVOLUTION_API_KEY`
- `N8N_WEBHOOK_INTERNAL_BASE`
- `N8N_WEBHOOK_ID`
- `N8N_DISPATCHER_API_KEY`
- `N8N_AUTOMATION_WEBHOOK_BASE_URL`
- `MESSAGING_AUTOMATION_WEBHOOK_BASE_URL`

Variables críticas del onboarding central y del dispatcher:

- `N8N_WEBHOOK_INTERNAL_BASE`
- `N8N_WEBHOOK_ID`
- `N8N_DISPATCHER_WEBHOOK_URL`
- `N8N_DISPATCHER_API_KEY`
- `RUNTIME_CONTEXT_CENTRAL_BASE_URL`
- `RUNTIME_CONTEXT_MODE`
- `RUNTIME_CONTEXT_REGISTER_PATH`
- `RUNTIME_CONTEXT_RESOLVE_FULL_PATH`
- `RUNTIME_CONTEXT_CENTRAL_API_KEY`
- `RUNTIME_CONTEXT_REQUEST_TIMEOUT_MS`
- `RUNTIME_CONTEXT_RESOLVE_RETRIES`
- `RUNTIME_CONTEXT_RESOLVE_DELAY_MS`
- `SSO_BLACKLIST_SECRET`
- `KURUKIN_BLACKLIST_API_TOKEN`

### Web

La web publica y consume:

- `NEXT_PUBLIC_APP_BASE_DOMAIN`
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_MEMBERS_URL`
- `NEXT_PUBLIC_ADMIN_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SAAS_CUSTOMER_CNAME_TARGET`
- `NEXT_PUBLIC_SAAS_FALLBACK_ORIGIN`

## Integración con Kurukin Blacklist

Leadflow expone un puente controlado hacia Kurukin Blacklist para dos perfiles operativos distintos. Esta integración requiere configurar siempre estas variables de entorno en la API:

- `SSO_BLACKLIST_SECRET`: secreto compartido para firmar y validar JWT `HS256` del flujo SSO de asesores.
- `KURUKIN_BLACKLIST_API_TOKEN`: admin key usada para habilitar el acceso maestro de Super Admin.

Flujos soportados:

- Asesores: ingresan a `/dashboard/importaciones` usando el parámetro `token`. Leadflow valida un JWT `HS256` firmado con `SSO_BLACKLIST_SECRET` y habilita el acceso SSO al módulo de importaciones.
- Super Admin: ingresa a `/dashboard/reportes` usando el parámetro `admin_key`. Leadflow compara ese valor contra `KURUKIN_BLACKLIST_API_TOKEN` y, si coincide, habilita el acceso maestro al módulo de reportes.

Notas operativas:

- `token` y `admin_key` deben viajar solo sobre HTTPS.
- Los valores reales no se versionan; defínelos en Portainer, variables del host o archivos locales ignorados por Git.
- Si falta cualquiera de estas variables en la API, el puente con Kurukin Blacklist queda incompleto.

## Desarrollo local

Instalar dependencias:

```bash
pnpm install
```

Levantar web y api en modo desarrollo:

```bash
pnpm dev
```

Levantar infraestructura local con Docker:

```bash
pnpm docker:dev:up
```

Comandos útiles:

```bash
pnpm dev:web
pnpm dev:api
pnpm build
pnpm test
pnpm typecheck
pnpm db:generate
pnpm db:migrate:dev
pnpm db:seed
```

## Despliegue a Swarm

El despliegue oficial se realiza a través del Web Editor de Portainer, no por consola directa.

Procedimiento oficial:

1. Usa `infra/swarm/docker-stack.yml` como fuente de verdad para el stack.
2. Abre el stack en Portainer y pega el contenido en el Web Editor.
3. Inyecta las variables de entorno en `Advanced Mode`, tomando como referencia `infra/swarm/.env.example`.
4. Define al menos `DATABASE_URL`, `N8N_DISPATCHER_WEBHOOK_URL` y los hosts `*.kuruk.in` antes de desplegar.
5. Publica el stack sobre las redes externas `traefik_public` y `general_network`.
6. Verifica que la conexión a Postgres apunte al servicio central `postgres_postgres`.

Notas operativas:

- No se considera flujo oficial ejecutar `docker stack deploy` manualmente desde shell en este servidor.
- Los secretos deben existir solo en Portainer `Advanced Mode` o en archivos locales ignorados por Git.

## Dispatcher n8n

El dispatcher de contexto de lead sale desde:

- `apps/api/src/modules/public-funnel-runtime/lead-capture-assignment.service.ts`
- `apps/api/src/modules/messaging-automation/lead-dispatcher.service.ts`

Logs productivos preservados:

- `Dispatcher URL: ...`
- `Sending payload to n8n...`
- `Lead dispatcher failed`

Ver logs del servicio:

```bash
docker service logs -f --tail 200 leadflow_api 2>&1 | grep --line-buffered -E 'Dispatcher URL:|Sending payload to n8n|Lead dispatcher failed'
```

## Troubleshooting `REGISTERED -> READY`

Si una conexión se queda en `REGISTERED` y no pasa a `READY`, revisa en este orden:

1. Confirma que `leadflow_api` expone `RUNTIME_CONTEXT_CENTRAL_BASE_URL`, `RUNTIME_CONTEXT_MODE`, `RUNTIME_CONTEXT_CENTRAL_API_KEY`, `RUNTIME_CONTEXT_REGISTER_PATH` y `RUNTIME_CONTEXT_RESOLVE_FULL_PATH`.
2. Confirma conectividad desde la API al servicio central. En Swarm local, el target operativo es `http://runtime_context_service:8080/health`.
3. Revisa que Runtime Context Central responda `200` en `/health` y que esté accesible por la red compartida entre servicios.
4. Busca en los logs de API errores del polling, especialmente mensajes equivalentes a `Runtime context resolve-full still missing instance ...`.
5. Verifica que la instancia exista realmente en Evolution y que el `externalInstanceId` persistido en `MessagingConnection` coincida con el registrado en central.
6. Consulta `MessagingConnection.runtimeContextLastErrorMessage`, `runtimeContextLastErrorAt` y `runtimeContextLastCheckedAt` para distinguir si el bloqueo fue de registro, de resolución o de conectividad.
7. Si faltan columnas o estados nuevos en base, ejecuta `prisma migrate deploy` antes de seguir probando el flujo.

Comandos útiles:

```bash
docker exec <leadflow_api_container> printenv | grep RUNTIME_CONTEXT
docker exec <leadflow_api_container> wget -qO- http://runtime_context_service:8080/health
docker service logs --tail 200 leadflow_api
docker exec <leadflow_db_container> psql -U leadflow -d leadflow -c "SELECT runtimeContextStatus, runtimeContextLastErrorMessage, runtimeContextReadyAt FROM \"MessagingConnection\";"
```

## Estado operativo conocido

Según el código actual:

- la web enruta tráfico SaaS por `HostRegexp`
- la API depende explícitamente de `DATABASE_URL`
- el dispatcher depende explícitamente de `N8N_DISPATCHER_WEBHOOK_URL`
- ya se verificó en producción que la API arranca y que la URL del dispatcher se carga
- aún falta observar un submit real para cerrar la verificación end-to-end hacia n8n

## Verificación rápida

Validar tipos en la API:

```bash
pnpm --filter @leadflow/api typecheck
```

Validar el stack:

```bash
pnpm docker:stack:validate
pnpm docker:stack:validate:local
```

## Reglas Arquitectónicas Actuales

### Modelo Híbrido de Usuarios y Operación
Leadflow opera con un modelo híbrido entre gestión administrativa y operación comercial.

- `SUPER_ADMIN` accede a superficies `system/*` únicamente mediante sesión autenticada.
- `TEAM_ADMIN` y `MEMBER` participan en la operación comercial del tenant según su contexto, sponsor vinculado, disponibilidad y estado de licencia/asiento.
- Las integraciones técnicas no comparten privilegios con usuarios humanos. Los webhooks de automatización usan endpoints dedicados y no pueden reutilizar guards administrativos.

### Seguridad de Webhooks y Endpoints de Sistema
La separación de privilegios es obligatoria:

- `SystemTenantAccessGuard` protege endpoints administrativos y solo acepta sesión autenticada de `SUPER_ADMIN`.
- `SystemApiGuard` protege exclusivamente `webhooks/n8n/*` mediante `N8N_WEBHOOK_SECRET`.
- Ningún secreto de integración debe otorgar acceso a endpoints administrativos.
- Las respuestas públicas del runtime no deben exponer secretos server-side como `metaCapiToken` o `tiktokAccessToken`.
- Todo log operativo que procese payloads de webhooks o SSO debe pasar por redacción de datos sensibles antes de serializarse.

### Concurrencia e Idempotencia en Leads
El motor de leads está diseñado para resistir submits concurrentes y carreras entre asignación, reasignación y aceptación.

#### Captura de leads
- `Lead.visitorId` es la clave de idempotencia funcional.
- La creación sigue el patrón `create -> catch P2002 -> find existing -> merge/update`.
- Esto evita errores 500 por doble submit y garantiza que dos requests simultáneas no creen dos leads para el mismo visitante.

#### Asignación y ownership
- Antes de modificar `Assignment.status` o `Lead.currentAssignmentId`, se debe bloquear la fila del `Lead` con `SELECT ... FOR UPDATE`.
- Este lock aplica al menos a:
  - auto-assign público
  - reasignación manual
  - aceptación manual por sponsor
  - auto-accept por webhook
- La aplicación debe releer el estado del lead y su assignment dentro de la misma transacción protegida por lock.

#### Invariante de base de datos
Además del lock transaccional, la base de datos impone el siguiente invariante:

- Un `Lead` solo puede tener un assignment activo a la vez.
- Se considera “activo” cualquier assignment con estado `pending`, `assigned` o `accepted`.

Este invariante se refuerza con un índice único parcial sobre `Assignment(leadId)` filtrado por esos estados.

### Regla de Evolución
Toda nueva feature que:
- cree leads,
- cambie ownership,
- reasigne sponsors,
- acepte handoffs,
- o introduzca nuevos webhooks,

debe respetar estas reglas de seguridad y concurrencia antes de considerarse lista para producción.
