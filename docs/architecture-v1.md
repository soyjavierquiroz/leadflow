# Architecture v1

## Objetivo
Definir la base tecnica inicial de Leadflow para soportar captacion, asignacion de leads y automatizacion con `n8n` + `Evolution API`, sin WordPress.

## Arquitectura objetivo (alto nivel)
- `apps/web`: interfaz de operacion y administracion.
- `apps/api`: API principal para dominio de leads, reglas y orquestacion.
- `n8n-v2`: motor de workflows e integraciones operativas.
- `evolution`: gateway de mensajeria para canales compatibles.
- Datos e infraestructura compartida: `postgres_pgvector`, `redis`, `rabbitmq`, `minio` (y `mongodb` segun caso).

## Principios v1
- Monorepo con ownership claro por capa.
- Interfaces de integracion desacopladas del core de negocio.
- Observabilidad y trazabilidad desde la base (logs/eventos).
- Preparacion para despliegue progresivo en Docker Swarm + Traefik.

## Baseline de infraestructura de referencia
Este documento se apoya en:
- `docs/server-inventory.md`
- `docs/infrastructure-baseline-v1.md`
- `docs/cleanup-plan-v1.md`

## Limites de esta fase
- No se implementa todavia el scaffolding completo de Next.js/NestJS.
- No se ejecutan cambios sobre infraestructura existente del servidor.
- No se realizan despliegues.
