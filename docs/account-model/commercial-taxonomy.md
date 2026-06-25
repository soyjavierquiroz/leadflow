# Commercial taxonomy v2

Fase 8 separa conceptos que antes estaban mezclados en `niche`. El modelo
conceptual queda:

```txt
Cuenta -> Vertical -> Industria / Especialidad -> Modelo Comercial -> Perfil Comercial -> Presets
```

## Conceptos

`Vertical` define el comportamiento base del sistema. De aqui deben colgar
workflows n8n futuros, IA base futura, funnels base futuros, pipeline CRM
futuro, automatizaciones futuras y metricas/reportes futuros. La vertical es
la dimension estructural.

`Industria / Especialidad` define el contexto de negocio dentro de la vertical:
nutricion, belleza, coaching, cursos, inmobiliaria residencial, negocio local,
etc. Esta dimension sirve para personalizar copy, ejemplos, criterios de
calificacion y contexto comercial sin cambiar el comportamiento base.

`Modelo Comercial` define como vende la cuenta: distribuidor, consultor,
asesor, proveedor de servicio, vendedor de cursos, servicio local, vendedor
e-commerce, reclutador, broker u otro.

`Perfil Comercial` es la combinacion normalizada que se devuelve al crear una
cuenta individual:

```ts
commercialProfile: {
  vertical,
  industry,
  businessModel,
  legacyNiche,
  presetVersion: "v2"
}
```

## Verticales oficiales

| Key | Label |
| --- | --- |
| `mlm` | Multinivel / Redes |
| `consulting_services` | Consultoria y servicios profesionales |
| `education` | Educacion y cursos |
| `real_estate` | Inmobiliaria |
| `health_wellness` | Salud y bienestar |
| `beauty_aesthetics` | Belleza y estetica |
| `local_business` | Negocio local |
| `ecommerce` | E-commerce |
| `insurance_finance` | Seguros y finanzas |
| `recruiting_hr` | Reclutamiento / RRHH |
| `other` | Otro |

## Industrias por vertical

| Vertical | Industrias / especialidades |
| --- | --- |
| `mlm` | `nutrition_mlm`, `beauty_mlm`, `wellness_mlm`, `finance_mlm`, `other_mlm` |
| `consulting_services` | `coaching`, `business_consulting`, `marketing_agency`, `legal_services`, `accounting`, `personal_brand`, `other_consulting` |
| `education` | `online_courses`, `academy`, `languages`, `professional_training`, `tutoring`, `other_education` |
| `real_estate` | `residential`, `commercial`, `rentals`, `developments`, `land`, `other_real_estate` |
| `health_wellness` | `nutrition`, `fitness`, `therapy`, `alternative_health`, `wellness_center`, `other_health` |
| `beauty_aesthetics` | `salon`, `skincare`, `aesthetic_clinic`, `spa`, `makeup`, `other_beauty` |
| `local_business` | `restaurant`, `repair_service`, `retail_store`, `automotive`, `home_services`, `other_local` |
| `ecommerce` | `physical_products`, `digital_products`, `dropshipping`, `marketplace`, `other_ecommerce` |
| `insurance_finance` | `insurance`, `credit`, `investments`, `financial_advisory`, `other_finance` |
| `recruiting_hr` | `recruiting_agency`, `job_board`, `internal_hr`, `staffing`, `other_hr` |
| `other` | `other` |

## Modelos comerciales

`distributor`, `consultant`, `advisor`, `service_provider`, `course_seller`,
`local_service`, `ecommerce_seller`, `recruiter`, `broker`, `other`.

## Adapter desde legacy niche

El payload legacy `niche` se mantiene para no romper onboarding ni creacion
desde Super Admin. `@leadflow/account-model` expone
`legacyNicheToCommercialTaxonomy(niche)` y usa defaults seguros:

| Legacy niche | Vertical | Industria | Modelo comercial |
| --- | --- | --- | --- |
| `nutrition_wellness` | `health_wellness` | `nutrition` | `advisor` |
| `beauty` | `beauty_aesthetics` | `salon` | `service_provider` |
| `courses_academies` | `education` | `online_courses` | `course_seller` |
| `coaching_consulting` | `consulting_services` | `coaching` | `consultant` |
| `real_estate` | `real_estate` | `residential` | `broker` |
| `local_business` | `local_business` | `other_local` | `local_service` |
| `other` o desconocido | `other` | `other` | `other` |

Si una fase futura ya tiene contexto suficiente para identificar MLM, el adapter
acepta `preferMlm` y puede mapear `nutrition_wellness` a
`mlm / nutrition_mlm / distributor`. El default actual sigue siendo
`health_wellness` para evitar asumir multinivel sin evidencia.

## Presets por vertical

Los presets v2 estan keyed por vertical en `commercialVerticalPresets`. Cada
preset define:

```ts
{
  vertical,
  label,
  defaultFunnelName,
  defaultFunnelGoal,
  suggestedCta,
  suggestedPipelineStages,
  suggestedAiTone,
  futureN8nWorkflowKey,
  futureAiPromptKey
}
```

Las claves `futureN8nWorkflowKey` y `futureAiPromptKey` son metadata inerte en
esta fase. No conectan n8n, no conectan IA y no crean funnels.

## Persistencia

En esta fase no hay migracion. El provisioning individual normaliza `niche`,
devuelve el `niche` legacy y construye `commercialProfile` v2 en la respuesta.
No se persiste `commercialProfile` en `Workspace`, `Team` ni `Sponsor` porque
no hay un campo seguro dedicado para ese contrato.

## Proximos pasos

1. Persistir `CommercialProfile` con migracion o metadata explicita de cuenta.
2. Crear funnels por vertical usando `commercialVerticalPresets`.
3. Definir como la industria ajusta copy, preguntas y contexto de IA.
4. Conectar workflows n8n y prompts IA por vertical solo cuando exista
   persistencia y ownership claros.
