# README_INIT

## Propósito del proyecto
Construir un nuevo sistema SaaS para captación, asignación y automatización de leads, orientado a operación multicanal y orquestación de procesos con n8n + Evolution API, sin dependencias de WordPress.

## Stack objetivo preliminar
- Frontend: por definir (candidato: Next.js) en fase posterior.
- Backend API: por definir (candidato: NestJS) en fase posterior.
- Automatización: n8n.
- Integración de mensajería: Evolution API.
- Datos e infraestructura: por definir según requerimientos funcionales y de escalado.
- Despliegue: Docker / Swarm (alineado al entorno actual del servidor).

## Reglas de trabajo
- No generar todavía aplicación final ni código de producto.
- No crear aún proyectos Next.js/NestJS ni plantillas framework.
- Mantener estructura limpia, modular y preparada para crecimiento.
- Documentar decisiones antes de implementar componentes críticos.
- Evitar cambios fuera de `/opt/projects/leadflow` durante esta fase.
- No tocar stacks/servicios activos del servidor durante inventario.

## Estructura inicial propuesta
```text
/opt/projects/leadflow
├── apps/        # Aplicaciones desplegables (frontend, backend, workers)
├── packages/    # Librerías compartidas (tipos, utilidades, SDK interno)
├── infra/       # Infraestructura como código, compose/swarm, scripts ops
├── docs/        # Documentación técnica y operativa
└── README_INIT.md
```
