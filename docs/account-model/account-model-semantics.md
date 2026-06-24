# Account model semantics

## Purpose

This phase adds internal semantics for the future hybrid account model:

- Individual
- Microteam
- Team
- Enterprise

It does not introduce a new `Account` entity. `Workspace` remains the tenant/account boundary, and `Team` remains the operational grouping used by the current product.

## Why there is no Account entity yet

The current system already scopes users, teams, sponsors, funnels, leads, assignments, messaging connections, runtime context, tracking, billing primitives, and operational data through `Workspace` and `Team`.

Adding a separate `Account` table now would create a second tenant boundary before the product needs it. The safer path is to add conservative semantics to the existing boundaries:

- `Workspace.accountType` describes the account scale.
- `Team.teamType` describes the operational shape of a team inside that workspace.

This preserves current behavior while giving future phases explicit vocabulary for onboarding, labels, billing, and non-critical UI gating.

## Workspace.accountType

`Workspace.accountType` is a Prisma enum with these values:

- `individual`
- `microteam`
- `team`
- `enterprise`

The default is `team`.

Existing workspaces therefore remain equivalent to the current team-based product after the migration.

## Team.teamType

`Team.teamType` is a Prisma enum with these values:

- `personal`
- `commercial_team`
- `department`

The default is `commercial_team`.

Existing teams therefore remain equivalent to the current commercial team model after the migration.

## Conservative defaults

The migration sets:

- Existing `Workspace.accountType` values to `team`.
- Existing `Team.teamType` values to `commercial_team`.

Payloads that do not include these fields yet are treated by helper functions as:

- `accountType = team`
- `teamType = commercial_team`

This protects current UI and API callers while the model evolves.

## Target shapes

### Individual

An individual account is modeled as:

- `Workspace.accountType = individual`
- One personal team with `Team.teamType = personal`
- The owner has a `Sponsor` record
- The owner user keeps the internal role `TEAM_ADMIN`

In short:

`Individual = Workspace + Team personal + Sponsor owner + User TEAM_ADMIN`

### Microteam

A microteam is modeled as:

- `Workspace.accountType = microteam`
- A personal or commercial team depending on the future onboarding path
- Multiple users can support the owner
- Assistants can receive future visible labels without changing internal roles

### Team

The current product remains:

- `Workspace.accountType = team`
- `Team.teamType = commercial_team`
- Existing team admin and member flows stay unchanged

### Enterprise

An enterprise account is modeled as:

- `Workspace.accountType = enterprise`
- Multiple teams under the same workspace
- Teams can be commercial teams or departments

## Future visible role labels

Visible labels can be derived from internal roles plus account/team semantics:

- `SUPER_ADMIN` remains `Super Admin`.
- `TEAM_ADMIN` in `individual` or `personal` contexts can be shown as `Propietario de Cuenta`.
- `TEAM_ADMIN` in current team/commercial contexts can be shown as `Administrador`.
- `MEMBER` in `personal` or `microteam` contexts can be shown as `Asistente`.
- `MEMBER` in `commercial_team` contexts can be shown as `Asesor`.

These are display labels only. Internal roles remain:

- `SUPER_ADMIN`
- `TEAM_ADMIN`
- `MEMBER`

## What does not change in this phase

This phase does not change:

- Lead logic
- Assignment logic
- Ownership MLM logic
- MessagingConnection behavior
- Runtime Context behavior
- Kloser behavior
- AI Gateway behavior
- n8n behavior
- Tracking, Meta CAPI, TikTok, browser/server dedupe, or event payloads
- Real authorization rules
- Guards, decorators, or permissions
- Critical UI gating
- Existing team/member CRM behavior

Helpers are intentionally not wired into critical screens or permissions yet.

## Future phases

Suggested follow-up phases:

1. Add onboarding flows that can create an individual workspace, personal team, sponsor owner, and `TEAM_ADMIN` user together.
2. Add non-critical UI labels using the helper layer.
3. Add safe capability checks for navigation and empty states, guarded by focused regression tests.
4. Add billing/Kredits semantics that derive from `Workspace.accountType`.
5. Add enterprise team management semantics for departments and multiple teams.
6. Revisit whether an explicit `Account` entity is needed only after billing, ownership, and enterprise requirements justify it.
