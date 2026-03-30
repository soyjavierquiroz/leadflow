# Infrastructure Baseline v1

Fecha: 2026-03-21 (UTC)
Fuentes principales:
- `/opt/projects/leadflow/docs/server-inventory.md`

## Resumen ejecutivo
El servidor ya cuenta con una base Docker/Swarm funcional para iniciar el nuevo SaaS de captación y automatización sin WordPress. La línea recomendada es conservar la infraestructura compartida transversal (`traefik`, `portainer`, `evolution`, `n8n-v2` y capas de datos), revisar cuidadosamente stacks legacy con WordPress y coexistencias (`n8n` vs `n8n-v2`), y programar retiros por fases solo después de validar dependencias reales en operación.

No se detectan en las fuentes dependencias inter-stack totalmente confirmadas a nivel de wiring (rutas/env/links), por lo que la estrategia debe ser conservadora: clasificar por evidencia del inventario, validar consumo real y recién luego retirar.

## Extracción del inventario actual

### Stacks detectados
- `aurum`
- `evolution`
- `horprices`
- `kloser`
- `kurukin-bot`
- `kurukin_saas`
- `midas-bot`
- `midas-bot-dev`
- `minio`
- `mongodb`
- `n8n`
- `n8n-v2`
- `portainer`
- `postgres_pgvector`
- `rabbitmq`
- `redis`
- `traefik`

### Servicios compartidos realmente útiles para el nuevo SaaS
Basado en el objetivo del proyecto y en la clasificación del inventario:
- `traefik` (edge routing)
- `portainer` (operación Swarm)
- `evolution` (integración de mensajería requerida)
- `n8n-v2` (automatización requerida)
- `redis` (cache/colas ligeras)
- `rabbitmq` (mensajería asíncrona)
- `postgres_pgvector` (datos relacionales/vectoriales)
- `minio` (almacenamiento objeto)
- `mongodb` (persistencia documental, si aplica a flujos)

### Stacks legacy/obsoletos o con alta probabilidad de retiro
- `n8n` (coexistencia con `n8n-v2`)
- `kurukin-bot` (incluye `wordpress` + `mysql`)
- `kurukin_saas` (incluye `saas_wordpress` y base SQL)
- `midas-bot-dev` (entorno dev candidato a retiro)

### Redes actuales
- `agent_network` (overlay, swarm)
- `bridge` (bridge, local)
- `docker_gwbridge` (bridge, local)
- `general_network` (overlay, swarm)
- `host` (host, local)
- `ingress` (overlay, swarm)
- `kurukin_saas_kurukin_internal` (overlay, swarm)
- `none` (null, local)
- `traefik_public` (overlay, swarm)

### Dependencias entre stacks (según evidencia disponible)
Dependencias confirmadas por nombre/estructura del inventario:
- `kurukin_saas` tiene red dedicada `kurukin_saas_kurukin_internal`.
- Existen volúmenes WordPress/MySQL/MariaDB ligados a `kurukin-bot` y `kurukin_saas`.
- `n8n-v2` posee volúmenes propios identificables (`n8n_binary_v2`, `n8n_nodes_v2`) y uno potencialmente compartido (`n8n_custom_nodes`).

Dependencias inferidas (no confirmadas en estas fuentes):
- Servicios publicados podrían depender de `traefik_public` para exposición externa.
- Stacks de aplicación podrían depender de `redis`, `rabbitmq`, `postgres_pgvector`, `minio` o `mongodb`.

Estado de certeza:
- Confirmado en inventario: naming de stacks/redes/volúmenes y estado `1/1`.
- Pendiente de validar: tráfico real, rutas, consumidores y contratos entre stacks.

## Infraestructura compartida a conservar
Clasificación recomendada `KEEP`:
- `traefik`
- `portainer`
- `evolution`
- `n8n-v2`
- `redis`
- `rabbitmq`
- `postgres_pgvector`
- `minio`
- `mongodb`

Motivo común: habilitan operación base, automatización y servicios de datos para el nuevo producto.

## Stacks a revisar antes de eliminar
Clasificación recomendada `REVIEW`:
- `aurum`, `horprices`, `kloser`, `midas-bot`.

Motivo común: parecen activos (`1/1`) y fuera de alcance de leadflow, pero podrían pertenecer a otros proyectos vigentes.

## Stacks programables para retiro
Clasificación recomendada `REMOVE` con prerequisitos:
- `n8n`.
- `kurukin-bot`.
- `kurukin_saas`.
- `midas-bot-dev`.

Prerequisitos mínimos antes de retiro:
1. Confirmar cero tráfico y cero dependencias consumidoras.
2. Respaldar volúmenes y configuraciones.
3. Definir rollback documentado por stack.

## Riesgos de eliminación por dependencia
- Riesgo alto: retirar `n8n` sin confirmar migración completa a `n8n-v2` (posible pérdida de workflows activos).
- Riesgo alto: retirar stacks WordPress (`kurukin-bot`, `kurukin_saas`) sin snapshot de volúmenes (pérdida de datos históricos).
- Riesgo medio: retirar `midas-bot-dev` sin confirmar uso real por QA/desarrollo.
- Riesgo medio: limpieza de redes/volúmenes por naming ambiguo (`-` vs `_`) con posibilidad de borrar activos erróneos.

## Propuesta de redes objetivo para el nuevo sistema
Mantener redes existentes compartidas:
- `traefik_public` (entrypoint externo)
- `general_network` (interconexión transversal controlada)

Crear redes dedicadas leadflow:
- `leadflow_public` (overlay): servicios de aplicación expuestos vía Traefik.
- `leadflow_core` (overlay): API, workers y orquestación interna.
- `leadflow_data` (overlay): acceso privado a stores de datos compartidos/dedicados.
- `leadflow_automation` (overlay): integración controlada entre `n8n-v2`, Evolution y workers.

Criterio: separar plano público, core y datos para reducir acoplamiento y riesgo lateral.

## Naming conventions propuestas
Estándar recomendado:
1. Usar `snake_case` para stacks, servicios, redes y volúmenes.
2. Prefijo obligatorio por producto: `leadflow_`.
3. Sufijos por tipo:
- Red: `_net_public`, `_net_core`, `_net_data`, `_net_automation`.
- Volumen: `_data`, `_config`, `_logs`, `_backup`.
- Servicios: `<dominio>_<rol>` (ej. `leadflow_api_backend`).
4. Evitar mezclar `-` y `_` para el mismo dominio.

Ejemplos:
- Stack: `leadflow_core`
- Red: `leadflow_net_core`
- Volumen: `leadflow_postgres_data`
- Servicio: `leadflow_assignment_worker`

## Baseline técnico recomendado para el nuevo producto
Capas mínimas recomendadas:
1. Orquestación y borde:
- Docker Swarm (existente)
- Traefik como router/SSL
2. Automatización y mensajería:
- `n8n-v2`
- `evolution`
- `rabbitmq` para eventos y colas
3. Datos:
- `postgres_pgvector` como store principal transaccional/vectorial
- `redis` para caché, locks y tareas efímeras
- `minio` para adjuntos/media
- `mongodb` solo si hay casos documentales claros
4. Operación:
- `portainer`
- Política de backups por volumen crítico
- Runbooks de rollback por stack

Criterio de adopción: preferir reutilizar infraestructura compartida existente y crear componentes nuevos únicamente con prefijo `leadflow_` y redes dedicadas.
