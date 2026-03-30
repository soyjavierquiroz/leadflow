# Leadflow API Docs

Auditoria tecnica realizada el 29 de marzo de 2026 sobre el flujo publico de leads y la rueda de asignacion.

## 1. Entry Point publico de leads

### Controlador exacto

- Controlador: `PublicFunnelRuntimeController`
- Archivo: `apps/api/src/modules/public-funnel-runtime/public-funnel-runtime.controller.ts`
- Prefijo global: `v1` configurado en `apps/api/src/main.ts`
- Endpoint efectivo: `POST /v1/public/funnel-runtime/submissions`
- URL de produccion esperada: `https://api.leadflow.kurukin.com/v1/public/funnel-runtime/submissions`

### Flujo del submit

`submitLeadCapture()` en `apps/api/src/modules/public-funnel-runtime/lead-capture-assignment.service.ts` hace todo el circuito en una sola transaccion:

1. Resuelve la publicacion por `publicationId`.
2. Valida que `currentStepId` pertenezca a esa publicacion.
3. Registra o actualiza el visitor.
4. Captura o actualiza el lead.
5. Resuelve el siguiente sponsor por rotacion.
6. Crea el assignment.
7. Calcula `nextStep`, `handoff` y el objeto `advisor`.

## 2. Payload de entrada

### Contrato TypeScript actual

Fuente: `apps/api/src/modules/public-funnel-runtime/dto/submit-public-lead-capture.dto.ts`

```ts
type SubmitPublicLeadCaptureDto = {
  submissionEventId?: string | null;
  publicationId: string;
  currentStepId: string;
  anonymousId: string;
  sourceChannel?: "manual" | "form" | "landing_page" | "api" | "import" | "automation";
  sourceUrl?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
  utmMedium?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  ttclid?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  fieldValues?: Record<string, string | null>;
  tags?: string[];
};
```

### Campos realmente necesarios

Necesarios a nivel backend:

- `publicationId`
- `currentStepId`
- `anonymousId`

Necesarios a nivel operacional:

- `fullName`
- `phone` o `email`

Nota importante: hoy el backend no impone validacion dura de `fullName`, `phone` o `email` en `submitLeadCapture()`. El frontend si los valida, pero si otro cliente llama directo al API podria crear leads incompletos.

### Ejemplo de payload recomendado

```json
{
  "submissionEventId": "evt_form_submitted_123",
  "publicationId": "pub_123",
  "currentStepId": "step_456",
  "anonymousId": "anon_789",
  "sourceChannel": "form",
  "sourceUrl": "https://retodetransformacion.com/inmuno",
  "utmSource": "meta",
  "utmCampaign": "inmuno_v13",
  "fullName": "Maria Perez",
  "phone": "+59170000000",
  "email": null,
  "companyName": null,
  "fieldValues": {
    "fullName": "Maria Perez",
    "phone": "+59170000000",
    "source": "lead_capture_modal"
  },
  "tags": ["runtime-v1", "lead-capture-modal"]
}
```

## 3. CORS y diagnostico de `Failed to fetch`

### Configuracion en codigo

Fuente: `apps/api/src/main.ts`

```ts
app.enableCors({
  origin: runtimeConfig.corsAllowedOrigins,
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
});
```

Fuente: `apps/api/src/config/runtime.ts`

- `corsAllowedOrigins` sale de `CORS_ALLOWED_ORIGINS`
- Si esa variable no existe, el backend usa `SITE_URL`, `MEMBERS_URL` y `ADMIN_URL`

### Configuracion por defecto en swarm

Fuente: `infra/swarm/docker-stack.yml`

- `API_URL`: `https://api.leadflow.kurukin.com`
- `CORS_ALLOWED_ORIGINS`: `https://leadflow.kurukin.com`

### Evidencia del despliegue actual

Prueba real ejecutada el 29 de marzo de 2026 contra `https://api.leadflow.kurukin.com/health`:

```json
{
  "status": "ok",
  "service": "leadflow-api",
  "version": "0.2.0",
  "environment": "production",
  "globalPrefix": "v1",
  "baseUrl": "https://api.leadflow.kurukin.com",
  "corsAllowedOrigins": ["https://leadflow.kurukin.com"]
}
```

