# Comandos

1. Levantar los contenedores

```bash
docker-compose up -d
```

2. URI de MongoDB   

```bash
mongodb://admin:admin@localhost:27017
```

3. Crear la base de datos

```sql
-- Conecta a la BD "shop"
CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
  category_id INT NOT NULL REFERENCES categories(id),
  price NUMERIC(10,2) NOT NULL
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),
  order_date TIMESTAMP NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL
);

CREATE TABLE order_items (
  order_id INT NOT NULL REFERENCES orders(id),
  product_id INT NOT NULL REFERENCES products(id),
  quantity INT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  PRIMARY KEY (order_id, product_id)
);
```

4. Insertar Datos

```sql
INSERT INTO customers (name, email) VALUES
('Ana López', 'ana@example.com'),
('Carlos Pérez', 'carlos@example.com');

INSERT INTO categories (name) VALUES
('Electrónica'),
('Hogar');

INSERT INTO products (name, sku, category_id, price) VALUES
('Audífonos Bluetooth', 'AUD-100', 1, 450.00),
('Teclado Mecánico',   'TEC-200', 1, 650.00),
('Cafetera Compacta',  'CAF-300', 2, 520.00);

-- Orden 1: Ana
INSERT INTO orders (customer_id, order_date, status)
VALUES (1, '2025-09-30 10:00:00', 'PAID');  -- id = 1

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
(1, 1, 1, 450.00),  -- Audífonos
(1, 2, 2, 650.00);  -- Teclado

-- Orden 2: Carlos
INSERT INTO orders (customer_id, order_date, status)
VALUES (2, '2025-10-01 16:30:00', 'PENDING'); -- id = 2

INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
(2, 3, 1, 520.00);  -- Cafetera
```

5. Consultas

```sql
SELECT
  o.id AS order_id,
  o.order_date,
  c.name AS customer_name,
  c.email AS customer_email,
  p.name AS product_name,
  p.sku,
  cat.name AS category_name,
  oi.quantity,
  oi.unit_price,
  (oi.quantity * oi.unit_price) AS line_total
FROM orders o
INNER JOIN customers c   ON c.id = o.customer_id
INNER JOIN order_items oi ON oi.order_id = o.id
INNER JOIN products p     ON p.id = oi.product_id
INNER JOIN categories cat ON cat.id = p.category_id
ORDER BY o.id, p.id;

--------------

select
  o.id AS order_id,
  c.name AS customer_name,
  SUM(oi.quantity * oi.unit_price) AS order_total
FROM orders o
INNER JOIN customers c   ON c.id = o.customer_id
INNER JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id, c.name
ORDER BY o.id;
```

6. Generar datos para MongoDB

```bash
docker exec -i db-postgres psql -U admin -d bases2 -c "\copy (
SELECT jsonb_strip_nulls(
  jsonb_build_object(
    '_id',        o.id,
    'order_id',   o.id,
    'order_date', to_char(o.order_date AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
    'status',     o.status,
    'customer',   jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email),
    'items',      (
                    SELECT jsonb_agg(
                             jsonb_build_object(
                               'product_id', p.id,
                               'sku',        p.sku,
                               'name',       p.name,
                               'category',   cat.name,
                               'quantity',   oi.quantity,
                               'unit_price', oi.unit_price,
                               'line_total', (oi.quantity * oi.unit_price)
                             )
                           ORDER BY p.id)
                    FROM order_items oi
                    JOIN products p     ON p.id = oi.product_id
                    JOIN categories cat ON cat.id = p.category_id
                    WHERE oi.order_id = o.id
                  ),
    'order_total', (
                    SELECT SUM(oi.quantity * oi.unit_price)
                    FROM order_items oi
                    WHERE oi.order_id = o.id
                  )
  )
)
FROM orders o
JOIN customers c ON c.id = o.customer_id
ORDER BY o.id
) TO STDOUT" > orders.jsonl
```

7. Conectar a MongoDB e importar datos

```bash
docker exec -it db-mongo mongosh -u admin -p admin --authenticationDatabase admin
```

8. Consulas MongoDB

```js
use bases2;
db.orders.find().pretty();
db.orders.find({ "customer.name": "Ana López" }).pretty();
db.orders.find({ "items.category": "Electrónica" }).pretty();
db.orders.find({ "order_total": { $gt: 1000 } }).pretty();
db.orders.aggregate([
  { $unwind: "$items" },
  { $group: {
      _id: "$items.category",
      total_sales: { $sum: { $multiply: [ "$items.quantity", "$items.unit_price" ] } },
      total_orders: { $sum: 1 }
    }
  },
  { $sort: { total_sales: -1 } }
]).pretty();
```