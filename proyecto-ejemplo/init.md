# Proyecto ejemplo (master1/master2) - Parte 1

1. Entorno

```bash
docker compose up -d
```

2. backend

```bash  
cd backend
yarn 
yarn start:dev
```

3. Locust

```bash
cd ../locust
python -m venv venv
pip install -r requirements.txt
locust -f locustfile.py --config locust.conf
```

4. Apagar master1

```bash
docker stop master1
```

5. Encender master1

```bash   
docker start master1
```

# Proyecto ejemplo (backups) - Parte 2

1. Levantar el entorno

```bash
docker compose up -d
```

2. Preparar pgBackRest dentro de los contenedores

```bash
# El script instala pgBackRest (si no existe), crea los directorios de repositorio y ejecuta la verificación de la stanza.
./scripts/pgbackrest/bootstrap.sh
```

3. Ejecutar respaldaos manuales

```bash
# Full
./scripts/pgbackrest/run-backup.sh master1 full
./scripts/pgbackrest/run-backup.sh master2 full

# Incremental
./scripts/pgbackrest/run-backup.sh master1 incr
./scripts/pgbackrest/run-backup.sh master2 incr

# Diferencial
./scripts/pgbackrest/run-backup.sh master1 diff
./scripts/pgbackrest/run-backup.sh master2 diff

# Publicar resultado en Redis (servicio "redis" y claves pgbackrest:last:*)
./scripts/pgbackrest/run-backup.sh master1 full --publish-redis
```

4. Consultar el estado de los respaldos

```bash
./scripts/pgbackrest/show-info.sh            # ambos nodos
./scripts/pgbackrest/show-info.sh master1    # nodo específico
```

5. Los respaldos quedan montados en:

- proyecto-ejemplo/backups/master1
- proyecto-ejemplo/backups/master2

Notas:
- Los contenedores ya montan /etc/pgbackrest (solo lectura) con un pgbackrest.conf por nodo, y el repositorio en /var/lib/pgbackrest.
- Si actualizan credenciales o puertos, ajusta los archivos en proyecto-ejemplo/pgbackrest/master*/pgbackrest.conf.
