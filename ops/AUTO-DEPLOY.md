# Auto Deploy

Fluxo recomendado para este projeto:

- push em `main`
- GitHub Actions abre SSH na VPS
- a VPS roda [deploy-k3s.sh](/home/montenegro/Documentos/iptv-system/ops/deploy-k3s.sh)
- o script faz:
  - `git pull`
  - `docker build`
  - import da imagem no `k3s`
  - apply dos manifests operacionais
  - `rollout status`

## 1. Preparar o usuario `deployer`

Como o deploy precisa usar `docker` e `k3s`, deixe um sudo controlado para o usuario `deployer`:

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

- `VPS_HOST`: `155.117.45.112`
- `VPS_PORT`: `22`
- `VPS_USER`: `deployer`
- `VPS_SSH_KEY`: chave privada usada so para o deploy

## 4. Workflow

O workflow fica em:

- [.github/workflows/deploy-k3s.yml](/home/montenegro/Documentos/iptv-system/.github/workflows/deploy-k3s.yml)

Ele dispara em:

- push na `main`
- execucao manual

## 5. Testar manualmente na VPS

```bash
cd /home/deployer/iptv
./ops/deploy-k3s.sh --dry-run
./ops/deploy-k3s.sh
```

## Observacoes

- o script falha se encontrar alteracoes locais no repo
- se voce realmente quiser sobrescrever tudo na VPS:

```bash
FORCE_SYNC=true ./ops/deploy-k3s.sh
```

- isso usa `git reset --hard`, entao so use quando o clone da VPS for dedicado ao deploy
