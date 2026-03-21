# Server Inventory (Docker/Swarm)

Fecha de inspección: 2026-03-20 (UTC)

## Alcance de la revisión
Inspección en modo solo lectura del entorno Docker/Swarm del servidor, sin despliegues ni modificaciones.

Comandos usados:
- `docker stack ls`
- `docker service ls`
- `docker network ls`
- `docker volume ls`

## 1) Stacks detectados

| Stack | Servicios | Estado observado | Clasificación preliminar |
|---|---:|---|---|
| `aurum` | 2 | servicios `1/1` | Activo pero no esencial para el nuevo leadflow (probable proyecto paralelo) |
| `evolution` | 1 | servicio `1/1` | Activo y útil (alineado con Evolution API) |
| `horprices` | 1 | servicio `1/1` | Activo pero no esencial (probable proyecto paralelo) |
| `kloser` | 1 | servicio `1/1` | Activo pero no esencial (probable proyecto paralelo) |
| `kurukin-bot` | 2 | servicios `1/1` | Probable legacy (incluye `wordpress` + `mysql`) |
| `kurukin_saas` | 2 | servicios `1/1` | Probable legacy (incluye `saas_wordpress`) |
| `midas-bot` | 1 | servicio `1/1` | Activo pero no esencial (proyecto paralelo) |
| `midas-bot-dev` | 1 | servicio `1/1` | Candidato legacy/entorno dev |
| `minio` | 1 | servicio `1/1` | Activo y potencialmente útil (objeto/archivos) |
| `mongodb` | 1 | servicio `1/1` | Activo y potencialmente útil |
| `n8n` | 3 | servicios `1/1` | Candidato legacy por coexistencia con `n8n-v2` |
| `n8n-v2` | 3 | servicios `1/1` | Activo y útil (automatización objetivo) |
| `portainer` | 2 | servicios `1/1` | Activo y útil (operación/gestión) |
| `postgres_pgvector` | 1 | servicio `1/1` | Activo y potencialmente útil |
| `rabbitmq` | 1 | servicio `1/1` | Activo y potencialmente útil |
| `redis` | 1 | servicio `1/1` | Activo y potencialmente útil |
| `traefik` | 1 | servicio `1/1` | Activo y útil (edge routing) |

### Lectura rápida (útil vs legacy)

Parece **activo/útil** para el nuevo sistema (directa o indirectamente):
- `evolution`
- `n8n-v2`
- `traefik`
- `portainer`
- `redis`
- `rabbitmq`
- `postgres_pgvector`
- `minio`
- `mongodb`

Parece **legacy/obsoleto o a validar para retiro**:
- `n8n` (si `n8n-v2` ya es la versión vigente)
- `kurukin-bot` (WordPress/MySQL)
- `kurukin_saas` (WordPress/MariaDB)
- `midas-bot-dev` (si no se usa)

Parece **activo pero fuera del alcance leadflow** (proyectos paralelos):
- `aurum`, `horprices`, `kloser`, `midas-bot`

## 2) Redes existentes

- `agent_network` (overlay, swarm)
- `bridge` (bridge, local)
- `docker_gwbridge` (bridge, local)
- `general_network` (overlay, swarm)
- `host` (host, local)
- `ingress` (overlay, swarm)
- `kurukin_saas_kurukin_internal` (overlay, swarm)
- `none` (null, local)
- `traefik_public` (overlay, swarm)

Observaciones:
- `traefik_public` y `general_network` parecen redes compartidas relevantes para servicios actuales.
- `kurukin_saas_kurukin_internal` sugiere red específica de stack legacy (`kurukin_saas`).

## 3) Volúmenes existentes

- `audios_shared`
- `certificados`
- `evolution_v2_instances`
- `hermes_hermes_redis_data`
- `hermes_redis_data`
- `imagenes_shared`
- `kurukin-bot_audios_shared`
- `kurukin-bot_imagenes_shared`
- `kurukin-bot_wordpress_data`
- `kurukin-bot_wordpress_db_data`
- `kurukin-saas_db_data`
- `kurukin-saas_wp_data`
- `kurukin_saas_db_data`
- `kurukin_saas_wordpress_db_data`
- `kurukin_saas_wp_data`
- `minio_minio_data_fresh`
- `mongodb_configdb_data`
- `mongodb_data`
- `n8n_binary_v2`
- `n8n_custom_nodes`
- `n8n_nodes_v2`
- `pgvector_data`
- `portainer_data`
- `rabbitmq_data`
- `redis_data`

Observaciones:
- Hay duplicidad aparente de prefijos y naming (`kurukin-saas_*` vs `kurukin_saas_*`), típico de iteraciones históricas.
- Existen volúmenes claramente ligados a WordPress (`*_wordpress_*`, `*_wp_*`) candidatos a limpieza solo tras validación.

## 4) Recomendaciones de limpieza (sin ejecutar cambios ahora)

1. Congelar inventario en una ventana de control y validar dependencia real por stack (tráfico real, dominios y consumidores).
2. Priorizar revisión de candidatos legacy:
   - `n8n` (vs `n8n-v2`)
   - `kurukin-bot`
   - `kurukin_saas`
   - `midas-bot-dev`
3. Antes de retirar cualquier stack, respaldar volúmenes asociados y exportar configuración relevante.
4. Definir política de naming única para stacks/redes/volúmenes (evitar `-` y `_` mezclados para el mismo sistema).
5. Limpiar en fases:
   - Fase 1: entornos dev/duplicados sin tráfico.
   - Fase 2: stacks legacy WordPress no usados.
   - Fase 3: redes/volúmenes huérfanos después de retiro confirmado.
6. Mantener `traefik`, `portainer`, `evolution`, `n8n-v2` y capas de datos como base operativa mientras se arma leadflow.

## Nota
Esta clasificación es preliminar y basada en nombres/estado de réplicas (`1/1`) observados en la fecha indicada. No se realizaron cambios en infraestructura.
