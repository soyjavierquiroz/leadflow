#!/usr/bin/env bash
set -euo pipefail

OWNER="${GHCR_OWNER:-soyjavierquiroz}"
TAG="${TAG:-latest}"
REGISTRY="ghcr.io"
WEB_IMAGE="${REGISTRY}/${OWNER}/leadflow-web:${TAG}"
API_IMAGE="${REGISTRY}/${OWNER}/leadflow-api:${TAG}"

if [[ "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Usage:
  GHCR_USERNAME=<user> GHCR_TOKEN=<token> TAG=<tag> infra/scripts/ghcr-publish.sh

Defaults:
  GHCR_OWNER=soyjavierquiroz
  TAG=latest

This script builds and pushes both images:
  ghcr.io/<owner>/leadflow-web:<tag>
  ghcr.io/<owner>/leadflow-api:<tag>
USAGE
  exit 0
fi

if [[ -z "${GHCR_USERNAME:-}" || -z "${GHCR_TOKEN:-}" ]]; then
  echo "ERROR: GHCR_USERNAME and GHCR_TOKEN are required." >&2
  exit 1
fi

echo "Logging into ${REGISTRY} as ${GHCR_USERNAME}..."
echo "${GHCR_TOKEN}" | docker login "${REGISTRY}" -u "${GHCR_USERNAME}" --password-stdin

echo "Building web image: ${WEB_IMAGE}"
docker build -f apps/web/Dockerfile -t "${WEB_IMAGE}" .

echo "Building api image: ${API_IMAGE}"
docker build -f apps/api/Dockerfile -t "${API_IMAGE}" .

echo "Pushing web image..."
docker push "${WEB_IMAGE}"

echo "Pushing api image..."
docker push "${API_IMAGE}"

echo "Done. Published:"
echo "  - ${WEB_IMAGE}"
echo "  - ${API_IMAGE}"
