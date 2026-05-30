#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Hard reset de caches locales de build"

while IFS= read -r cache_dir; do
  if [[ -n "${cache_dir}" && -d "${cache_dir}" ]]; then
    echo "Eliminando ${cache_dir}"
    rm -rf "${cache_dir}"
  fi
done < <(
  find "${ROOT_DIR}" \
    \( -name .next -o -name .turbo -o -path '*/node_modules/.cache' \) \
    -type d \
    | sort
)

echo "==> Limpieza completada"
echo "Siguiente paso sugerido:"
echo "docker build --no-cache --pull -t leadflow-web:<tag> -f apps/web/Dockerfile ."
echo "docker build --no-cache --pull -t leadflow-api:<tag> -f apps/api/Dockerfile ."
