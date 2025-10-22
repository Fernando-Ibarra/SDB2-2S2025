# Corto 3

A las 03:14 AM, todos los servicios AWS se apagan.
Un mensaje aparece en la consola de administración:

> “El caos es la única base de datos perfecta.” — Dr. NullPointer

El equipo CloudForce42 (ustedes) recibe acceso a cuatro bases con rastros del ataque. Cada sala contiene una pista

## Intro

1. Ejecutar el comando `docker-compose up -d`

## SALA 1 – PostgreSQL: “Los registros del sabotaje”

Se recuperó un backup parcial del sistema de auditoría.

1. Acceder a pgAdmin en `http://localhost:8080` con las credenciales:
   - Usuario: `admin@bases2.com`
   - Contraseña: `admin`

2. Agregar un nuevo servidor

3. Crear las tablas y cargar los datos:

```sql
CREATE TABLE auditoria (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(50),
    servicio VARCHAR(50),
    accion VARCHAR(50),
    fecha TIMESTAMP,
    ip VARCHAR(20)
);

INSERT INTO auditoria (usuario, servicio, accion, fecha, ip) VALUES
('root', 'EC2', 'ssh_connect', '2025-10-18 02:11:00', '192.168.0.1'),
('admin', 'S3', 'delete_bucket', '2025-10-18 02:12:30', '10.0.0.4'),
('nullp', 'RDS', 'drop_table', '2025-10-18 02:14:02', '10.0.0.99'),
('guest', 'EC2', 'view_logs', '2025-10-18 02:14:03', '172.16.0.2'),
('nul1p', 'IAM', 'list_users', '2025-10-18 02:15:00', '10.0.0.100');
```

6. Realizar las consultas solicitadas en la parte 1 del corto.

Nota: Al finalizar esta sección deberian de obtener el nombre del atacante.

## SALA 2 – MongoDB: “Los metadatos del caos”

Los metadatos del monitoreo se guardaban como documentos:

1. Acceder a MongoDB Compass en `http://localhost:27017` con las credenciales:
   - Usuario: `admin`
   - Contraseña: `admin`

2. Cargar los datos en una colección llamada `logs` dentro de una base de datos llamada `corto3`.

```json
[
  {"servicio": "Lambda", "region": "us-east-1", "errores": 12},
  {"servicio": "EC2", "region": "us-west-2", "errores": 5},
  {"servicio": "S3", "region": "us-east-1", "errores": 0},
  {"servicio": "RDS", "region": "us-west-1", "errores": 7},
  {"servicio": "IAM", "region": "us-east-1", "errores": 9}
]

```

3. Realizar las consultas solicitadas en la parte 2 del corto.

Pd: En este momento ya tienen el nombre y región del atacante.

## SALA 3 – Redis: “El almacén efímero”

Tokens de sesión de los usuarios capturados:

1. Ejecutar el siguiente comando en la terminal para conectarte a Redis:

```bash
docker compose exec redis redis-cli
```

2. Cargar los siguientes datos:

```sql
SET session:root abc123
EXPIRE session:root 60
SET session:nullp xyz999
SET session:guest jkl111
SAVE
```

3. Realizar las consultas solicitadas en la parte 3 del corto.

Pd: En este momento ya tienen el token de sesión del atacante.

## SALA 4 – Neo4j: “El grafo de conexiones”

Red de accesos detectada:

1. Acceder a Neo4j en `http://localhost:7474` y dar click en "Connect".

2. Cargar los siguientes datos:

```sql
CREATE (a:Usuario {nombre:'root'}),
       (b:Usuario {nombre:'nullp'}),
       (c:Servidor {nombre:'EC2'}),
       (d:Servidor {nombre:'RDS'}),
       (b)-[:ACCESO]->(d),
       (a)-[:ACCESO]->(c),
       (b)-[:COMPARTIO_IP]->(a);
```

3. Realizar las consultas solicitadas en la parte 4 del corto.
