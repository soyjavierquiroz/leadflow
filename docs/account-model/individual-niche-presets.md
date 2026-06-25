# Individual niche presets (legacy)

Este documento describe el contrato v1 legacy. La taxonomia vigente de Fase 8
esta en `docs/account-model/commercial-taxonomy.md`.

Fase 7 estandariza el nicho de las cuentas individuales y deja preparada una
configuracion comercial estatica para fases posteriores.

## Nichos estandar

Los formularios de `Crear cuenta individual` en Super Admin y
`/onboarding/individual` usan un `select` con claves normalizadas:

| Key | Label |
| --- | --- |
| `nutrition_wellness` | Nutrición y bienestar |
| `beauty` | Belleza y estética |
| `courses_academies` | Cursos y academias |
| `coaching_consulting` | Coaching y consultoría |
| `real_estate` | Inmobiliaria |
| `local_business` | Negocio local |
| `other` | Otro |

El payload envia la `key`, no el texto visible. El backend acepta claves
estandar y normaliza algunos labels legados hacia la misma clave; si el valor
viene vacio o desconocido usa `other`.

## Preset por nicho

La configuracion compartida vive en `@leadflow/account-model` y define:

```ts
{
  niche,
  defaultFunnelName,
  defaultFunnelGoal,
  suggestedCta,
  suggestedPipelineStages,
  suggestedAiTone
}
```

La version legacy del perfil comercial era:

```ts
commercialProfile: {
  niche,
  presetVersion: "v1"
}
```

Desde Fase 8 el backend mantiene `niche` solo por compatibilidad y devuelve:

```ts
commercialProfile: {
  vertical,
  industry,
  businessModel,
  legacyNiche,
  presetVersion: "v2"
}
```

Los presets v1 son estaticos. No usan IA y no modifican CRM lifecycle,
ownership, assignments, WhatsApp, runtime IA, Kloser, n8n ni tracking/CAPI.

## Persistencia

El provisioning individual normaliza el nicho y devuelve `niche` junto con el
contrato `commercialProfile` en la respuesta.

Actualmente `Workspace`, `Team` y `Sponsor` no tienen un campo seguro de
`metadata` o `config` en el esquema Prisma. Por eso esta fase no persiste
`commercialProfile` en esas entidades ni reutiliza columnas con otro proposito.
La persistencia completa debe hacerse con una migracion dedicada o con un campo
de metadata explicito para el modelo de cuenta.

## Por que no se crean funnels automaticamente

Crear funnels por nicho todavia implicaria decidir ownership, publicacion,
dominio, tracking, pipeline operativo y handoff inicial. Esas decisiones tienen
impacto fuera del onboarding y podrian tocar areas que esta fase evita por
alcance.

Por ahora el preset solo describe el funnel sugerido, CTA, etapas y tono IA.
Esto permite probar la seleccion de nicho y el contrato comercial sin crear
artefactos runtime automaticamente.

## Siguiente fase recomendada

La siguiente fase deberia crear un funnel estandar por nicho usando estos
presets como fuente, con una migracion o metadata explicita para persistir
`commercialProfile` en la cuenta individual. Esa fase tambien debe definir si el
funnel queda como draft, si se publica, que dominio usa y como se relaciona con
tracking y handoff.
