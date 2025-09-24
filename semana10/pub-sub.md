# Ejemplo

## Terminal A

```bash
docker compose exec redis redis-cli SUBSCRIBE news.sport news.tech
```

## Terminal B

```bash
docker compose exec -T redis redis-cli PUBLISH news.sport "Gol de Guatemala 1-0"
docker compose exec -T redis redis-cli PUBLISH news.tech  "Nueva version de Redis 7.x"
```
