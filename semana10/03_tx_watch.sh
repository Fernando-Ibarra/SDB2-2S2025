#!/usr/bin/env bash
set -euo pipefail

# Reset de stock
docker compose exec -T redis redis-cli MSET stock:itemA 5

docker compose exec -T redis sh -lc 'redis-cli << "EOF"
WATCH stock:itemA
MULTI
DECRBY stock:itemA 3
EXEC
GET stock:itemA
EOF'