### Lista blanca vigente

Hoy la whitelist efectiva observada en produccion es:

- `https://leadflow.kurukin.com`

No aparece:

- `https://retodetransformacion.com`
- `https://www.retodetransformacion.com`

### Por que el modal en retodetransformacion.com recibe `Failed to fetch`

Diagnostico principal:

1. El navegador envia un preflight `OPTIONS` a `https://api.leadflow.kurukin.com/v1/public/funnel-runtime/submissions` con `Origin: https://retodetransformacion.com`.
2. El API responde `204`, pero no incluye `Access-Control-Allow-Origin` para ese origin porque no esta en `corsAllowedOrigins`.
3. El navegador bloquea la respuesta por politica CORS.
4. `fetch()` no expone el detalle del rechazo y el frontend ve el error generico `TypeError: Failed to fetch`.

Diagnostico secundario posible:

1. Si el frontend apunta por error a `https://leadflow.kurukin.com/v1/...` en lugar de `https://api.leadflow.kurukin.com/v1/...`,
2. el request no golpea el backend Nest sino la app Next.js publica,
3. y hoy eso devuelve `400` al preflight y `404` al `POST`.

### Accion correctiva recomendada

Agregar como minimo estos origins al despliegue del API:

- `https://retodetransformacion.com`
- `https://www.retodetransformacion.com`
- mantener `https://leadflow.kurukin.com`

Y confirmar que `NEXT_PUBLIC_API_URL` del frontend publico apunte a:

- `https://api.leadflow.kurukin.com`

## 4. Contrato de respuesta del submit exitoso

Fuente: `apps/api/src/modules/public-funnel-runtime/lead-capture-assignment.service.ts`

```ts
type SubmitLeadCaptureResponse = {
  visitor: {
    id: string;
    anonymousId: string;
  };
  lead: {
    id: string;
    fullName: string | null;
    email: string | null;
    phone: string | null;
    companyName: string | null;
    status: string;
  };
  assignment: {
    id: string;
    status: string;
    reason: string;
    assignedAt: string;
    sponsor: {
      id: string;
      displayName: string;
      email: string | null;
      phone: string | null;
    };
  } | null;
  nextStep: {
    id: string;
    slug: string;
    path: string;
    stepType: string;
  } | null;
  handoff: {
    mode: "thank_you_then_whatsapp" | "immediate_whatsapp" | null;
    channel: "whatsapp" | null;
    buttonLabel: string | null;
    autoRedirect: boolean;
    autoRedirectDelayMs: number | null;
    sponsor: {
      id: string;
      displayName: string;
      email: string | null;
      phone: string | null;
    } | null;
    whatsappPhone: string | null;
    whatsappMessage: string | null;
    whatsappUrl: string | null;
  };
  advisor: {
    name: string;
    phone: string | null;
    photoUrl: string | null;
    bio: string | null;
    whatsappUrl: string | null;
  } | null;
  assigned_advisor: {
    name: string;
    phone: string | null;
    photo_url: string | null;
    bio: string | null;
  } | null;
};
```

### Keys que el frontend puede esperar hoy

Compatibilidad moderna:

- `advisor.name`
- `advisor.phone`
- `advisor.photoUrl`
- `advisor.bio`
- `advisor.whatsappUrl`

Compatibilidad snake_case:

- `assigned_advisor.name`
- `assigned_advisor.phone`
- `assigned_advisor.photo_url`
- `assigned_advisor.bio`

Tambien util para la pantalla de confirmacion:

- `handoff.whatsappPhone`
- `handoff.whatsappMessage`
- `handoff.whatsappUrl`
- `nextStep.path`

### Limitaciones actuales del payload

- No existe un campo de foto del sponsor en la base de datos.
- Por eso `advisor.photoUrl` hoy sale `null`.
- `advisor.bio` hoy es texto hardcodeado: `Especialista en Protocolos de Recuperacion`.
- El telefono visible sale de `Sponsor.phone`.

## 5. Guia de operaciones de emergencia

### Estado actual de CRUD

