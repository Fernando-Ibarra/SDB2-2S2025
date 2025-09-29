#!/usr/bin/env bash
set -euo pipefail

stanza="${1:-}"

COMPOSE_CMD="docker compose"
if ! docker compose version &>/dev/null; then
  if command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
  else
    echo "No se encontró docker compose" >&2
    exit 1
  fi
fi

function describe() {
  local target="$1"
  ${COMPOSE_CMD} exec -T "${target}" bash -lc "su - postgres -c 'pgbackrest --stanza=${target} info'"
}

if [[ -z "${stanza}" ]]; then
  describe master1
  describe master2
else
  case "${stanza}" in
    master1|master2)
      describe "${stanza}"
      ;;
    *)
      echo "Stanza inválida: ${stanza}" >&2
      exit 1
      ;;
  esac
fi
