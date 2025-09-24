#!/usr/bin/env bash
set -euo pipefail

# Inicializa saldos (puede correr en sesiones separadas)
docker compose exec -T redis redis-cli MSET account:alice 100 account:bob 50

# Transacción en UNA sesión (MULTI/EXEC + operaciones)
docker compose exec -T redis sh -lc 'redis-cli << "EOF"
MULTI
DECRBY account:alice 20
INCRBY account:bob 20
EXEC
MGET account:alice account:bob
EOF'