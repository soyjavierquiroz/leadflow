# Master Funnel Cloning

## Que es un Master Funnel

Un Master Funnel es un `FunnelInstance` completo usado como fuente estructural para el Arsenal. No pertenece comercialmente al cliente que lo habilita. Puede vivir tecnicamente en el workspace/team interno `LeadFlow Arsenal`, pero ese workspace es solo una ubicacion de autoria.

El Arsenal conserva `FunnelArsenalTemplate` como ficha de busqueda. La referencia preferida al contenido real es:

```text
FunnelArsenalTemplate.sourceFunnelInstanceId
```

## Donde vive

Ejecutar el seed idempotente:

```bash
pnpm --filter @leadflow/api seed:arsenal-workspace
```

Esto crea o reutiliza:

- Workspace: `LeadFlow Arsenal`
- Team: `LeadFlow Arsenal Masters`

No existe todavia un flag `system/internal` en `Workspace` o `Team`. Por eso el naming debe mantenerse explicito.

## Que se clona

Al habilitar un template con `sourceFunnelInstanceId`, `FunnelMasterClonerService` crea:

- `Funnel` nuevo del workspace/team destino.
- `FunnelInstance` nueva del workspace/team destino.
- todos los `FunnelStep` del source con ids nuevos.
- `FunnelPublication` nueva del destino.

Se copian de forma saneada:

- `structuralType`
- `conversionContract`
- `settingsJson`
- `blocksJson`
- `mediaMap`
- `slug`, `stepType`, `position`, `isEntryStep`, `isConversionStep`
- `stages` y `entrySources` estructurales del `Funnel`

## Que no se clona

No se clonan:

- leads
- assignments
- ownership comercial
- rotation pools
- tracking profiles
- Meta/TikTok pixel ids
- CAPI/access tokens
- handoff strategies
- domains
- publicaciones activas del master
- analytics/eventos/runtime sessions
- WhatsApp/messaging connections
- shortlinks/ref links
- automation dispatches

Las claves JSON sensibles se eliminan si contienen fragmentos como `secret`, `token`, `authorization`, `cookie`, `api-key`, `access-token`, `capi`, `pixel` o `webhook`.

## Reescritura de FlowGraph

Antes de crear steps, el clonador reserva ids nuevos:

```text
source-step-a -> new-step-a
source-step-b -> new-step-b
```

Despues recorre recursivamente:

- `Funnel.config`
- `FunnelInstance.conversionContract`
- `FunnelInstance.settingsJson`
- `FunnelInstance.mediaMap`
- `FunnelStep.blocksJson`
- `FunnelStep.settingsJson`
- `FunnelStep.mediaMap`

Reescribe claves conocidas como `stepId`, `sourceStepId`, `targetStepId`, `nextStepId`, `fromStepId`, `toStepId`, `entryStepId`, `conversionStepId` y `fallbackStepId`. Tambien reemplaza cualquier string que coincida exactamente con un id de step source.

## Media

En Fase 13 no se duplican archivos fisicamente. Las URLs publicas CDN se conservan. Las URLs firmadas o con query params sensibles se nulifican.

## Path y dominio

Si el target tiene dominio custom activo, se publica en:

```text
/{pathSuggestion}
```

Si no tiene dominio custom, se usa el host plataforma:

```text
/u/{teamSlug}/{pathSuggestion}
```

Ejemplo:

```text
https://leadflow.kuruk.in/u/margarita-pasos/evaluacion
```

Si hay colision, se agrega sufijo:

```text
/u/margarita-pasos/evaluacion-2
```

No se usa `/ref/:slug` para funnels.

## Idempotencia

Enable busca una publicacion activa del team cuyo `FunnelInstance.code` sea:

```text
arsenal-{templateKey}
```

Si existe, devuelve esa publicacion. Si no existe:

- con `sourceFunnelInstanceId`: clona master y devuelve `source: "master_clone"`.
- sin `sourceFunnelInstanceId`: crea fallback minimo y devuelve `source: "fallback"` con warning.

## Asociar un FunnelInstance al Arsenal

Flujo minimo:

1. Crear o editar el master con el builder actual dentro del workspace/team interno.
2. Copiar el id del `FunnelInstance` master.
3. Ir a `/system/funnel-arsenal`.
4. Pegar `sourceFunnelInstanceId`.
5. Completar `templateKey`, `blueprintKey`, clasificacion, label, path y estado.
6. Guardar.

El backend valida que `sourceFunnelInstanceId` exista.

## Prueba de punta a punta

1. Ejecutar `pnpm --filter @leadflow/api seed:arsenal-workspace`.
2. Crear un FunnelInstance master en el team interno.
3. Asociarlo a un template activo en `/system/funnel-arsenal`.
4. Entrar como usuario/team con `CommercialProfile` completo y blueprint compatible.
5. Ejecutar enable desde `/member/funnels`.
6. Verificar respuesta:

```json
{
  "enabled": true,
  "source": "master_clone",
  "funnelInstanceId": "...",
  "publicationId": "...",
  "publicUrl": "https://leadflow.kuruk.in/u/team/evaluacion",
  "pathPrefix": "/u/team/evaluacion"
}
```

7. Abrir la URL publica y confirmar que el runtime resuelve la publicacion.

## Validaciones automatizadas

Comandos focales:

```bash
pnpm --filter @leadflow/api test -- funnel-arsenal
pnpm --filter @leadflow/web test -- funnel-arsenal
```

Comandos amplios de Fase 13:

```bash
pnpm --filter @leadflow/api prisma:generate
pnpm --filter @leadflow/api typecheck
pnpm --filter @leadflow/web typecheck
pnpm --filter @leadflow/account-model test
pnpm --filter @leadflow/account-model build
```
