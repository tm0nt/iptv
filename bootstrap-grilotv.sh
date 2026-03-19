#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
K8S_DIR="$ROOT_DIR/k8s"
HARDEN_DIR="$ROOT_DIR/ops/debian-hardening"
SECRETS_FILE="${BOOTSTRAP_SECRETS_FILE:-$ROOT_DIR/.grilotv-bootstrap.secrets.env}"

DRY_RUN="false"
KEEP_RENDERED="false"
RENDER_DIR=""

usage() {
  cat <<'EOF'
Uso:
  ./bootstrap-grilotv.sh [--dry-run] [--render-dir DIR] [--keep-rendered]

Variaveis de ambiente mais uteis:
  DOMAIN=grilotv.online
  ACME_EMAIL=admin@grilotv.online
  DEPLOY_USER=deployer
  SSH_PORT=22
  ALLOW_K3S_API_CIDR=1.2.3.4/32
  IMAGE_REPO=grilotv/iptv-app
  IMAGE_TAG=local
  POSTGRES_DB=iptv
  POSTGRES_USER=grilotv
  SEED_ADMIN_EMAIL=admin@grilotv.online
  SEED_ADMIN_NAME=Administrador
  SEED_PAYMENT_GATEWAY_PROVIDER=mercadopago
  SEED_PAYMENT_GATEWAY_ENABLED=mercadopago
  SEED_MP_ACCESS_TOKEN=
  SEED_EXPFY_PUBLIC_KEY=
  SEED_EXPFY_SECRET_KEY=

Exemplos:
  ./bootstrap-grilotv.sh --dry-run
  DOMAIN=grilotv.online ACME_EMAIL=admin@grilotv.online ./bootstrap-grilotv.sh
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN="true"
      KEEP_RENDERED="true"
      ;;
    --keep-rendered)
      KEEP_RENDERED="true"
      ;;
    --render-dir)
      shift
      [[ $# -gt 0 ]] || { echo "Faltou valor para --render-dir" >&2; exit 1; }
      RENDER_DIR="$1"
      KEEP_RENDERED="true"
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

warn() {
  printf '[%s] AVISO: %s\n' "$(timestamp)" "$*" >&2
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

random_alnum() {
  local length="${1:-32}"
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 128 | tr -dc 'A-Za-z0-9' | head -c "$length"
  else
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$length"
  fi
}

if [[ -f "$SECRETS_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$SECRETS_FILE"
fi

DOMAIN="${DOMAIN:-grilotv.online}"
WWW_DOMAIN="${WWW_DOMAIN:-www.${DOMAIN#www.}}"
ACME_EMAIL="${ACME_EMAIL:-admin@${DOMAIN}}"
DEPLOY_USER="${DEPLOY_USER:-deployer}"
SSH_PORT="${SSH_PORT:-22}"
ALLOW_K3S_API_CIDR="${ALLOW_K3S_API_CIDR:-}"
NAMESPACE="${NAMESPACE:-grilotv}"
APP_DOMAIN="${APP_DOMAIN:-$DOMAIN}"
POSTGRES_DB="${POSTGRES_DB:-iptv}"
POSTGRES_USER="${POSTGRES_USER:-grilotv}"
DEFAULT_IMAGE_TAG="$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
IMAGE_REPO="${IMAGE_REPO:-grilotv/iptv-app}"
IMAGE_TAG="${IMAGE_TAG:-$DEFAULT_IMAGE_TAG}"
IMAGE="${IMAGE:-${IMAGE_REPO}:${IMAGE_TAG}}"

NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-$(random_alnum 64)}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-$(random_alnum 32)}"
SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-$(random_alnum 20)}"
SEED_MP_ACCESS_TOKEN="${SEED_MP_ACCESS_TOKEN:-}"
SEED_EXPFY_PUBLIC_KEY="${SEED_EXPFY_PUBLIC_KEY:-}"
SEED_EXPFY_SECRET_KEY="${SEED_EXPFY_SECRET_KEY:-}"

DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@grilotv-postgres:5432/${POSTGRES_DB}?schema=public}"
SEED_ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@${DOMAIN}}"
SEED_ADMIN_NAME="${SEED_ADMIN_NAME:-Administrador}"
SEED_SITE_NAME="${SEED_SITE_NAME:-IPTV}"
SEED_SITE_SHORT_NAME="${SEED_SITE_SHORT_NAME:-IPTV}"
SEED_SITE_LOGO_URL="${SEED_SITE_LOGO_URL:-/logo-dark.png}"
SEED_SITE_LOGO_DARK_URL="${SEED_SITE_LOGO_DARK_URL:-/logo-dark.png}"
SEED_SITE_LOGO_LIGHT_URL="${SEED_SITE_LOGO_LIGHT_URL:-/logo-white.png}"
SEED_PRIMARY_COLOR="${SEED_PRIMARY_COLOR:-#73de90}"
SEED_SUPPORT_EMAIL="${SEED_SUPPORT_EMAIL:-suporte@${DOMAIN}}"
SEED_SUPPORT_WHATSAPP="${SEED_SUPPORT_WHATSAPP:-}"
SEED_PIX_KEY="${SEED_PIX_KEY:-$SEED_SUPPORT_EMAIL}"
SEED_PAYMENT_GATEWAY_PROVIDER="${SEED_PAYMENT_GATEWAY_PROVIDER:-mercadopago}"
SEED_PAYMENT_GATEWAY_MODE="${SEED_PAYMENT_GATEWAY_MODE:-single}"
SEED_PAYMENT_GATEWAY_ENABLED="${SEED_PAYMENT_GATEWAY_ENABLED:-mercadopago}"
SEED_DEFAULT_COMMISSION="${SEED_DEFAULT_COMMISSION:-0.20}"
SEED_TRIAL_DAYS="${SEED_TRIAL_DAYS:-7}"
SEED_AUDIT_RETENTION_DAYS="${SEED_AUDIT_RETENTION_DAYS:-90}"

