# Traefik ACME Diagnosis v1

## Contexto
Diagnostico no destructivo para explicar por que `members.exitosos.com` (y `admin.exitosos.com`) siguen recibiendo `TRAEFIK DEFAULT CERT` aunque Leadflow ya tenga `tls=true` + `certresolver=le`.

Fecha de analisis: 2026-03-21 (UTC)

## 1) Traefik en Swarm
- Servicio Traefik detectado: `traefik_traefik`
- Configuracion ACME activa en Traefik:
  - `--certificatesresolvers.le.acme.storage=/letsencrypt/acme.json`
  - `--certificatesresolvers.le.acme.httpchallenge.entrypoint=web`
  - `--certificatesresolvers.le.acme.tlschallenge=true`
- Almacenamiento real:
  - volumen Docker: `certificados`
  - host path: `/var/lib/docker/volumes/certificados/_data/acme.json`

## 2) Routers efectivos de Leadflow (runtime)
Traefik ve correctamente los routers:
- `leadflow-site@docker` -> `Host(exitosos.com)` con `tls.certResolver=le` y domains main/sans.
- `leadflow-members@docker` -> `Host(members.exitosos.com)` con `tls.certResolver=le`.
- `leadflow-admin@docker` -> `Host(admin.exitosos.com)` con `tls.certResolver=le`.
- `leadflow-api@docker` -> `Host(api.exitosos.com)` con `tls.certResolver=le`.

Conclusion de routing: **Leadflow esta bien etiquetado en runtime**.

## 3) Evidencia en logs de Traefik
Errores concretos detectados para Leadflow:
- `Unable to obtain ACME certificate for domains "members.exitosos.com" ... Cannot negotiate ALPN protocol "acme-tls/1" for tls-alpn-01 challenge`
- `Unable to obtain ACME certificate for domains "admin.exitosos.com" ... Cannot negotiate ALPN protocol "acme-tls/1" for tls-alpn-01 challenge`
- `Unable to obtain ACME certificate for domains "exitosos.com,members.exitosos.com,admin.exitosos.com,api.exitosos.com" ... Cannot negotiate ALPN protocol "acme-tls/1"`
- Rate limit posterior:
  - `too many failed authorizations (5) for "members.exitosos.com"`

Interpretacion: Traefik intenta emitir por **TLS-ALPN challenge** y esa validacion falla en este entorno.

## 4) Estado real de certificados en acme.json
Para dominios Leadflow:
- `exitosos.com` -> certificado LE presente (CN=exitosos.com, SAN=exitosos.com)
- `api.exitosos.com` -> certificado LE presente (CN=api.exitosos.com, SAN=api.exitosos.com)
- `members.exitosos.com` -> **no existe** certificado en acme.json
- `admin.exitosos.com` -> **no existe** certificado en acme.json

Verificacion de certificado servido por origen (SNI a `104.236.36.75:443`):
- `exitosos.com` -> LE valido
- `api.exitosos.com` -> LE valido
- `members.exitosos.com` -> `TRAEFIK DEFAULT CERT`
- `admin.exitosos.com` -> `TRAEFIK DEFAULT CERT`

## 5) Causa exacta
La causa principal esta en **infra compartida Traefik**, no en labels de Leadflow:
1. Traefik esta intentando/seleccionando `tls-alpn-01` y falla (`Cannot negotiate ALPN protocol acme-tls/1`).
2. Al fallar repetidamente, LE aplica rate-limit de autorizaciones para `members.exitosos.com`.
3. Sin certificado emitido para `members/admin`, Traefik entrega `DEFAULT CERT` en esos hosts.

## 6) Donde aplicar la correccion
Correccion requerida: **Traefik/infra compartida**.

No se requiere cambio adicional en el stack Leadflow para este punto (ya publica `certresolver` y routers correctos).

### Opcion inmediata (recomendada para destrabar)
En el stack de Traefik:
- Quitar: `--certificatesresolvers.le.acme.tlschallenge=true`
- Mantener HTTP-01:
  - `--certificatesresolvers.le.acme.httpchallenge.entrypoint=web`

Luego:
1. Update stack Traefik.
2. Esperar fin de ventana de rate-limit de LE.
3. Reintentar update de stack Leadflow (o forzar redeploy del servicio web) para disparar nueva solicitud de cert.

### Opcion robusta (mediano plazo)
Migrar a `dnsChallenge` con Cloudflare (token API) para emitir wildcard y evitar dependencia de TLS-ALPN/HTTP challenge.

## 7) Impacto operativo para Javier
- Javier debe tocar **Traefik** (infra compartida) y luego validar Leadflow.
- No es un problema de app ni de routing interno de Leadflow.
