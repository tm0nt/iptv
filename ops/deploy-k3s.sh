#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="${REPO_DIR:-$ROOT_DIR}"
BRANCH="${BRANCH:-main}"
NAMESPACE="${NAMESPACE:-grilotv}"
IMAGE_REPO="${IMAGE_REPO:-grilotv/iptv-app}"
FORCE_SYNC="${FORCE_SYNC:-false}"
SKIP_GIT="${SKIP_GIT:-false}"
DRY_RUN="false"

usage() {
  cat <<'EOF'
Uso:
  ./ops/deploy-k3s.sh [--dry-run] [--skip-git] [--force-sync] [--branch main]

Variaveis uteis:
  REPO_DIR=/home/deployer/iptv
  BRANCH=main
  NAMESPACE=grilotv
  IMAGE_REPO=grilotv/iptv-app
  FORCE_SYNC=true

Exemplos:
  ./ops/deploy-k3s.sh
  ./ops/deploy-k3s.sh --dry-run
  FORCE_SYNC=true ./ops/deploy-k3s.sh
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

on_err() {
  die "Falha na linha $1"
}

trap 'on_err $LINENO' ERR

run_cmd() {
  log "+ $*"
  if [[ "$DRY_RUN" == "false" ]]; then
    "$@"
  fi
}

run_shell() {
  log "+ $*"
  if [[ "$DRY_RUN" == "false" ]]; then
    bash -lc "$*"
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

run_privileged() {
  if [[ -n "$SUDO" ]]; then
    run_shell "$SUDO $*"
  else
    run_shell "$*"
  fi
}

kube_cmd() {
  if [[ "$DRY_RUN" == "true" ]]; then
    if [[ -x /usr/local/bin/k3s ]]; then
      printf '/usr/local/bin/k3s kubectl'
    elif command -v kubectl >/dev/null 2>&1; then
      printf 'kubectl'
    else
      printf 'kubectl'
    fi
    return
  fi

  if [[ -x /usr/local/bin/k3s ]]; then
    if [[ -n "$SUDO" ]]; then
      printf '%s /usr/local/bin/k3s kubectl' "$SUDO"
    else
      printf '/usr/local/bin/k3s kubectl'
    fi
  elif command -v kubectl >/dev/null 2>&1; then
    printf 'kubectl'
  else
    die "Nao encontrei kubectl nem k3s."
  fi
}

preflight() {
  [[ -d "$REPO_DIR/.git" ]] || die "Repositorio Git nao encontrado em $REPO_DIR"
  require_cmd git
  require_cmd docker

  if [[ "$DRY_RUN" == "true" || "$(id -u)" -eq 0 ]]; then
    return
  fi

  command -v sudo >/dev/null 2>&1 || die "sudo e necessario para o deploy automatico."
  sudo -n /usr/bin/docker ps >/dev/null 2>&1 || die "O usuario atual precisa de sudo sem senha para docker. Instale /etc/sudoers.d/grilotv-deployer antes de rodar o deploy."
  sudo -n /usr/local/bin/k3s kubectl get nodes >/dev/null 2>&1 || die "O usuario atual precisa de sudo sem senha para k3s. Instale /etc/sudoers.d/grilotv-deployer antes de rodar o deploy."
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

build_and_import_image() {
  cd "$REPO_DIR"
  local image_tag
  image_tag="$(git rev-parse --short HEAD)"
  local image="${IMAGE_REPO}:${image_tag}"
  export DEPLOY_IMAGE="$image"

  if [[ -n "$SUDO" ]]; then
    run_shell "$SUDO /usr/bin/docker build -t '$image' '$REPO_DIR'"
    run_shell "$SUDO /usr/bin/docker save '$image' | $SUDO /usr/local/bin/k3s ctr images import -"
  else
    run_cmd docker build -t "$image" "$REPO_DIR"
    run_shell "docker save '$image' | /usr/local/bin/k3s ctr images import -"
  fi
}

apply_manifests() {
  local kube
  kube="$(kube_cmd)"

  cd "$REPO_DIR"
  run_shell "$kube apply -f k8s/networkpolicy.yaml"
  run_shell "$kube apply -f k8s/ingress.yaml"
  run_shell "$kube apply -f k8s/pdb.yaml"
  run_shell "$kube apply -f k8s/app.yaml"
  run_shell "$kube set image deployment/grilotv-app app='$DEPLOY_IMAGE' -n '$NAMESPACE'"
  run_shell "$kube rollout status deployment/grilotv-app -n '$NAMESPACE' --timeout=900s"
  run_shell "$kube get pods,svc,endpoints,ingress -n '$NAMESPACE'"
}

main() {
  preflight
  sync_repo
  build_and_import_image
  apply_manifests
  log "Deploy concluido com a imagem $DEPLOY_IMAGE"
}

main "$@"