Hoy la UI/API expone:

- `PATCH /v1/sponsors/:id` para pausar/activar sponsors
- `PATCH /v1/sponsors/me` para editar perfil del sponsor autenticado
- `PATCH /v1/rotation-pools/members/:memberId` para reordenar o activar/desactivar miembros
- `POST /v1/funnel-instances` y `PATCH /v1/funnel-instances/:id` para asignar `rotationPoolId`

Hoy no existe endpoint HTTP para:

- crear sponsors nuevos
- crear `rotationMember` nuevos
- crear pools nuevos desde la superficie team

Por eso, si la UI falla, la via de emergencia real es Prisma o SQL directo.

### Opcion A: Prisma script rapido

Desde `apps/api`:

```bash
pnpm prisma:generate
pnpm exec node
```

Dentro del REPL:

```js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const workspaceId = "WORKSPACE_ID";
const teamId = "TEAM_ID";
const rotationPoolId = "POOL_ID";

const sponsor = await prisma.sponsor.create({
  data: {
    workspaceId,
    teamId,
    displayName: "Nuevo Asesor",
    status: "active",
    email: "asesor@empresa.com",
    phone: "+59170000000",
    availabilityStatus: "available",
    routingWeight: 1,
    memberPortalEnabled: true
  }
});

const lastMember = await prisma.rotationMember.findFirst({
  where: { rotationPoolId },
  orderBy: { position: "desc" }
});

await prisma.rotationMember.create({
  data: {
    rotationPoolId,
    sponsorId: sponsor.id,
    position: (lastMember?.position ?? 0) + 1,
    weight: 1,
    isActive: true
  }
});
```

Si el funnel todavia no apunta a ese pool:

```js
await prisma.funnelInstance.update({
  where: { id: "FUNNEL_INSTANCE_ID" },
  data: { rotationPoolId }
});
```

Opcional para mantener el fallback legacy alineado:

```js
await prisma.funnel.update({
  where: { id: "LEGACY_FUNNEL_ID" },
  data: { defaultRotationPoolId: rotationPoolId }
});
```

### Opcion B: SQL directo en PostgreSQL

```sql
INSERT INTO "Sponsor" (
  "id",
  "workspaceId",
  "teamId",
  "displayName",
  "status",
  "email",
  "phone",
  "availabilityStatus",
  "routingWeight",
  "memberPortalEnabled",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid()::text,
  'WORKSPACE_ID',
  'TEAM_ID',
  'Nuevo Asesor',
  'active',
  'asesor@empresa.com',
  '+59170000000',
  'available',
  1,
  true,
  now(),
  now()
);
```

```sql
INSERT INTO "RotationMember" (
  "id",
  "rotationPoolId",
  "sponsorId",
  "position",
  "weight",
  "isActive",
  "createdAt",
  "updatedAt"
)
VALUES (
  gen_random_uuid()::text,
  'POOL_ID',
  'SPONSOR_ID',
  (
    SELECT COALESCE(MAX("position"), 0) + 1
    FROM "RotationMember"
    WHERE "rotationPoolId" = 'POOL_ID'
  ),
  1,
  true,
  now(),
  now()
);
```

Si el funnel instance no tiene pool:

```sql
UPDATE "FunnelInstance"
SET "rotationPoolId" = 'POOL_ID',
    "updatedAt" = now()
WHERE "id" = 'FUNNEL_INSTANCE_ID';
```

Fallback legacy opcional:

```sql
UPDATE "Funnel"
SET "defaultRotationPoolId" = 'POOL_ID',
    "updatedAt" = now()
WHERE "id" = 'LEGACY_FUNNEL_ID';
```

### Checklist de validacion post-operacion

1. Confirmar que el sponsor quedo `active` y `available`.
2. Confirmar que existe registro en `RotationMember` con `isActive = true`.
3. Confirmar que el funnel instance apunta al `rotationPoolId` correcto.
4. Hacer `GET /health` y verificar CORS antes de probar desde dominio externo.
5. Ejecutar un `POST /v1/public/funnel-runtime/submissions` real y revisar que vuelva `assignment.sponsor` y `advisor`.
