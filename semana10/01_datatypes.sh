#!/usr/bin/env bash
# Demo integral de tipos de datos de Redis con ejemplos mínimos por cada uno.
# Incluye: Strings, Hashes, Lists, Sets, Sorted Sets (ZSET), Bitmaps, HyperLogLog y Geo.
# Notas clave:
#  - MSET: establece múltiples pares clave-valor en una sola operación atómica por clave (si falla una no revierte las anteriores, pero todo se envía en un único comando). Equivalente a SET k1 v1, SET k2 v2, ... pero más eficiente.
#  - Muchos comandos aquí son idempotentes para re-ejecutar el script sin romper el entorno.

set -euo pipefail

CLI="docker compose exec -T redis redis-cli"

# ==========================
# STRINGS (clave → valor)
# ==========================
# Caso de uso típico: configuraciones, contadores, flags simples.
# SET: guarda un valor string en una clave.
# INCR: incrementa una clave numérica (crea con 0 si no existe).
# MSET: establece múltiples pares clave-valor en un solo comando (más eficiente que varios SET).

echo "== STRINGS =="
$CLI SET user:1:name "Ana"                  # guarda un string simple
$CLI INCR page:views                         # contador de visitas (page:views = page:views + 1)
$CLI MSET app:env "prod" app:version "1.0.0"  # MSET = multi-SET (varias claves en una llamada)
$CLI GET user:1:name
$CLI GET page:views
$CLI MGET app:env app:version                # MGET: obtiene múltiples claves en una llamada

# ==========================
# HASHES (documentos planos)
# ==========================
# Caso de uso: perfiles de usuario, objetos con campos.
# HSET: asigna campo→valor dentro de la clave hash.
# HINCRBY: incrementa numéricamente un campo específico.

echo "== HASHES =="
$CLI HSET user:2 name "Luis" email "luis@example.com" age 29  # varios campos de un usuario
$CLI HGETALL user:2                                           # recupera todo el documento
$CLI HINCRBY user:2 age 1                                     # incrementa la edad
$CLI HGET user:2 age

# ==========================
# LISTS (listas enlazadas)
# ==========================
# Caso de uso: colas FIFO/LIFO, logs sencillos.
# LPUSH/RPUSH: insertar por izquierda/derecha.
# LPOP/RPOP: extraer por izquierda/derecha.
# LRANGE 0 -1: listar todos los elementos.

echo "== LISTS =="
$CLI DEL queue:jobs                              # limpiamos la lista para un resultado predecible
$CLI LPUSH queue:jobs job-1 job-2 job-3          # inserta 3 trabajos al inicio (izquierda)
$CLI RPUSH queue:jobs job-4                      # inserta al final (derecha)
$CLI LRANGE queue:jobs 0 -1                      # muestra la cola completa
$CLI LPOP queue:jobs                             # saca por la izquierda
$CLI RPOP queue:jobs                             # saca por la derecha
$CLI LRANGE queue:jobs 0 -1

# ==========================
# SETS (conjuntos, sin duplicados)
# ==========================
# Caso de uso: etiquetas únicas, membresías, intersecciones/union (no mostrado aquí).
# SADD: agrega miembros; ignora duplicados.
# SISMEMBER: consulta pertenencia.
# SREM: elimina miembros.

echo "== SETS =="
$CLI SADD tags backend backend api redis devops  # "backend" duplicado se ignora
$CLI SMEMBERS tags                               # lista de miembros (sin orden garantizado)
$CLI SISMEMBER tags api                          # ¿"api" pertenece al set?
$CLI SREM tags backend                           # elimina un miembro
$CLI SMEMBERS tags

# ====================================
# SORTED SETS (ZSET: valor con score)
# ====================================
# Caso de uso: rankings, feeds ordenados por relevancia/tiempo.
# ZADD: agrega elemento con score (numérico de ordenación).
# ZINCRBY: ajusta el score.
# ZREVRANGE 0 -1 WITHSCORES: top-N descendente.

echo "== SORTED SETS (ZSET) =="
$CLI ZADD leaderboard 100 "ana" 250 "luis" 180 "maria"
$CLI ZINCRBY leaderboard 50 "ana"             # ana pasa a 150
$CLI ZREVRANGE leaderboard 0 -1 WITHSCORES     # ranking descendente con puntajes

# ==========================
# BITMAPS (bits dentro de un string)
# ==========================
# Caso de uso: flags de actividad por índice/usuario/día; conteos compactos.
# SETBIT key offset value: pone el bit en offset a 0/1.
# GETBIT key offset: lee el bit.
# BITCOUNT: cuenta bits en 1.

echo "== BITMAPS =="
$CLI SETBIT active_users 1 1
$CLI SETBIT active_users 42 1
$CLI BITCOUNT active_users
$CLI GETBIT active_users 42

# ==========================
# HYPERLOGLOG (cardinalidad aprox.)
# ==========================
# Caso de uso: estimar únicos (visitas) con memoria fija y error aceptable (~1%).
# PFADD: añade elementos observados.
# PFCOUNT: estima el número de distintos.

echo "== HYPERLOGLOG =="
$CLI PFADD visits u1 u2 u3 u1 u2  # duplicados no inflan significativamente el conteo
$CLI PFCOUNT visits
$CLI PFADD visits u4 u5 u6
$CLI PFCOUNT visits

# =====================================
# GEO (geoespacial: lon, lat, nombre)
# =====================================
# Caso de uso: tiendas cercanas, riders a X km, etc.
# GEOADD: añade puntos (longitud, latitud, miembro).
# GEODIST: distancia entre dos miembros (m, km, mi, ft).
# GEORADIUS: búsqueda por radio desde coord. (deprecado en favor de GEOSEARCH, pero útil para demo).
# GEOPOS: coordenadas de un miembro.

echo "== GEO (GEOSPATIAL) =="
$CLI GEOADD stores -90.5132 14.6349 "tienda_centro" -90.5525 14.5898 "tienda_sur" -90.5069 14.6520 "tienda_norte"
$CLI GEODIST stores tienda_centro tienda_sur km
$CLI GEORADIUS stores -90.52 14.63 5 km WITHDIST   # encuentra tiendas en 5 km del punto dado
$CLI GEOPOS stores tienda_norte