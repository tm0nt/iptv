# Docker Deploy

Stack de producao para o projeto:

- `db`: PostgreSQL 16
- `app`: Next.js + Prisma + seed de producao
- `caddy`: proxy reverso com HTTPS automatico para `grilotv.online`
- `watchtower`: auto-update dos containers marcados
- `deploy-docker.sh`: deploy automatizado sem K3s

## Antes de subir

1. Aponte os DNS `A` de `grilotv.online` e `www.grilotv.online` para o IP da VPS.
2. Garanta que as portas `80` e `443` estejam livres.
3. Se o aaPanel estiver ocupando `80/443` com Nginx/Apache, desative esse site/proxy antes de subir o stack.
4. Se a VPS ainda estiver com `k3s`/Traefik rodando, desligue antes de subir o stack Docker:

```bash
sudo systemctl disable --now k3s
sudo /usr/local/bin/k3s-killall.sh || true
```

## Variaveis

O stack usa [`/.env.docker`](/home/montenegro/Documentos/iptv-system/.env.docker).

Troque pelo menos:

- `NEXTAUTH_SECRET`
- `POSTGRES_PASSWORD`
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `SEED_MP_ACCESS_TOKEN` ou `SEED_EXPFY_*` se for seedar gateway
- `ACME_EMAIL`

## Subida

```bash
docker compose up -d --build
```

Ou use o script de deploy:

```bash
./ops/deploy-docker.sh
```

## Ver logs

```bash
docker compose logs -f
docker compose logs -f app
docker compose logs -f caddy
docker compose logs -f db
```

## Watchtower

O `watchtower` sobe junto no stack.

Por seguranca:

- `caddy` esta habilitado para auto-update
- `db` esta desabilitado por padrao
- `app` esta desabilitado por padrao porque a imagem e buildada localmente

Intervalo padrao:

- `WATCHTOWER_POLL_INTERVAL=300`

Se no futuro voce publicar a imagem da app em registry, da para habilitar update automatico da app tambem.

## Backup

Script pronto:

```bash
chmod +x docker/backup/backup.sh
./docker/backup/backup.sh
```

Arquivos gerados em:

- `./backups/<timestamp>/postgres.dump`
- `./backups/<timestamp>/postgres-globals.sql`
- `./backups/<timestamp>/caddy-data.tar.gz`
- `./backups/<timestamp>/caddy-config.tar.gz`
- `./backups/<timestamp>/app-uploads.tar.gz`
- `./backups/<timestamp>/app-logos.tar.gz`

## Atualizar deploy

```bash
git pull
docker compose up -d --build
```

Ou:

```bash
./ops/deploy-docker.sh
```

## Auto deploy com GitHub Actions

Workflow:

- [.github/workflows/deploy-docker.yml](/home/montenegro/Documentos/iptv-system/.github/workflows/deploy-docker.yml)

Guia:

- [AUTO-DEPLOY.md](/home/montenegro/Documentos/iptv-system/ops/AUTO-DEPLOY.md)

## Parar

```bash
docker compose down
```

## Remover tudo, incluindo banco e certificados

```bash
docker compose down -v
```
