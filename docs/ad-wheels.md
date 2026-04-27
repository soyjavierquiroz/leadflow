# Ad Wheels

Documentacion tecnica del modulo `ad-wheels` y de la asignacion publica sobre trafico `PAID_WHEEL`.

## Resumen del modelo actual

El motor de ruedas ya no consume inventario de asientos por lead asignado.

Ahora cada `AdWheelParticipant.seatCount` representa un peso estable dentro de una secuencia ciclica infinita:

- `seatCount = 1` aporta una aparicion dentro del ciclo.
- `seatCount = 3` aporta tres apariciones distribuidas de forma suave dentro del mismo ciclo.
- el ciclo completo vive en `AdWheelTurn` y se regenera cuando cambian los participantes o sus pesos.

La secuencia se construye con smooth weighted round-robin en `apps/api/src/modules/ad-wheels/ad-wheel-sequence-generator.service.ts`.

## `currentTurnPosition`

`AdWheel.currentTurnPosition` ya no apunta a "asientos restantes" ni a inventario pendiente.

Ahora representa el cursor del siguiente turno a evaluar dentro de la secuencia activa:

1. La API bloquea la fila de `AdWheel` con `FOR UPDATE`.
2. Lee `currentTurnPosition` y `sequenceVersion`.
3. Busca el siguiente `AdWheelTurn` elegible para esa version.
4. Crea la asignacion para el sponsor encontrado.
5. Avanza `currentTurnPosition` al siguiente indice ciclico.

Si el cursor queda fuera de rango por cualquier razon, el runtime lo normaliza con modulo sobre el total de turnos de la version activa.

## `seatCount` como peso, no como inventario

Antes el modelo interpretaba los asientos como unidades consumibles. Ese enfoque rompia el equilibrio cuando habia concurrencia, recompras o cambios de participantes a mitad de rotacion.

Con el modelo actual:

- `seatCount` define probabilidad relativa dentro del ciclo.
- los asientos no se marcan como gastados.
- un sponsor permanece en la rueda mientras siga siendo participante activo con `seatCount > 0`.
- cambiar `seatCount` solo cambia la forma del siguiente ciclo regenerado.

Ejemplo simple:

- Sponsor A: `seatCount = 2`
- Sponsor B: `seatCount = 1`

La secuencia regenerada tendra 3 posiciones totales. Una distribucion valida seria `A, B, A`. Al terminar la posicion 3, la rueda vuelve a la posicion 1 y sigue indefinidamente.

## `sequenceVersion`

`AdWheel.sequenceVersion` protege los ciclos activos cuando la composicion de la rueda cambia.

Se incrementa cuando:

- un sponsor entra por buy-in
- un admin actualiza `seatCount`

Despues de incrementar la version:

1. `currentTurnPosition` vuelve a `1`
2. se borra la secuencia anterior en `AdWheelTurn`
3. se genera una secuencia nueva con la version actual

Esto evita mezclar turnos viejos con una configuracion nueva de participantes o pesos.

## Seguridad transaccional

La reserva del siguiente turno pagado ocurre dentro de la transaccion de captura publica en `apps/api/src/modules/public-funnel-runtime/lead-capture-assignment.service.ts`.

Guardrails principales:

- `SELECT ... FOR UPDATE` sobre `AdWheel` para serializar el avance del cursor.
- lectura filtrada por `sequenceVersion` para no consumir turnos de una secuencia obsoleta.
- avance atomico de `currentTurnPosition` dentro de la misma transaccion que crea la asignacion.

Con eso evitamos que dos leads simultaneos reserven el mismo turno.

## Cambios de modelo relevantes

`AdWheelTurn` ya no modela consumo por fila.

Campos removidos del modelo anterior:

- `isConsumed`
- `assignmentId`

La fuente de verdad ahora es:

- la posicion dentro de la secuencia
- la `sequenceVersion`
- el cursor `currentTurnPosition` almacenado en `AdWheel`

## Superficie del modulo

Endpoints principales del controlador `apps/api/src/modules/ad-wheels/ad-wheels.controller.ts`:

- `GET /v1/team/wheels`
- `POST /v1/team/wheels`
- `PATCH /v1/team/wheels/:id`
- `POST /v1/team/wheels/:id/participants`
- `GET /v1/sponsors/me/wheels/active`
- `POST /v1/sponsors/me/wheels/:wheelId/join`

## Script de wipe para QA

Para resetear un entorno de pruebas sin tocar catalogos base:

```bash
cd apps/api
pnpm qa:wipe-test-environment
```

El script `src/scripts/wipe-test-environment.ts` elimina:

- `DomainEvent`
- `Assignment`
- `Lead`
- `AdWheelTurn`

Y ademas resetea todas las ruedas activas a:

- `currentTurnPosition = 1`
- `sequenceVersion = 1`

Nota: este wipe esta pensado para QA y smoke tests. No debe ejecutarse sobre produccion.
