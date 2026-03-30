# Technical SaaS Architecture

## Objetivo

Este documento explica el flujo de punta a punta del onboarding de dominios en Leadflow usando Cloudflare for SaaS, el bridge DNS del proyecto y la lógica del frontend que expone los desafíos de validación al usuario final.

La meta operativa es simple:

- el cliente apunta su dominio al bridge del SaaS
- Cloudflare termina TLS del hostname del cliente
- Cloudflare reenvía el tráfico a un origin fijo de Leadflow
- Leadflow resuelve el contenido por `host + path` sin crear routers dedicados por dominio cliente

## 1. Arquitectura del Bridge

### Hostnames fijos del SaaS

- `customers.leadflow.kurukin.com`
  - es el `CNAME target` público que Leadflow entrega a los clientes
  - funciona como bridge estable entre el DNS del cliente y el edge de Cloudflare
  - evita exponer directamente la IP del origin real a terceros
- `proxy-fallback.leadflow.kurukin.com`
  - es el `fallback origin` fijo configurado en Cloudflare como `custom_origin_server`
  - es el único hostname que el origin necesita servir de forma consistente
  - desacopla el origin de los dominios cliente individuales

### Por qué el bridge protege la IP del origen

El cliente nunca recibe la IP del runtime como instrucción principal. En el flujo sano:

1. El cliente crea un `CNAME` o un `ALIAS/flattening` hacia `customers.leadflow.kurukin.com`.
2. Cloudflare resuelve ese bridge y presenta el certificado del dominio del cliente.
3. Cloudflare reenvía el tráfico al `fallback origin` fijo `proxy-fallback.leadflow.kurukin.com`.
4. Traefik recibe el tráfico por el router catch-all y Leadflow resuelve la publicación por `host + path`.

Eso permite:

- ocultar la IP del origin detrás de Cloudflare
- evitar que el cliente configure la IP del VPS manualmente
- cambiar el runtime interno sin pedir un recableado DNS a cada cliente

### Apex y CNAME Flattening

Un `custom_apex` no puede usar un CNAME clásico en la mayoría de proveedores DNS. Por eso el bridge para apex depende de:

- `CNAME Flattening`
- `ALIAS`
- o una capacidad equivalente del DNS del cliente

La idea es que el apex del cliente siga apuntando lógicamente a `customers.leadflow.kurukin.com`, pero sin exponer la IP real del origin. El flattening deja que el proveedor DNS resuelva el target públicamente sin obligar al cliente a operar con registros A duros hacia el VPS.

## 2. Configuración de Cloudflare

### Zona base

Leadflow opera sobre la zona:

- `kurukin.com`

Los hosts relevantes del SaaS viven bajo:

- `leadflow.kurukin.com`
- `api.leadflow.kurukin.com`
- `customers.leadflow.kurukin.com`
- `proxy-fallback.leadflow.kurukin.com`

### Modo SSL

Modo esperado en este contexto:

- `Full`

Razón práctica:

- Cloudflare debe poder terminar TLS del hostname del cliente en el edge
- el origin de Leadflow responde siempre por el hostname fijo del fallback
- el flujo SaaS no debe depender de que el origin tenga certificados emitidos para cada dominio cliente

Nota operativa:

- si la cuenta o la zona se endurecen con `Full (strict)`, el origin debe mantener certificados válidos para los hostnames fijos del SaaS, especialmente `proxy-fallback.leadflow.kurukin.com`
- un desalineamiento aquí suele reaparecer como `526`

### Fallback Origin

El `fallback origin` correcto es:

- `proxy-fallback.leadflow.kurukin.com`

Es importante porque:

- Cloudflare lo usa como `custom_origin_server` en el custom hostname
- el origin TLS solo necesita cubrir ese hostname fijo
- evita configuraciones heredadas donde un dominio cliente o un host antiguo terminan apuntando al origin equivocado

Si este valor queda mal:

- el custom hostname puede existir pero seguir en estado incoherente
- el tráfico puede terminar en un origin que no sirve el runtime correcto
- aparecen estados `legacy`, `recreate required` o errores de SSL

### Permisos mínimos del token

Para operar de forma completa sin bloqueos de scope, el token debe tener al menos:

- `DNS:Edit`
- `Zone:Edit`
- `SSL:Edit`

En la práctica también son útiles los permisos de lectura equivalentes porque el runtime:

- consulta `custom_hostnames`
- consulta `dns_records`
- inspecciona el estado de SSL y sus desafíos

Sin esos permisos aparecen fallos como:

- `403` al leer o escribir `dns_records`
- imposibilidad de refrescar o corregir el estado del onboarding
- incapacidad de validar si el bridge `customers.leadflow.kurukin.com` está sano

## 3. Ciclo de Vida del Dominio

## Estados principales

Leadflow trabaja con cuatro estados operativos relevantes:

- `pending_dns`
- `pending_validation`
- `active`
- `error`

Además, el registro puede marcarse como:

- `legacy`
- `recreate required`

cuando el target DNS o el `custom_origin_server` no coinciden con el patrón SaaS actual.

### `custom_subdomain`

Caso recomendado.

Flujo:

