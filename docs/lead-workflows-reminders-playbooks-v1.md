# Lead Workflows / Reminders / Qualification Playbooks v1

## Objetivo

Agregar una capa operativa mas guiada sobre leads ya capturados y asignados, sin convertir Leadflow todavia en un CRM complejo y sin abrir inbox conversacional.

## Que aporta esta fase

- reminders simples por lead usando `followUpAt`
- resumen de leads vencidos, para hoy, proximos y sin follow-up
- siguiente accion sugerida por estado y calificacion
- playbook recomendado por lead
- visibilidad operativa mejorada en `/member/leads` y `/team/leads`
- seed realista para probar overdue, due today, upcoming y unscheduled

## Como funciona reminder / follow-up

En v1 no se crea una entidad nueva de reminder.

Se reutiliza la capa ya existente sobre `Lead`:

- `nextActionLabel`
- `followUpAt`
- `lastContactedAt`
- `lastQualifiedAt`

Desde esos campos el sistema deriva un estado operativo de reminder:

- `overdue`
  - el follow-up ya quedo en un dia anterior
- `due_today`
  - el follow-up cae en el dia actual
- `upcoming`
  - el follow-up esta programado para dias futuros
- `unscheduled`
  - el lead sigue activo pero todavia no tiene `followUpAt`
- `none`
  - el lead ya esta en estado terminal (`won` o `lost`)

La mutacion sigue siendo pragmatica:

- `PATCH /v1/leads/:id/follow-up`

No se agregan automatizaciones, colas ni cron jobs en esta fase.

## Playbooks soportados en v1

### `first_contact`

Para leads recien asignados o sin contacto previo.

Objetivo:

- tomar ownership rapido
- abrir la primera conversacion
- dejar el siguiente follow-up visible

### `active_nurture`

Para leads en conversacion o nurturing activo.

Objetivo:

- mantener contexto
- empujar siguiente paso
- no perder timing comercial

### `high_intent_close`

Para leads `qualified` o `hot`.

Objetivo:

- mover a llamada, demo o propuesta
- dejar seguimiento corto hasta resolucion

### `cold_reengage`

Para leads `cold`.

Objetivo:

- reactivar con mensaje breve
- validar timing real
- espaciar esfuerzo si no hay respuesta

### `won_handoff`

Para leads `won`.

Objetivo:

- confirmar cierre
- hacer handoff a onboarding o siguiente owner
- limpiar seguimiento comercial

### `lost_recycle`

Para leads `lost`.

Objetivo:

- registrar razon de perdida
- decidir si entra a reciclaje futuro
- evitar follow-ups fantasmas

## Endpoints v1

- `GET /v1/leads`
  - ahora devuelve tambien estado derivado de reminder, suggested next action y playbook recomendado
- `GET /v1/leads/reminders/summary`
  - resumen operativo de overdue, due today, upcoming y unscheduled
- `GET /v1/leads/:id/playbook`
  - playbook y siguiente accion sugerida para un lead puntual
- `GET /v1/leads/:id/timeline`
  - ahora incluye tambien el bloque `workflow`
- `PATCH /v1/leads/:id/follow-up`
  - mantiene el update manual de reminder / next step

## Ownership y visibilidad

- `MEMBER`
  - opera solo sus leads asignados
  - ve reminder, playbook y siguiente accion de su cartera
- `TEAM_ADMIN`
  - ve el contexto operativo del team
  - prioriza backlog vencido y seguimiento del dia
- `SUPER_ADMIN`
  - mantiene visibilidad global

## Relacion con la timeline actual

Esta fase no reemplaza la timeline introducida en `lead-qualification-timeline-v1`.

La relacion es:

- la timeline sigue siendo la vista cronologica de eventos, notas y señales
- los reminders y playbooks son la capa de priorizacion operativa actual
- la proxima accion sugerida usa estado, calificacion y seguimiento existente
- el bloque `workflow` dentro del detalle del lead conecta ambas capas

En otras palabras:

- timeline = que paso
- workflow = que conviene hacer ahora

## Que queda fuera intencionalmente

- inbox conversacional
- tareas complejas multi-owner
- automatizacion avanzada por reglas
- SLAs complejos
- secuencias automáticas
- CRM completo con pipelines extensos
- reasignacion avanzada y colas inteligentes
- IA de scoring o coaching

## Decision de persistencia

En esta fase no fue necesaria una migracion nueva.

Motivo:

- `Lead` ya tenia los campos minimos para reminder y next step
- la logica nueva es derivada
- los playbooks de v1 son plantillas de aplicacion, no configuracion editable por team

## Seed y validacion

El seed se ajusta para dejar casos reales de:

- overdue
- due today
- upcoming
- unscheduled

Tambien deja:

- leads asignados a distintos sponsors
- señales entrantes
- notas manuales
- timeline suficiente para probar member y team workflows