persist_secrets() {
  umask 077
  cat >"$SECRETS_FILE" <<EOF
NEXTAUTH_SECRET="$NEXTAUTH_SECRET"
POSTGRES_PASSWORD="$POSTGRES_PASSWORD"
SEED_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD"
SEED_MP_ACCESS_TOKEN="$SEED_MP_ACCESS_TOKEN"
SEED_EXPFY_PUBLIC_KEY="$SEED_EXPFY_PUBLIC_KEY"
SEED_EXPFY_SECRET_KEY="$SEED_EXPFY_SECRET_KEY"
EOF
  chmod 600 "$SECRETS_FILE"
}

kube() {
  if command -v kubectl >/dev/null 2>&1; then
    kubectl "$@"
  else
    k3s kubectl "$@"
  fi
}

run_kube() {
  log "+ kubectl $*"
  if [[ "$DRY_RUN" == "false" ]]; then
    kube "$@"
  fi
}

prepare_render_dir() {
  if [[ -n "$RENDER_DIR" ]]; then
    mkdir -p "$RENDER_DIR"
  else
    RENDER_DIR="$(mktemp -d /tmp/grilotv-bootstrap.XXXXXX)"
  fi

  cp "$K8S_DIR/namespace.yaml" "$RENDER_DIR/namespace.yaml"
  cp "$K8S_DIR/postgres.yaml" "$RENDER_DIR/postgres.yaml"
  cp "$K8S_DIR/networkpolicy.yaml" "$RENDER_DIR/networkpolicy.yaml"
  cp "$K8S_DIR/pdb.yaml" "$RENDER_DIR/pdb.yaml"
  cp "$K8S_DIR/app.yaml" "$RENDER_DIR/app.yaml"
  sed -i "s|image: grilotv/iptv-app:local|image: ${IMAGE}|g" "$RENDER_DIR/app.yaml"

  cat >"$RENDER_DIR/configmap.yaml" <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: grilotv-config
data:
  APP_DOMAIN: "$APP_DOMAIN"
  NODE_ENV: "production"
  PORT: "3000"
  NEXTAUTH_URL: "https://$DOMAIN"
  POSTGRES_HOST: "grilotv-postgres"
  POSTGRES_PORT: "5432"
  POSTGRES_DB: "$POSTGRES_DB"
  POSTGRES_USER: "$POSTGRES_USER"
  RUN_SEED_ON_BOOT: "true"
  SEED_MODE: "production"
  SEED_ADMIN_NAME: "$SEED_ADMIN_NAME"
  SEED_SITE_NAME: "$SEED_SITE_NAME"
  SEED_SITE_SHORT_NAME: "$SEED_SITE_SHORT_NAME"
  SEED_SITE_LOGO_URL: "$SEED_SITE_LOGO_URL"
  SEED_SITE_LOGO_DARK_URL: "$SEED_SITE_LOGO_DARK_URL"
  SEED_SITE_LOGO_LIGHT_URL: "$SEED_SITE_LOGO_LIGHT_URL"
  SEED_PRIMARY_COLOR: "$SEED_PRIMARY_COLOR"
  SEED_SUPPORT_EMAIL: "$SEED_SUPPORT_EMAIL"
  SEED_SUPPORT_WHATSAPP: "$SEED_SUPPORT_WHATSAPP"
  SEED_PIX_KEY: "$SEED_PIX_KEY"
  SEED_PAYMENT_GATEWAY_PROVIDER: "$SEED_PAYMENT_GATEWAY_PROVIDER"
  SEED_PAYMENT_GATEWAY_MODE: "$SEED_PAYMENT_GATEWAY_MODE"
  SEED_PAYMENT_GATEWAY_ENABLED: "$SEED_PAYMENT_GATEWAY_ENABLED"
  SEED_DEFAULT_COMMISSION: "$SEED_DEFAULT_COMMISSION"
  SEED_TRIAL_DAYS: "$SEED_TRIAL_DAYS"
  SEED_AUDIT_RETENTION_DAYS: "$SEED_AUDIT_RETENTION_DAYS"
EOF

  cat >"$RENDER_DIR/secret.yaml" <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: grilotv-secrets
type: Opaque
stringData:
  NEXTAUTH_SECRET: "$NEXTAUTH_SECRET"
  POSTGRES_PASSWORD: "$POSTGRES_PASSWORD"
  DATABASE_URL: "$DATABASE_URL"
  SEED_ADMIN_EMAIL: "$SEED_ADMIN_EMAIL"
  SEED_ADMIN_PASSWORD: "$SEED_ADMIN_PASSWORD"
  SEED_MP_ACCESS_TOKEN: "$SEED_MP_ACCESS_TOKEN"
  SEED_EXPFY_PUBLIC_KEY: "$SEED_EXPFY_PUBLIC_KEY"
  SEED_EXPFY_SECRET_KEY: "$SEED_EXPFY_SECRET_KEY"
EOF

  cat >"$RENDER_DIR/clusterissuer.yaml" <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    email: $ACME_EMAIL
    server: https://acme-v02.api.letsencrypt.org/directory
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
      - http01:
          ingress:
            class: traefik
EOF

  cat >"$RENDER_DIR/ingress.yaml" <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: grilotv
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: traefik
  tls:
    - hosts:
        - $DOMAIN
        - $WWW_DOMAIN
      secretName: grilotv-online-tls
  rules:
    - host: $DOMAIN
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: grilotv-app
                port:
                  number: 80
    - host: $WWW_DOMAIN
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: grilotv-app
                port:
                  number: 80
EOF

  cat >"$RENDER_DIR/kustomization.yaml" <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: $NAMESPACE
resources:
  - configmap.yaml
  - secret.yaml
  - clusterissuer.yaml
  - postgres.yaml
  - app.yaml
  - ingress.yaml
  - networkpolicy.yaml
  - pdb.yaml
EOF
}