1. El team registra, por ejemplo, `promo.cliente.com`.
2. Leadflow crea o actualiza el custom hostname en Cloudflare.
3. Leadflow entrega un único target:
   - `customers.leadflow.kurukin.com`
4. El cliente crea un `CNAME` desde `promo.cliente.com` hacia ese target.
5. El team pulsa `Refresh`.
6. Cuando hostname y SSL quedan `active`, el dominio queda operativo.

Ventajas:

- más simple para el cliente
- menos fricción DNS
- menor probabilidad de conflicto con el apex

### `custom_apex`

Caso avanzado.

Flujo:

1. El team registra, por ejemplo, `retodetransformacion.com`.
2. Leadflow crea el custom hostname con método de validación `txt`.
3. Cloudflare devuelve el desafío en `ssl.validation_records`.
4. El frontend muestra al usuario los registros TXT o CNAME que debe crear.
5. Cloudflare detecta el desafío, emite el certificado y cambia el hostname a `active`.

Diferencia clave frente a `custom_subdomain`:

- `custom_subdomain` depende de un `CNAME` del cliente al bridge
- `custom_apex` suele requerir TXT para validación y flattening/ALIAS para el apuntado final

### Por qué aumentamos el timeout a `30000ms`

La integración original usaba un timeout corto para Cloudflare. En la práctica eso era insuficiente cuando:

- la API de Cloudflare tardaba más en devolver el snapshot del custom hostname
- el edge seguía procesando `ssl.validation_records`
- el runtime necesitaba consultar o refrescar estados justo durante la propagación

Subir `CLOUDFLARE_REQUEST_TIMEOUT_MS` a `30000ms` reduce falsos negativos operativos:

- evita tratar como error una operación que en realidad seguía en curso
- reduce reintentos innecesarios del usuario
- hace más estable el botón `Refresh` durante el onboarding del apex

## 4. Frontend UI Logic

### Fuente de verdad en el frontend

La UI de dominios consume `cloudflareStatusJson` y no depende solo de instrucciones prearmadas.

El componente relevante es:

- `apps/web/components/team-operations/team-domains-client.tsx`

### Cómo extrae los registros de validación

El parser del frontend es resiliente y contempla varias formas del payload:

- `ssl.validationRecords`
- `ssl.validation_records`
- `raw.ssl.validation_records`
- `raw.ssl.dcv_delegation_records`
- `ownershipVerification`

Eso permite tolerar diferencias entre:

- snapshot normalizado del backend
- payload `raw` devuelto por Cloudflare
- combinaciones parciales durante una transición de estado

### Qué renderiza la UI

Si el dominio está en `pending_validation`, la pantalla:

- construye una tabla de validación a partir de `cloudflareStatusJson`
- muestra tipo, host, value y status
- expone botones `Copy host` y `Copy value`

Eso reduce errores humanos porque el usuario no necesita reescribir manualmente:

- `_acme-challenge...`
- valores TXT largos
- targets CNAME de delegación

## 5. Runtime y resolución final

En Swarm, el patrón de routing es:

- router explícito para `leadflow.kurukin.com`
- router explícito para `api.leadflow.kurukin.com`
- router catch-all para tráfico público y dominios proxied

El runtime web no enumera dominios cliente en labels ni en YAML. El contenido se resuelve por:

- `host + path`

Esto permite:

- publicar muchos dominios sin crecer la configuración de Traefik
- recrear onboarding sin tocar el stack
- mantener una sola superficie pública del runtime

## 6. Troubleshooting

### Error `526`

En este contexto, `526` significa:

- Cloudflare sí llegó al origin
- pero no pudo validar correctamente el certificado TLS del origin

Causas típicas aquí:

- `proxy-fallback.leadflow.kurukin.com` no tiene un certificado sano en origen
- Cloudflare está operando con una exigencia más estricta que la cobertura real del origin
- el custom hostname quedó activo, pero el origin fijo del SaaS no está correctamente servido por Traefik

Qué revisar:

- certificado del origin para `proxy-fallback.leadflow.kurukin.com`
- conectividad TLS del host fijo del SaaS
- que el tráfico realmente esté entrando por el router público correcto

### Error `403`

En este contexto, `403` casi siempre significa:

- el token de Cloudflare existe
- pero no tiene scope suficiente para el endpoint consultado

Se observó de forma directa cuando:

- `GET /zones/{zone_id}/dns_records` respondía, pero el token no permitía editar
- o directamente la lectura devolvía autorización insuficiente

Qué revisar:

- que el token cargado en el entorno sea el nuevo y no uno persistido en el spec viejo del servicio
- que el servicio haya sido redeployado después de cambiar `.env`
- que el token tenga `DNS:Edit`, `Zone:Edit` y `SSL:Edit`

## 7. Resumen operativo

Patrón sano final:

- cliente apunta su dominio a `customers.leadflow.kurukin.com`
- Cloudflare termina TLS del dominio cliente
- Cloudflare reenvía a `proxy-fallback.leadflow.kurukin.com`
- Leadflow resuelve por `host + path`
- el frontend expone los desafíos desde `cloudflareStatusJson`
- el team usa `Refresh` hasta ver `active`

Ese patrón mantiene:

- IP del origin protegida
- configuración Swarm estable
- UI informativa para onboarding real
- troubleshooting reproducible cuando algo falla
