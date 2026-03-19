#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "[backup] docker nao encontrado no PATH." >&2
  exit 1
fi

if [ ! -f ".env.docker" ]; then
  echo "[backup] arquivo .env.docker nao encontrado." >&2
  exit 1
fi

set -a
. ./.env.docker
set +a

: "${POSTGRES_DB:?POSTGRES_DB nao definido em .env.docker}"
: "${POSTGRES_USER:?POSTGRES_USER nao definido em .env.docker}"

TIMESTAMP="${1:-$(date +%Y%m%d-%H%M%S)}"
BACKUP_ROOT="${BACKUP_DIR:-$ROOT_DIR/backups}"
DEST_DIR="${BACKUP_ROOT}/${TIMESTAMP}"

mkdir -p "$DEST_DIR"

echo "[backup] salvando em ${DEST_DIR}"

if ! docker compose ps --services --filter status=running | grep -qx "db"; then
  echo "[backup] o servico db nao esta em execucao." >&2
  exit 1
fi

echo "[backup] exportando banco ${POSTGRES_DB}..."
TMP_DUMP="${DEST_DIR}/postgres.dump.tmp"
TMP_GLOBALS="${DEST_DIR}/postgres-globals.sql.tmp"

docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "${TMP_DUMP}"
mv "${TMP_DUMP}" "${DEST_DIR}/postgres.dump"

docker compose exec -T db pg_dumpall -U "$POSTGRES_USER" --globals-only > "${TMP_GLOBALS}"
mv "${TMP_GLOBALS}" "${DEST_DIR}/postgres-globals.sql"

backup_volume() {
  local volume_name="$1"
  local archive_name="$2"

  echo "[backup] compactando volume ${volume_name}..."
  docker run --rm \
    --security-opt label=disable \
    -v "${volume_name}:/source:ro" \
    -v "${DEST_DIR}:/backup:Z" \
    alpine:3.20 \
    sh -c "cd /source && tar czf /backup/${archive_name} ."
}

backup_volume "grilotv_caddy_data" "caddy-data.tar.gz"
backup_volume "grilotv_caddy_config" "caddy-config.tar.gz"
backup_volume "grilotv_app_uploads" "app-uploads.tar.gz"
backup_volume "grilotv_app_logos" "app-logos.tar.gz"

cat > "${DEST_DIR}/meta.txt" <<EOF
timestamp=${TIMESTAMP}
project_dir=${ROOT_DIR}
domain=${APP_DOMAIN:-grilotv.online}
postgres_db=${POSTGRES_DB}
postgres_user=${POSTGRES_USER}
EOF

echo "[backup] concluido com sucesso."
