# Business Blueprints v1

## Que es un Business Blueprint

Un Business Blueprint es una capa conceptual estatica y versionada del
`@leadflow/account-model`. Describe como deberia entenderse una cuenta desde su
vertical comercial: posicionamiento, pipeline recomendado, biblioteca futura de
funnels, prompt futuro de IA, workflow futuro de n8n, playbooks y metricas.

En esta fase el blueprint no ejecuta nada. Solo entrega metadata tipada para que
las proximas capas del producto tengan una fuente comun.

## Vertical vs Blueprint

La vertical responde: "en que categoria comercial vive esta cuenta?".

Ejemplos:

- `mlm`
- `consulting_services`
- `education`
- `real_estate`

El Business Blueprint responde: "que modelo operativo conceptual deberia usar
Leadflow para esa categoria?".

Ejemplo:

```ts
vertical = "mlm"
blueprintKey = "blueprint.mlm.v1"
blueprintVersion = "v1"
```

La vertical es taxonomia. El blueprint es una receta conceptual versionada para
CRM, funnels, IA, automatizacion, playbooks y metricas futuras.

## Por que no se crean funnels todavia

Los blueprints incluyen una `funnelLibrary` con `funnelKey`,
`recommendedFirstFunnelKey`, objetivo, CTA sugerido y ruta recomendada. Esos
campos son referencias futuras, no instancias.

Esta fase no crea funnels porque antes se necesita estabilizar el lenguaje
conceptual que usaran CRM, IA, n8n, playbooks y metricas. Crear funnels ahora
mezclaria definicion estrategica con ejecucion operativa.

## Fuente futura para otras capas

El blueprint sera la fuente conceptual futura para:

- CRM: nombre de pipeline y etapas recomendadas.
- Funnels: primer funnel sugerido y biblioteca por vertical.
- IA: `promptKey`, tono, rol del asistente y preguntas de calificacion.
- n8n: `n8nWorkflowKey` y eventos recomendados.
- Playbooks: acciones iniciales para seguimiento comercial.
- Metricas: KPI principal y KPIs secundarios.
- Knowledge base: contexto estable para documentacion y automatizaciones.

En v1 todos estos valores son estaticos y viven dentro de
`packages/shared/account-model`.

## Resolucion actual

La resolucion actual usa `resolveBusinessBlueprintForProfile(profile)`.

Regla vigente:

1. Si `profile.vertical` existe y es una vertical oficial, se usa el blueprint
   de esa vertical.
2. Si no hay vertical valida, se usa `blueprint.other.v1`.

`buildIndividualCommercialProfile(niche)` agrega:

```ts
{
  blueprintKey,
  blueprintVersion
}
```

No hay persistencia nueva. El `commercialProfile` sigue derivandose de la
taxonomia comercial y conserva compatibilidad con `legacyNiche` y
`presetVersion`.

## Roadmap futuro

La funcion de resolucion ya queda preparada para priorizar blueprints mas
especificos cuando existan:

1. `industry + businessModel`
2. `industry`
3. `vertical`
4. `other`

Fases futuras podran introducir blueprints por industria, marca, oferta,
campana o caso de uso. Cuando eso ocurra, la capa de ejecucion podra crear CRM,
funnels, prompts, workflows o playbooks a partir del blueprint, pero esa
ejecucion queda fuera de Business Blueprints v1.