cleanup() {
  if [[ "$KEEP_RENDERED" == "false" && -n "${RENDER_DIR:-}" && -d "$RENDER_DIR" ]]; then
    rm -rf "$RENDER_DIR"
  fi
}

trap cleanup EXIT

require_root_if_needed() {
  if [[ "$DRY_RUN" == "false" && "$(id -u)" -ne 0 ]]; then
    die "Execute como root ou com sudo para aplicar o bootstrap real."
  fi
}

preflight() {
  [[ -d "$K8S_DIR" ]] || die "Diretorio k8s nao encontrado."
  [[ -d "$HARDEN_DIR" ]] || die "Diretorio de hardening nao encontrado."
  require_cmd sed
  require_cmd cp
  if [[ "$DRY_RUN" == "false" ]]; then
    require_cmd curl
    require_cmd docker
    require_cmd apt-get
    require_cmd systemctl
    require_cmd sshd
  fi
}

install_os_packages() {
  run_shell "DEBIAN_FRONTEND=noninteractive apt-get update"
  run_shell "DEBIAN_FRONTEND=noninteractive apt-get install -y curl ca-certificates gnupg ufw fail2ban unattended-upgrades apt-listchanges apparmor apparmor-utils auditd jq"
}

configure_ssh() {
  local auth_keys="/home/${DEPLOY_USER}/.ssh/authorized_keys"
  if [[ "$DRY_RUN" == "false" && ! -f "$auth_keys" ]]; then
    die "Nao encontrei $auth_keys. Configure a chave SSH do usuario ${DEPLOY_USER} antes de endurecer o SSH."
  fi

  run_cmd install -d -m 755 /etc/ssh/sshd_config.d
  if [[ "$DRY_RUN" == "false" ]]; then
    sed "s/^AllowUsers .*/AllowUsers ${DEPLOY_USER}/" \
      "$HARDEN_DIR/sshd_config.d/99-grilotv.conf" \
      >/etc/ssh/sshd_config.d/99-grilotv.conf
  else
    log "+ render /etc/ssh/sshd_config.d/99-grilotv.conf com AllowUsers ${DEPLOY_USER}"
  fi
  run_cmd sshd -t
  run_cmd systemctl restart ssh
}

