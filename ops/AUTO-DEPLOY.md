# Auto Deploy Docker

Fluxo recomendado agora:

- push em `main`
- GitHub Actions abre SSH na VPS
- a VPS sincroniza o clone com `origin/main`
- a VPS roda [deploy-docker.sh](/home/montenegro/Documentos/iptv-system/ops/deploy-docker.sh)
- o script faz:
  - validacao do `docker compose`
  - `docker compose up -d --build --remove-orphans`
  - espera `db`, `app` e `caddy`
  - valida a app diretamente pelo container
  - faz uma checagem opcional do HTTPS via Caddy

## 1. Preparar o usuario `deployer`

Como o deploy precisa usar `docker`, deixe um sudo controlado para o usuario `deployer`:

```bash
sudo cp ops/sudoers/grilotv-deployer /etc/sudoers.d/grilotv-deployer
sudo chmod 440 /etc/sudoers.d/grilotv-deployer
sudo visudo -cf /etc/sudoers.d/grilotv-deployer
```

## 2. Criar uma chave SSH so para deploy

Na VPS:

```bash
sudo -u deployer mkdir -p /home/deployer/.ssh
sudo -u deployer chmod 700 /home/deployer/.ssh
```

Depois adicione a chave publica do GitHub Actions em:

```bash
/home/deployer/.ssh/authorized_keys
```

## 3. Configurar os secrets no GitHub

No repositorio GitHub, crie estes `Actions secrets`:

- `VPS_HOST`
- `VPS_PORT`
- `VPS_USER`
- `VPS_SSH_KEY`

Valores esperados:

- `VPS_HOST`: IP da VPS
- `VPS_PORT`: `22`
- `VPS_USER`: `deployer`
- `VPS_SSH_KEY`: chave privada usada so para o deploy

## 4. Workflow

O workflow fica em:

- [.github/workflows/deploy-docker.yml](/home/montenegro/Documentos/iptv-system/.github/workflows/deploy-docker.yml)

Ele dispara em:

- push na `main`
- execucao manual

## 5. Configuracao local da VPS

Guarde os segredos locais em um arquivo nao versionado:

```bash
cp .env.docker.local.example .env.docker.local
```

Depois ajuste em `.env.docker.local` pelo menos:

- `NEXTAUTH_SECRET`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `SEED_ADMIN_PASSWORD`
- tokens de gateway

## 6. Testar manualmente na VPS

```bash
cd /home/deployer/iptv
./ops/deploy-docker.sh --dry-run
./ops/deploy-docker.sh
```

## Observacoes

- o clone da VPS deve ser dedicado ao deploy
- o workflow faz `git reset --hard origin/main` e `git clean -fd`
- `.env.docker.local` permanece preservado porque fica ignorado no Git
