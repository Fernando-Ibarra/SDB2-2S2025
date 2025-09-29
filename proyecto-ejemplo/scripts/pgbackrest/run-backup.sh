#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Uso: $0 <master1|master2> <full|incr|diff> [opciones]" >&2
  echo "Opciones:" >&2
  echo "  --publish-redis            Envía la salida de pgBackRest info (JSON) a Redis" >&2
  echo "  --redis-key-prefix <pref>  Prefijo de clave para Redis (default: pgbackrest)" >&2
  echo "  --redis-service <name>     Servicio de Redis en docker compose (default: redis)" >&2
  echo "  --redis-command <cmd>      Comando alterno (default: redis-cli)" >&2
  exit 1
fi

stanza="$1"
backup_type="$2"

case "${stanza}" in
  master1|master2) ;;
  *)
    echo "Stanza/descripción de contenedor inválida: ${stanza}" >&2
    exit 1
    ;;
esac

shift 2

publish_redis=0
redis_key_prefix="pgbackrest"
redis_service="redis"
redis_command="redis-cli"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --publish-redis)
      publish_redis=1
      shift
      ;;
    --redis-key-prefix)
      redis_key_prefix="$2"
      shift 2
      ;;
    --redis-service)
      redis_service="$2"
      shift 2
      ;;
    --redis-command)
      redis_command="$2"
      shift 2
      ;;
    *)
      echo "Opción desconocida: $1" >&2
      exit 1
      ;;
  esac
done

case "${backup_type}" in
  full|incr|diff) ;;
  *)
    echo "Tipo de backup inválido: ${backup_type}" >&2
    exit 1
    ;;
esac

COMPOSE_CMD="docker compose"
if ! docker compose version &>/dev/null; then
  if command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
  else
    echo "No se encontró docker compose" >&2
    exit 1
  fi
fi

${COMPOSE_CMD} exec -T "${stanza}" bash -lc "su - postgres -c 'pgbackrest --stanza=${stanza} --type=${backup_type} --archive-check=n backup'"

if [[ ${publish_redis} -eq 1 ]]; then
  redis_container_id="$(${COMPOSE_CMD} ps -q "${redis_service}" 2>/dev/null || true)"

  if [[ -z "${redis_container_id}" ]]; then
    echo "Advertencia: el servicio ${redis_service} no está en ejecución; se omite publicación en Redis" >&2
  else
    info_json="$(${COMPOSE_CMD} exec -T "${stanza}" bash -lc "su - postgres -c 'pgbackrest --stanza=${stanza} --output=json info'" | tr -d '\r')"

    if [[ -z "${info_json// }" ]]; then
      echo "Advertencia: no se pudo obtener la salida JSON de pgBackRest" >&2
      exit 1
    fi

    last_key="${redis_key_prefix}:last:${stanza}"
    history_key="${redis_key_prefix}:history:${stanza}"

    if ! printf '%s' "${info_json}" | ${COMPOSE_CMD} exec -T "${redis_service}" ${redis_command} -x set "${last_key}" >/dev/null; then
      echo "Error: no se pudo escribir en Redis (set ${last_key})" >&2
      exit 1
    fi

    if ! printf '%s' "${info_json}" | ${COMPOSE_CMD} exec -T "${redis_service}" ${redis_command} -x lpush "${history_key}" >/dev/null; then
      echo "Error: no se pudo escribir en Redis (lpush ${history_key})" >&2
      exit 1
    fi

    echo "Información de backup almacenada en Redis (keys: ${last_key}, ${history_key})"
  fi
fi
