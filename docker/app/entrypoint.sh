#!/bin/sh
set -eu

APP_PORT="${PORT:-3000}"
POSTGRES_HOST="${POSTGRES_HOST:-db}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-iptv}"
POSTGRES_USER="${POSTGRES_USER:-grilotv}"

mkdir -p /app/public/uploads/branding /app/public/logos

echo "[app] Waiting for PostgreSQL at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
  sleep 2
done

echo "[app] Generating Prisma client..."
npx prisma generate

echo "[app] Applying Prisma migrations..."
npx prisma migrate deploy

if [ "${RUN_SEED_ON_BOOT:-true}" = "true" ]; then
  echo "[app] Running production seed..."
  SEED_MODE="${SEED_MODE:-production}" npm run db:seed
fi

echo "[app] Starting Next.js on 0.0.0.0:${APP_PORT}..."
exec npm run start -- --hostname 0.0.0.0 --port "${APP_PORT}"
