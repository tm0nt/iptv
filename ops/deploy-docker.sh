#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="${REPO_DIR:-$ROOT_DIR}"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
ENV_FILE="${ENV_FILE:-.env.docker}"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-.env.docker.local}"
FORCE_SYNC="${FORCE_SYNC:-false}"
SKIP_GIT="${SKIP_GIT:-false}"
APP_DOMAIN="${APP_DOMAIN:-grilotv.online}"
DRY_RUN="false"
DIAGNOSTICS_RUNNING="false"
MERGED_ENV_FILE=""

usage() {
  cat <<'EOF'
Uso:
  ./ops/deploy-docker.sh [--dry-run] [--skip-git] [--force-sync] [--branch main]

Variaveis uteis:
  REPO_DIR=/home/deployer/iptv
  BRANCH=main
  COMPOSE_FILE=docker-compose.yml
  ENV_FILE=.env.docker
  LOCAL_ENV_FILE=.env.docker.local
  FORCE_SYNC=true

Exemplos:
  ./ops/deploy-docker.sh
  ./ops/deploy-docker.sh --dry-run
  FORCE_SYNC=true ./ops/deploy-docker.sh
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN="true"
      ;;
    --skip-git)
      SKIP_GIT="true"
      ;;
    --force-sync)
      FORCE_SYNC="true"
      ;;
    --branch)
      shift
      [[ $# -gt 0 ]] || { echo "Faltou valor para --branch" >&2; exit 1; }
      BRANCH="$1"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Argumento invalido: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

timestamp() {
  date +"%Y-%m-%d %H:%M:%S"
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*"
}

die() {
  printf '[%s] ERRO: %s\n' "$(timestamp)" "$*" >&2
  exit 1
}

run_cmd() {
  log "+ $*"
  if [[ "$DRY_RUN" == "false" ]]; then
    "$@"
  fi
}

run_shell() {
  log "+ $*"
  if [[ "$DRY_RUN" == "false" ]]; then
    bash -o pipefail -lc "$*"
  fi
}

cleanup() {
  if [[ -n "$MERGED_ENV_FILE" && -f "$MERGED_ENV_FILE" ]]; then
    rm -f "$MERGED_ENV_FILE"
  fi
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Comando obrigatorio ausente: $1"
}

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO=""
elif command -v sudo >/dev/null 2>&1; then
  SUDO="sudo -n"
else
  SUDO=""
fi

DOCKER_BIN="${DOCKER_BIN:-/usr/bin/docker}"

docker_cmd() {
  if [[ -n "$SUDO" ]]; then
    printf '%s %s' "$SUDO" "$DOCKER_BIN"
  else
    printf '%s' "$DOCKER_BIN"
  fi
}

compose_cmd() {
  local compose_env_file

  compose_env_file="${MERGED_ENV_FILE:-$REPO_DIR/$ENV_FILE}"
  printf '%s compose --env-file %q -f %q' "$(docker_cmd)" "$compose_env_file" "$COMPOSE_FILE"
}

dump_diagnostics() {
  local compose

  [[ "$DRY_RUN" == "false" ]] || return 0
  [[ "$DIAGNOSTICS_RUNNING" == "false" ]] || return 0
  DIAGNOSTICS_RUNNING="true"

  if [[ -n "$SUDO" ]]; then
    sudo -n "$DOCKER_BIN" ps >/dev/null 2>&1 || return 0
  fi

  compose="$(compose_cmd)"
  log "Coletando diagnostico do stack Docker..."
  run_shell "cd '$REPO_DIR' && $compose ps || true"
  run_shell "cd '$REPO_DIR' && $compose logs --tail=120 app caddy db || true"
}

on_err() {
  dump_diagnostics || true
  die "Falha na linha $1"
}

trap 'on_err $LINENO' ERR
trap cleanup EXIT

preflight() {
  [[ -d "$REPO_DIR/.git" ]] || die "Repositorio Git nao encontrado em $REPO_DIR"
  [[ -f "$REPO_DIR/$COMPOSE_FILE" ]] || die "Compose file nao encontrado em $REPO_DIR/$COMPOSE_FILE"
  [[ -f "$REPO_DIR/$ENV_FILE" ]] || die "Env file nao encontrado em $REPO_DIR/$ENV_FILE"
  require_cmd git
  require_cmd docker

  if [[ "$DRY_RUN" == "true" || "$(id -u)" -eq 0 ]]; then
    return
  fi

  command -v sudo >/dev/null 2>&1 || die "sudo e necessario para o deploy automatico."
  sudo -n "$DOCKER_BIN" ps >/dev/null 2>&1 || die "O usuario atual precisa de sudo sem senha para docker."
}

build_compose_env() {
  local base_env local_env

  base_env="$REPO_DIR/$ENV_FILE"
  local_env="$REPO_DIR/$LOCAL_ENV_FILE"
  MERGED_ENV_FILE="$(mktemp /tmp/grilotv-compose-env.XXXXXX)"

  cat "$base_env" > "$MERGED_ENV_FILE"

  if [[ -f "$local_env" ]]; then
    printf '\n' >> "$MERGED_ENV_FILE"
    cat "$local_env" >> "$MERGED_ENV_FILE"
  fi
}

sync_repo() {
  cd "$REPO_DIR"

  if [[ "$SKIP_GIT" == "true" ]]; then
    log "SKIP_GIT=true, pulando sincronizacao do repositorio."
    return
  fi

  run_cmd git fetch origin "$BRANCH" --prune

  if [[ "$FORCE_SYNC" == "true" ]]; then
    run_cmd git reset --hard "origin/$BRANCH"
    run_cmd git clean -fd
    return
  fi

  if ! git diff --quiet || ! git diff --cached --quiet; then
    die "Repositorio com alteracoes locais. Use FORCE_SYNC=true se quiser sobrescrever o estado local."
  fi

  run_cmd git checkout "$BRANCH"
  run_cmd git pull --ff-only origin "$BRANCH"
}

validate_compose() {
  local compose
  compose="$(compose_cmd)"
  run_shell "cd '$REPO_DIR' && $compose config -q"
}

deploy_stack() {
  local compose
  compose="$(compose_cmd)"

  run_shell "cd '$REPO_DIR' && $compose up -d --build --remove-orphans"
}

container_health() {
  local container_name="$1"
  local status

  status="$(bash -o pipefail -lc "$(docker_cmd) inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' '$container_name' 2>/dev/null || true")"
  printf '%s' "${status:-unknown}"
}

wait_for_container() {
  local container_name="$1"
  local timeout_seconds="$2"
  local started_at
  local status

  started_at="$(date +%s)"
  while true; do
    status="$(container_health "$container_name")"
    case "$status" in
      healthy|running)
        return 0
        ;;
      unhealthy|exited|dead)
        die "Container '$container_name' entrou em estado '$status'."
        ;;
    esac

    if (( $(date +%s) - started_at >= timeout_seconds )); then
      die "Timeout aguardando container '$container_name' ficar saudavel. Estado atual: '$status'."
    fi

    sleep 3
  done
}

verify_stack() {
  local compose
  compose="$(compose_cmd)"

  wait_for_container "grilotv-db" 180
  wait_for_container "grilotv-app" 300
  wait_for_container "grilotv-caddy" 120

  run_shell "cd '$REPO_DIR' && $compose ps"
  run_shell "$(docker_cmd) exec grilotv-app curl -fsS http://127.0.0.1:3000/api/health >/dev/null"

  # O deploy nao deve falhar so porque o Caddy ainda esta emitindo/renovando TLS.
  # Fazemos uma checagem opcional com SNI correto para dar visibilidade sem bloquear a entrega.
  run_shell "curl -kfsS --resolve '${APP_DOMAIN}:443:127.0.0.1' 'https://${APP_DOMAIN}/api/health' >/dev/null || true"
}

main() {
  preflight
  sync_repo
  build_compose_env
  validate_compose
  deploy_stack
  verify_stack
  log "Deploy Docker concluido com sucesso."
}

main "$@"
