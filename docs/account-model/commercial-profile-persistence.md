# Commercial profile persistence

## Decision

`CommercialProfile` is persisted per `teamId`.

The current individual account shape is:

`Individual = Workspace individual + Team personal + Sponsor owner + User TEAM_ADMIN`

The personal `Team` is the operational account boundary used by CRM, member
views, routing defaults and future growth into microteams. Persisting the
commercial profile on `teamId` keeps the blueprint attached to the operational
unit that will later own funnels, CRM presets, metrics and automation defaults.

## Workspace, Team and Sponsor

- `workspaceId` scopes the profile to the tenant and supports tenant-level
  lookup, cleanup and future reporting.
- `teamId` is unique and represents the durable commercial operating profile.
  A personal team has one profile today; future microteams or teams can keep the
  same one-profile-per-team rule.
- `sponsorId` is optional because the profile belongs to the team, not to the
  member identity. For individual accounts it points to the owner sponsor when
  available.

Workspace-level persistence was not chosen because a workspace can contain more
than one operational team in future account models. Keeping the profile at
workspace level would make future microteam or department profiles ambiguous.

## Blueprint relationship

The profile stores:

- `vertical`
- `industry`
- `businessModel`
- `legacyNiche`
- `presetVersion`
- `blueprintKey`
- `blueprintVersion`

Creation and update use `buildIndividualCommercialProfile()` for legacy niche
defaults and `resolveBusinessBlueprintForProfile()` to keep
`blueprintKey`/`blueprintVersion` derived from the selected taxonomy.

If `vertical`, `industry`, `businessModel` or `niche` changes, the blueprint is
recalculated. The taxonomy fields are strings instead of Prisma enums so new
blueprints and taxonomy values do not require database enum migrations.

## Core vs optional fields

Core fields for the current completion check:

- `businessName`
- `vertical`
- `industry`
- `businessModel`
- `blueprintKey`

Optional commercial context:

- `mainProduct`
- `averagePrice`
- `salesMotion`
- `country`
- `phone`
- `legacyNiche`
- `sponsorId`

`mainProduct` and `averagePrice` are intentionally optional during this phase.

## Explicitly not generated

This persistence phase does not:

- generate funnels
- apply pipeline presets
- create CRM presets
- connect AI
- connect n8n
- modify WhatsApp or messaging connections
- modify runtime context
- modify ownership, MLM assignment or lead routing
- modify Lead, Assignment, CRM or tracking/CAPI behavior

## Roadmap

The next account-model phase can introduce a funnel generator that reads the
stable `CommercialProfile` and its `blueprintKey`. That generator should remain
separate from profile persistence and should produce explicit preview/apply
steps before touching funnels, CRM presets, IA prompts, n8n workflows or
metrics.
