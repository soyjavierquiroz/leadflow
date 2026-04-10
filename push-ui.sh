#!/bin/bash
docker builder prune -a -f > /dev/null
docker build --no-cache -t leadflow-web:local -f apps/web/Dockerfile .
docker service update --image leadflow-web:local --force leadflow_web