configure_firewall() {
  run_cmd ufw default deny incoming
  run_cmd ufw default allow outgoing
  run_cmd ufw allow "${SSH_PORT}/tcp"
  run_cmd ufw allow 80/tcp
  run_cmd ufw allow 443/tcp
  if [[ -n "$ALLOW_K3S_API_CIDR" ]]; then
    run_cmd ufw allow from "$ALLOW_K3S_API_CIDR" to any port 6443 proto tcp
  else
    warn "ALLOW_K3S_API_CIDR nao definido; a porta 6443 ficara fechada externamente."
  fi
  run_cmd ufw --force enable
  run_cmd ufw status verbose
}

configure_fail2ban() {
  run_cmd install -d -m 755 /etc/fail2ban/jail.d
  run_cmd cp "$HARDEN_DIR/fail2ban/jail.d/sshd.local" /etc/fail2ban/jail.d/sshd.local
  run_cmd systemctl enable --now fail2ban
  run_cmd systemctl restart fail2ban
}

configure_unattended_upgrades() {
  if [[ "$DRY_RUN" == "false" ]]; then
    cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
  else
    log "+ render /etc/apt/apt.conf.d/20auto-upgrades"
  fi
  run_cmd systemctl enable --now unattended-upgrades
}

configure_sysctl() {
  run_cmd cp "$HARDEN_DIR/sysctl.d/99-grilotv.conf" /etc/sysctl.d/99-grilotv.conf
  run_cmd sysctl --system
}

install_k3s() {
  if [[ "$DRY_RUN" == "false" ]] && command -v k3s >/dev/null 2>&1; then
    log "k3s ja instalado, seguindo em frente."
  else
    run_shell "curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC='server --write-kubeconfig-mode 600' sh -"
  fi

  if [[ "$DRY_RUN" == "false" ]]; then
    export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
  else
    log "+ export KUBECONFIG=/etc/rancher/k3s/k3s.yaml"
  fi

  run_cmd systemctl enable --now k3s
  run_kube wait --for=condition=Ready node --all --timeout=300s

  run_cmd install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.kube"
  run_cmd cp /etc/rancher/k3s/k3s.yaml "/home/$DEPLOY_USER/.kube/config"
  run_cmd chown "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.kube/config"
  run_cmd chmod 600 "/home/$DEPLOY_USER/.kube/config"
}

install_cert_manager() {
  run_shell "kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml"
  run_kube wait --for=condition=Available deployment -n cert-manager cert-manager --timeout=300s
  run_kube wait --for=condition=Available deployment -n cert-manager cert-manager-webhook --timeout=300s
  run_kube wait --for=condition=Available deployment -n cert-manager cert-manager-cainjector --timeout=300s
}

build_and_import_image() {
  run_cmd docker build -t "$IMAGE" "$ROOT_DIR"
  run_shell "docker save '$IMAGE' | k3s ctr images import -"
}

apply_manifests() {
  run_kube apply -f "$RENDER_DIR/namespace.yaml"
  run_kube apply -k "$RENDER_DIR"
  run_kube rollout status statefulset/grilotv-postgres -n "$NAMESPACE" --timeout=600s
  run_kube rollout status deployment/grilotv-app -n "$NAMESPACE" --timeout=900s
  run_kube get pods,svc,ingress -n "$NAMESPACE"
}

main() {
  require_root_if_needed
  preflight

  if [[ "$DRY_RUN" == "false" ]]; then
    persist_secrets
  fi

  prepare_render_dir

  log "Render dos manifests pronto em: $RENDER_DIR"

  install_os_packages
  configure_ssh
  configure_firewall
  configure_fail2ban
  configure_unattended_upgrades
  configure_sysctl
  install_k3s
  install_cert_manager
  build_and_import_image
  apply_manifests

  log "Bootstrap concluido."
  if [[ "$DRY_RUN" == "true" ]]; then
    log "Dry-run finalizado sem alterar o sistema."
  else
    log "Acesse: https://$DOMAIN"
    log "Kubeconfig local do usuario ${DEPLOY_USER}: /home/${DEPLOY_USER}/.kube/config"
    log "Segredos persistidos em: $SECRETS_FILE"
  fi
}

main "$@"
