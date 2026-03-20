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

should_run_seed() {
  case "${RUN_SEED_ON_BOOT:-auto}" in
    true|TRUE|1|yes|YES)
      return 0
      ;;
    false|FALSE|0|no|NO)
      return 1
      ;;
    auto|AUTO|'')
      node <<'EOF'
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

;(async () => {
  try {
    const [plansCount, adminCount, systemConfigCount] = await Promise.all([
      prisma.plan.count().catch(() => 0),
      prisma.user.count({ where: { role: 'ADMIN' } }).catch(() => 0),
      prisma.systemConfig.count().catch(() => 0),
    ])

    process.exit(plansCount === 0 || adminCount === 0 || systemConfigCount === 0 ? 0 : 1)
  } catch (error) {
    console.error('[app] Seed auto-check failed, running seed as fallback.', error)
    process.exit(0)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
})()
EOF
      ;;
    *)
      return 1
      ;;
  esac
}

if should_run_seed; then
  echo "[app] Running production seed..."
  SEED_MODE="${SEED_MODE:-production}" npm run db:seed
else
  echo "[app] Seed skipped on boot."
fi

echo "[app] Starting Next.js on 0.0.0.0:${APP_PORT}..."
exec npm run start -- --hostname 0.0.0.0 --port "${APP_PORT}"
