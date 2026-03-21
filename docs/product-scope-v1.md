# Product Scope v1

## Objetivo de la fase actual
Implementar la expansion v2 de ownership, publicacion, templates, funnels y tracking en dominio y persistencia, manteniendo compatibilidad con el modelo previo y sin tocar produccion.

## Alcance funcional del dominio v1
Leadflow v1 ya modela:
- `workspaces` como frontera tenant/operativa.
- `teams` como unidad operativa principal.
- `sponsors` como destinatarios de asignacion.
- `rotation-pools` como contenedores de estrategia futura.
- `funnels` legacy para compatibilidad.
- `domains` y `funnel-publications` para publicacion por `host + path`.
- `funnel-templates`, `funnel-instances` y `funnel-steps` para runtime JSON-driven.
- `tracking-profiles`, `conversion-event-mappings` y `handoff-strategies` para configuracion declarativa.
- `visitors`, `leads`, `assignments` y `events` para operacion comercial y trazabilidad.

## MVP de esta etapa
- Schema Prisma expandido y migracion aplicada.
- Seed de desarrollo actualizado con dominio, template, instance, steps, publication, tracking y handoff.
- Repositorios/adapters Prisma para la expansion.
- Endpoints minimos de lectura para validar el modelo expandido.
- Documentacion de implementacion en `docs/domain-persistence-expansion-implemented-v2.md`.

## Fuera de alcance en esta etapa
- Integracion real con `Meta`.
- Integracion real con `TikTok`.
- Handoff real con WhatsApp.
- Auth real.
- Editor de templates para teams.
- Motor complejo de asignacion.
- Migraciones desde WordPress.
- Funcionalidades avanzadas de BI/ML.

## Dependencias tecnicas clave
- Frontend: Next.js + Tailwind + TypeScript.
- Backend: NestJS + Fastify + TypeScript.
- Persistencia base actual: PostgreSQL + Prisma.
- Infra objetivo: Docker Swarm + Traefik + PostgreSQL + Redis.

## Criterios de avance a la siguiente fase
1. Resolver runtime publico por `host + path`.
2. Implementar flows iniciales de captura sobre `FunnelInstance` y `FunnelPublication`.
3. Preparar auth y permisos sobre ownership real de `Team`.
4. Empezar a desacoplar consumers del `Funnel` legacy.
