# UI / Product Clarity Pass v1

## Problemas de claridad detectados

- Las superficies internas comunicaban bien estructura técnica, pero poco contexto operativo por rol.
- Varias pantallas usaban títulos abstractos y descripciones demasiado genéricas para entender qué hacer primero.
- Los KPIs existían, pero no siempre respondían a preguntas concretas de operación diaria.
- Los estados vacíos eran correctos, aunque todavía se sentían como placeholders más que como guía de producto.
- La navegación lateral y el top bar mostraban información útil, pero sin suficiente jerarquía para orientar a `Super Admin`, `Team Admin` y `Member`.
- `member/channel` explicaba el estado técnico del provider, pero no dejaba tan claro para qué sirve conectar el canal y qué cambia para el sponsor.

## Criterio visual aplicado

- Mantener el shell existente y mejorar claridad sin rehacer el design system.
- Reforzar contexto por rol con sidebar, top bar y headers más orientados a operación.
- Hacer que los KPIs expliquen situación, no solo conteo.
- Traducir labels y acciones a lenguaje más comercial y operativo.
- Convertir filtros, tablas y empty states en superficies más legibles y menos “demo técnica”.
- Enfatizar qué hacer ahora, qué está bloqueado y qué parte del flujo ya funciona.

## Qué cambió por superficie

### Shared shell

- Sidebar más clara, con orientación por rol y navegación descrita como módulos operativos.
- Top bar con mejor contexto de sesión, workspace y fuente de datos.
- `SectionHeader`, `KpiCard`, `DataTable` y `EmptyState` con mejor jerarquía visual y lectura más rápida.

### `/admin`

- Cambió de “control estructural” a panel de plataforma con lectura de rollout.
- KPIs ahora hablan de teams operando, funnels activos, publicaciones live y leads en movimiento.
- Se agregó un bloque de lectura rápida para explicar qué supervisa plataforma hoy.
- Se incorporó un resumen de teams para que el panel se entienda como gobierno operativo y no solo como catálogo abstracto.

### `/team`

- El dashboard ahora comunica pulso del equipo y prioridades del día.
- Se agregó contexto de capacidad comercial, readiness de funnels y leads que necesitan atención.
- La tabla de leads recientes se orientó a owner, entrada y movimiento del pipeline.

### `/team/leads`

- La vista quedó más claramente posicionada como bandeja operativa.
- Mejoraron los labels de filtros, estados y columnas.
- Se agregaron resúmenes sobre carga visible, leads por destrabar y prioridad comercial.
- El detalle modal refuerza la lectura de owner, reminder y próximo movimiento.

### `/member`

- El dashboard pasó a leerse como jornada comercial del sponsor.
- Se incorporó una capa de contexto sobre capacidad, handoffs nuevos y acciones para hoy.
- La acción rápida principal se renombró para que se entienda como “tomar handoff”.

### `/member/leads`

- La bandeja ahora prioriza seguimiento y foco diario en vez de sonar a listado técnico.
- Se agregaron resúmenes de leads visibles, handoffs por tomar y prioridad comercial.
- Se mejoraron labels de filtros, columnas y acciones del modal.

### `/member/channel`

- La página ahora explica para qué sirve conectar WhatsApp y qué sigue después.
- Se agregaron pasos visibles del flujo: preparar instancia, escanear QR y asegurar continuidad.
- Los KPIs y textos se orientaron a readiness del canal y efecto sobre el handoff.

## Qué queda pendiente

- Unificar todavía más el lenguaje de estados de negocio en badges y acciones mutativas.
- Mejorar el detalle de `/admin/teams`, `/team/publications` y `/member/profile` con el mismo nivel de claridad.
- Introducir señales visuales más fuertes de prioridad diaria sin convertir el shell en un CRM completo.
- Llevar este mismo criterio a las pantallas secundarias para que todo el producto se sienta igual de claro.
