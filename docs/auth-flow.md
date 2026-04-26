# Auth flow

## Recuperacion de contrasena

Leadflow resuelve la recuperacion de contrasena desde la web con server actions de Next.js, Prisma y el paquete compartido `@leadflow/mail`.

### Solicitud

1. El usuario abre `/auth/forgot-password` y envia su email.
2. `requestPasswordReset()` normaliza el email a minusculas.
3. Si el usuario existe, la web genera un token opaco con `randomBytes(32).toString("hex")`.
4. El token nunca se guarda en claro. Se guarda `sha256(token)` en `User.resetToken` junto con `User.resetTokenExpires`.
5. El TTL operativo es `PASSWORD_RESET_TOKEN_TTL_MS`, actualmente 1 hora.
6. La respuesta de UI es generica aunque el email no exista, para evitar enumeracion de usuarios.

### Envio por AWS SES

El email sale por `sendPasswordResetEmail()` en `apps/web/lib/mail.ts`, que delega en `sendAuthEmail()` de `@leadflow/mail`.

`@leadflow/mail` usa el SDK oficial `@aws-sdk/client-ses` y requiere:

- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN` opcional
- `MAIL_FROM_NAME`
- `MAIL_FROM_ADDRESS`
- `MAIL_REPLY_TO_ADDRESS`

Si SES o `MAIL_FROM_ADDRESS` no estan configurados, el cliente registra un warning y omite el envio para no romper flujos locales.

### Validacion y cambio

1. El enlace enviado apunta a `/auth/reset-password?token=<token-en-claro>`.
2. `isPasswordResetTokenValid()` vuelve a calcular `sha256(token)` y busca un usuario con `resetToken` vigente.
3. `resetPasswordAction()` valida token, longitud minima de password y confirmacion.
4. La nueva contrasena se guarda con `scrypt` y sal aleatoria.
5. Al completar el cambio, `resetToken` y `resetTokenExpires` se limpian para que el enlace no pueda reutilizarse.

### Archivos relevantes

- `apps/web/app/login/actions.ts`
- `apps/web/lib/password-reset.ts`
- `apps/web/lib/mail.ts`
- `packages/shared/mail/src/index.ts`
- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260425203000_user_password_reset_tokens/migration.sql`
