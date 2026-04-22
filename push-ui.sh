#!/bin/bash
TAG=$(date +%Y%m%d_%H%M%S)
echo "🚀 Iniciando despliegue blindado con TAG: $TAG..."

echo "📦 Construyendo API..."
docker build --no-cache -t leadflow-api:$TAG -t leadflow-api:latest -f apps/api/Dockerfile .
echo "🔄 Actualizando servicio API..."
docker service update --image leadflow-api:$TAG --with-registry-auth leadflow_api

echo "📦 Construyendo WEB..."
docker build --no-cache -t leadflow-web:$TAG -t leadflow-web:latest -f apps/web/Dockerfile .
echo "🔄 Actualizando servicio WEB..."
docker service update --image leadflow-web:$TAG --with-registry-auth leadflow_web

echo "🧹 Limpiando basura..."
docker image prune -f
echo "✅ ¡Despliegue finalizado! Cero días de la marmota."