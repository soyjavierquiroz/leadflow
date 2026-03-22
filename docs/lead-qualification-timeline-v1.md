# Lead Qualification & Timeline v1

## Objetivo

Volver más útil la operación diaria sobre leads ya capturados y asignados sin convertir Leadflow en un CRM complejo. Esta fase consolida señales entrantes, eventos manuales y notas simples en una sola vista operativa para `MEMBER` y `TEAM_ADMIN`.

## Qué aporta esta fase

- timeline consolidada por lead
- resumen operativo del lead
- calificación simple por temperatura comercial
- notas manuales básicas
- siguiente acción
- follow-up con fecha opcional
- trazabilidad de cambios manuales relevantes

## Campos y estados introducidos

Sobre `Lead`:

- `qualificationGrade`
  - `cold`
  - `warm`
  - `hot`
- `summaryText`
- `nextActionLabel`
- `followUpAt`
- `lastContactedAt`
- `lastQualifiedAt`

Nuevo modelo:

- `LeadNote`
  - comentario manual corto
  - autor
  - contexto de `workspace`, `team`, `lead` y `sponsor` cuando aplica

## Endpoints v1

- `GET /v1/leads/:id/timeline`
- `PATCH /v1/leads/:id/qualification`
- `PATCH /v1/leads/:id/follow-up`
- `POST /v1/leads/:id/notes`

Se mantiene además:

- `GET /v1/leads`
- `GET /v1/leads/:id`
- `PATCH /v1/leads/:id` para cambios simples del member sobre estado operativo

## Ownership y operación manual

- `MEMBER` solo opera leads asignados a su sponsor.
- `TEAM_ADMIN` ve y actualiza contexto operativo de los leads del team.
- `SUPER_ADMIN` mantiene visibilidad global.

La operación manual permitida en v1 es:

- calificar lead
- resumir contexto
- definir siguiente acción
- programar follow-up
- agregar notas

## Relación con señales entrantes

Las señales entrantes siguen siendo la base de automatización ligera:

- `conversation_started`
- `message_inbound`
- `message_outbound`
- `lead_contacted`
- `lead_qualified`
- `lead_follow_up`
- `lead_won`
- `lead_lost`

Esta fase no reemplaza esas señales. Las complementa con operación manual del sponsor/team:

- las señales actualizan estado operativo cuando aplica
- la operación manual agrega contexto humano
- ambos caminos se consolidan en una sola timeline

## Qué queda fuera intencionalmente

- inbox conversacional
- pipeline CRM avanzado
- múltiples owners por lead
- tareas complejas o recordatorios automáticos
- scoring sofisticado
- reporting avanzado de actividad comercial

## Cómo prepara el camino siguiente

Esta capa deja listo el terreno para:

- timeline más rica con más tipos de eventos
- inbox o detalle conversacional
- acciones automatizadas posteriores al follow-up
- calificación más fina y playbooks por team
