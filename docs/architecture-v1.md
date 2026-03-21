# Architecture v1

## Objetivo de esta fase
Implementar el scaffold real del monorepo Leadflow con dos apps base:
- `apps/web` en Next.js App Router.
- `apps/api` en NestJS con Fastify.

Sin integrar aun logica de negocio completa ni dependencias de datos externas.

## Arquitectura implementada

### 1) Monorepo y orquestacion
- Gestor de workspaces: `pnpm`.
- Orquestacion de tareas: `turbo`.
- Layout:
  - `apps/*` para aplicaciones desplegables.
  - `packages/*` para modulos compartidos.

### 2) Frontend (`apps/web`)
- Stack: Next.js 16 + React 19 + TypeScript + Tailwind CSS.
- Router: App Router.
- Estructura inicial de rutas:
  - `app/(site)/page.tsx` -> landing temporal del producto.
  - `app/(members)/members/page.tsx` -> placeholder area privada.
  - `app/(admin)/admin/page.tsx` -> placeholder panel administrativo.
- Se dejo base visual limpia y profesional orientada a SaaS.

### 3) Backend (`apps/api`)
- Stack: NestJS 11 + Fastify adapter.
- Bootstrap Fastify en `src/main.ts`.
- `ConfigModule` global habilitado en `AppModule` para crecimiento por entornos.
- Endpoint de salud:
  - `GET /health` -> estado, servicio y timestamp.
- Estructura minima de modulos:
  - `src/health/`
  - `src/modules/leads/`
  - `src/modules/assignment/`

### 4) Shared packages base
Se agregaron paquetes placeholders con `package.json` valido:
- `@leadflow/ui`
- `@leadflow/config`
- `@leadflow/types`

Todos con estructura `src/` y scripts minimos para evolucion futura.

## Decisiones tecnicas clave
1. Nest vive como app estandar en `apps/api` y no como monorepo Nest.
2. Se usa Fastify desde la base para mejor rendimiento y menor overhead.
3. Se habilita `ConfigModule` global desde v1 para escalar configuracion.
4. Se define segmentacion inicial de frontend (`site`, `members`, `admin`) desde el scaffold.
5. Se preserva documentacion previa de inventario y baseline de infraestructura.

## Fuera de alcance en esta fase
- Integracion con n8n/Evolution API.
- Conexion a PostgreSQL/Redis.
- Autenticacion, permisos y dominio completo de negocio.
- Despliegue o cambios de stacks del servidor.

## Validaciones esperadas de esta fase
- `pnpm install`
- `pnpm build`
- `pnpm lint`

Estas validaciones confirman estabilidad del scaffold inicial para continuar con desarrollo funcional en la siguiente etapa.
