#!/usr/bin/env bash
# Gera as imagens (linux/amd64, que é o que o Azure Container Apps roda) e publica no Docker Hub.
# Uso (dentro de moviehub-bff/infra):  DOCKERHUB_USER=seu-usuario ./docker-push.sh
# Antes: docker login
set -euo pipefail
: "${DOCKERHUB_USER:?defina DOCKERHUB_USER}"
TAG="${TAG:-latest}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

for repo in moviehub-ms-filmes moviehub-ms-avaliacoes moviehub-bff; do
  echo ">> $repo"
  docker buildx build --platform linux/amd64 -t "$DOCKERHUB_USER/$repo:$TAG" --push "$ROOT/$repo"
done
echo "Imagens publicadas em https://hub.docker.com/u/$DOCKERHUB_USER"
