#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="${REPO_DIR:-$ROOT_DIR}"
BRANCH="${BRANCH:-main}"
NAMESPACE="${NAMESPACE:-grilotv}"
IMAGE_REPO="${IMAGE_REPO:-grilotv/iptv-app}"
APP_DEPLOYMENT_NAME="${APP_DEPLOYMENT_NAME:-grilotv-app}"
DOCKER_BIN="${DOCKER_BIN:-/usr/bin/docker}"
K3S_BIN="${K3S_BIN:-/usr/local/bin/k3s}"
FORCE_SYNC="${FORCE_SYNC:-false}"
SKIP_GIT="${SKIP_GIT:-false}"
DRY_RUN="false"
DIAGNOSTICS_RUNNING="false"

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

dump_diagnostics() {
  local kube

  [[ "$DRY_RUN" == "false" ]] || return 0
  [[ "$DIAGNOSTICS_RUNNING" == "false" ]] || return 0
  DIAGNOSTICS_RUNNING="true"

  if [[ -n "$SUDO" ]]; then
    sudo -n "$DOCKER_BIN" ps >/dev/null 2>&1 || return 0
    sudo -n "$K3S_BIN" kubectl get nodes >/dev/null 2>&1 || return 0
  elif [[ ! -x "$K3S_BIN" ]]; then
    return 0
  fi

  kube="$(kube_cmd)"
  log "Coletando diagnostico do cluster..."
  run_shell "$kube get pods -n '$NAMESPACE' -o wide || true"
  run_shell "$kube get deploy,sts,svc,endpoints,ingress -n '$NAMESPACE' || true"
  run_shell "$kube describe deployment '$APP_DEPLOYMENT_NAME' -n '$NAMESPACE' || true"
  run_shell "$kube logs deployment/'$APP_DEPLOYMENT_NAME' -n '$NAMESPACE' --tail=120 || true"
  run_shell "$kube get events -n '$NAMESPACE' --sort-by=.metadata.creationTimestamp | tail -n 40 || true"
}

on_err() {
  dump_diagnostics || true
  die "Falha na linha $1"
}

trap 'on_err $LINENO' ERR

kube_cmd() {
  if [[ "$DRY_RUN" == "true" ]]; then
    if [[ -x "$K3S_BIN" ]]; then
      printf '%s kubectl' "$K3S_BIN"
    elif command -v kubectl >/dev/null 2>&1; then
      printf 'kubectl'
    else
      printf 'kubectl'
    fi
    return
  fi

  if [[ -x "$K3S_BIN" ]]; then
    if [[ -n "$SUDO" ]]; then
      printf '%s %s kubectl' "$SUDO" "$K3S_BIN"
    else
      printf '%s kubectl' "$K3S_BIN"
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
  [[ -x "$K3S_BIN" ]] || die "Binario do k3s nao encontrado em $K3S_BIN"

  if [[ "$DRY_RUN" == "true" || "$(id -u)" -eq 0 ]]; then
    return
  fi

  command -v sudo >/dev/null 2>&1 || die "sudo e necessario para o deploy automatico."
  sudo -n "$DOCKER_BIN" ps >/dev/null 2>&1 || die "O usuario atual precisa de sudo sem senha para docker. Instale /etc/sudoers.d/grilotv-deployer antes de rodar o deploy."
  sudo -n "$K3S_BIN" kubectl get nodes >/dev/null 2>&1 || die "O usuario atual precisa de sudo sem senha para k3s. Instale /etc/sudoers.d/grilotv-deployer antes de rodar o deploy."
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
    run_shell "$SUDO '$DOCKER_BIN' build -t '$image' '$REPO_DIR'"
    run_shell "$SUDO '$DOCKER_BIN' save '$image' | $SUDO '$K3S_BIN' ctr images import -"
  else
    run_cmd "$DOCKER_BIN" build -t "$image" "$REPO_DIR"
    run_shell "'$DOCKER_BIN' save '$image' | '$K3S_BIN' ctr images import -"
  fi
}

apply_manifests() {
  local kube
  kube="$(kube_cmd)"

  cd "$REPO_DIR"
  run_shell "$kube apply -f k8s/namespace.yaml"
  run_shell "$kube apply -f k8s/configmap.yaml"
  if [[ -f k8s/secret.yaml ]]; then
    run_shell "$kube apply -f k8s/secret.yaml"
  else
    log "k8s/secret.yaml ausente, mantendo secrets ja existentes no cluster."
  fi
  run_shell "$kube apply -f k8s/clusterissuer.yaml"
  run_shell "$kube apply -f k8s/postgres.yaml"
  run_shell "$kube apply -f k8s/networkpolicy.yaml"
  run_shell "$kube apply -f k8s/ingress.yaml"
  run_shell "$kube apply -f k8s/pdb.yaml"
  run_shell "$kube apply -f k8s/app.yaml"
  run_shell "$kube rollout status statefulset/grilotv-postgres -n '$NAMESPACE' --timeout=600s"
  run_shell "$kube set image deployment/'$APP_DEPLOYMENT_NAME' app='$DEPLOY_IMAGE' -n '$NAMESPACE'"
  run_shell "$kube rollout status deployment/'$APP_DEPLOYMENT_NAME' -n '$NAMESPACE' --timeout=900s"
  run_shell "$kube get pods,svc,endpoints,ingress,certificate -n '$NAMESPACE'"
}

main() {
  preflight
  sync_repo
  build_and_import_image
  apply_manifests
  log "Deploy concluido com a imagem $DEPLOY_IMAGE"
}

main "$@"
