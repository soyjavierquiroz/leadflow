# Product Scope v1

## Objetivo de la fase actual
Definir la estructura de ownership, publicacion, templates, funnels, tracking y handoff de Leadflow para soportar multi-domain y multi-funnel, sin implementar aun integraciones reales ni ampliar todavia la persistencia.

## Alcance funcional del dominio v1
Leadflow v1 modela:
- `workspaces` como frontera tenant/operativa.
- `teams` para ownership comercial.
- `sponsors` como destinatarios de asignacion.
- `rotation-pools` como contenedores de estrategia futura.
- `funnels` para contexto operativo de captacion.
- `visitors` para trazabilidad previa al lead.
- `leads` como prospectos del negocio.
- `assignments` como contrato de asignacion.
- `events` como timeline y auditoria.

## Foco estructural de esta etapa
Esta fase documenta y formaliza:
- ownership por `Super Admin`, `Team Admin` y `Sponsor/Member`
- al `Team` como owner operativo real
- publicacion por `host + path`
- diferencia entre `FunnelTemplate`, `FunnelInstance` y `FunnelStep`
- tipos de funnel recomendados para v1
- tipos de step recomendados para v1
- estrategias de handoff inmediato o diferido
- taxonomia de eventos de tracking
- mapeo recomendado para Meta y TikTok
- expansion de dominio sugerida para una fase posterior

## MVP de esta etapa
- Documento base de funnel y tracking en `docs/funnel-tracking-model-v1.md`.
- Propuesta de expansion del dominio en `docs/funnel-domain-expansion-v1.md`.
- Modelo de ownership, publicacion y templates en `docs/ownership-publication-template-model-v1.md`.
- Propuesta concreta de expansion de dominio/persistencia en `docs/domain-persistence-expansion-v2.md`.
- Alineacion de `README.md` y `docs/architecture-v1.md`.
- Criterios claros para la siguiente fase de implementacion de application flows.

## Fuera de alcance en esta etapa
- Integracion real con `Meta`.
- Integracion real con `TikTok`.
- Handoff real con WhatsApp.
- Auth real.
- Cambios de persistencia para las nuevas entidades sugeridas.
- Motor complejo de asignacion.
- Migraciones desde WordPress.
- Funcionalidades avanzadas de BI/ML.

## Dependencias tecnicas clave
- Frontend: Next.js + Tailwind + TypeScript.
- Backend: NestJS + Fastify + TypeScript.
- Persistencia base actual: PostgreSQL + Prisma.
- Infra objetivo: Docker Swarm + Traefik + PostgreSQL + Redis.

## Criterios de avance a la siguiente fase
1. Traducir la propuesta a entidades persistibles sin romper `Persistence Foundation v1`.
2. Implementar `Domain`, `FunnelTemplate`, `FunnelInstance` y `FunnelPublication`.
3. Mover ownership operativo explicito al `Team`.
4. Preparar auth y flows sobre el modelo consolidado, no sobre el modelo transitorio.
