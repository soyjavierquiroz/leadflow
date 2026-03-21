# Cleanup Plan v1

Fecha: 2026-03-21 (UTC)
Fuente base: `/opt/projects/leadflow/docs/server-inventory.md`

## Criterio de clasificación
- `KEEP`: mantener como base compartida para el nuevo SaaS.
- `REVIEW`: validar uso real antes de decidir retiro.
- `REMOVE`: programar retiro por fases, sujeto a backups y validación final.

## Matriz de limpieza

| stack/servicio | estado actual | clasificación | motivo | dependencias detectadas | acción recomendada | orden sugerido | riesgo |
|---|---|---|---|---|---|---:|---|
| `traefik` | Activo (`1/1`) | KEEP | Edge routing transversal | Inferida dependencia de servicios publicados por `traefik_public` | Mantener, documentar rutas activas y ownership | 0 | Medio (si se toca) |
| `portainer` | Activo (`1/1`) | KEEP | Gestión operativa de Swarm | Dependencia operativa del equipo | Mantener, restringir acceso y auditar | 0 | Bajo |
| `evolution` | Activo (`1/1`) | KEEP | Componente objetivo del producto | Volumen `evolution_v2_instances` | Mantener y versionar configuración | 1 | Medio |
| `n8n-v2` | Activo (`1/1` x3) | KEEP | Automatización objetivo del producto | Volúmenes `n8n_binary_v2`, `n8n_nodes_v2`, posible `n8n_custom_nodes` | Mantener y consolidar como única línea n8n | 1 | Medio |
| `redis` | Activo (`1/1`) | KEEP | Cache/estado efímero compartido | Volumen `redis_data` | Mantener y definir políticas TTL/backup selectivo | 1 | Bajo |
| `rabbitmq` | Activo (`1/1`) | KEEP | Cola/eventos asíncronos | Volumen `rabbitmq_data` | Mantener y controlar colas huérfanas | 1 | Medio |
| `postgres_pgvector` | Activo (`1/1`) | KEEP | Base transaccional/vectorial potencial | Volumen `pgvector_data` | Mantener y aplicar backups consistentes | 1 | Alto (si se toca) |
| `minio` | Activo (`1/1`) | KEEP | Almacenamiento objeto | Volumen `minio_minio_data_fresh` | Mantener y revisar lifecycle/políticas | 1 | Medio |
| `mongodb` | Activo (`1/1`) | KEEP | Persistencia documental potencial | Volúmenes `mongodb_data`, `mongodb_configdb_data` | Mantener y evaluar necesidad funcional | 2 | Medio |
| `aurum` | Activo (`1/1`) | REVIEW | Proyecto paralelo fuera de alcance leadflow | No explícitas en inventario | Validar owner y tráfico antes de decidir | 2 | Medio |
| `horprices` | Activo (`1/1`) | REVIEW | Proyecto paralelo fuera de alcance leadflow | No explícitas en inventario | Validar owner y tráfico antes de decidir | 2 | Medio |
| `kloser` | Activo (`1/1`) | REVIEW | Proyecto paralelo fuera de alcance leadflow | No explícitas en inventario | Validar owner y tráfico antes de decidir | 2 | Medio |
| `midas-bot` | Activo (`1/1`) | REVIEW | Proyecto paralelo fuera de alcance leadflow | No explícitas en inventario | Validar owner y tráfico antes de decidir | 2 | Medio |
| `n8n` | Activo (`1/1` x3) | REMOVE | Duplicidad con `n8n-v2` | Posible dependencia de workflows no migrados | Congelar cambios, exportar workflows, retirar tras validación | 3 | Alto |
| `midas-bot-dev` | Activo (`1/1`) | REMOVE | Entorno dev candidato a retiro | No explícitas en inventario | Validar uso por QA/dev y retirar en ventana controlada | 3 | Medio |
| `kurukin-bot` | Activo (`1/1` x2) | REMOVE | Legacy WordPress/MySQL, fuera del nuevo enfoque | Volúmenes `kurukin-bot_wordpress_data`, `kurukin-bot_wordpress_db_data`, `kurukin-bot_*_shared` | Respaldar volúmenes y retirar por fases | 4 | Alto |
| `kurukin_saas` | Activo (`1/1` x2) | REMOVE | Legacy WordPress/MariaDB, fuera del nuevo enfoque | Red `kurukin_saas_kurukin_internal`, volúmenes `kurukin_saas_*` y `kurukin-saas_*` | Respaldar, validar naming duplicado y retirar por fases | 4 | Alto |

## Secuencia sugerida de ejecución (solo planificación)
1. Validar ownership y uso real de stacks `REVIEW`.
2. Cerrar coexistencia n8n (`n8n` vs `n8n-v2`) con checklist de migración.
3. Retirar entornos dev/duplicados sin tráfico (`midas-bot-dev`).
4. Retirar legacy WordPress (`kurukin-bot`, `kurukin_saas`) con backup y rollback documentados.
5. Limpiar redes/volúmenes huérfanos únicamente después de confirmar retiro exitoso.

## Guardrails de esta fase
- No eliminar stacks ni servicios.
- No ejecutar deploys.
- No modificar infraestructura actual.
- Usar esta matriz como base para una ventana de cleanup posterior.
