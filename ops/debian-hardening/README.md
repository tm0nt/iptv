# Debian Hardening

Guia pratico para sua VPS Debian com usuario `deployer`.

Objetivo:

- deixar a VPS mais segura para a aplicacao IPTV
- preparar o host para `docker compose`
- reduzir superficie de ataque

## 1. Atualize o sistema

```bash
sudo apt update
sudo apt full-upgrade -y
sudo apt autoremove -y
sudo apt install -y curl ca-certificates gnupg ufw fail2ban unattended-upgrades apt-listchanges apparmor apparmor-utils auditd jq
```

## 2. Use chave SSH e bloqueie root

No seu computador:

```bash
ssh-copy-id deployer@SEU_IP
```

No servidor, crie um drop-in:

```bash
sudo mkdir -p /etc/ssh/sshd_config.d
sudo cp ops/debian-hardening/sshd_config.d/99-grilotv.conf /etc/ssh/sshd_config.d/99-grilotv.conf
sudo sshd -t
sudo systemctl restart ssh
```

Arquivo usado:

- [99-grilotv.conf](/home/montenegro/Documentos/iptv-system/ops/debian-hardening/sshd_config.d/99-grilotv.conf)

## 3. Ative firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

Depois:

```bash
sudo ufw enable
sudo ufw status verbose
```

## 4. Ative fail2ban

```bash
sudo mkdir -p /etc/fail2ban/jail.d
sudo cp ops/debian-hardening/fail2ban/jail.d/sshd.local /etc/fail2ban/jail.d/sshd.local
sudo systemctl enable --now fail2ban
sudo systemctl restart fail2ban
sudo fail2ban-client status sshd
```

Arquivo usado:

- [sshd.local](/home/montenegro/Documentos/iptv-system/ops/debian-hardening/fail2ban/jail.d/sshd.local)

## 5. Ative updates automaticos de seguranca

```bash
sudo dpkg-reconfigure --priority=low unattended-upgrades
sudo systemctl enable --now unattended-upgrades
```

## 6. Aplique hardening de kernel basico

```bash
sudo cp ops/debian-hardening/sysctl.d/99-grilotv.conf /etc/sysctl.d/99-grilotv.conf
sudo sysctl --system
```

Arquivo usado:

- [99-grilotv.conf](/home/montenegro/Documentos/iptv-system/ops/debian-hardening/sysctl.d/99-grilotv.conf)

## 7. Cuidados com Docker

- nao exponha o socket Docker em TCP
- nao coloque usuarios comuns no grupo `docker` sem necessidade
- se possivel, use `sudo docker ...` em vez de acesso permanente ao socket

## 8. Instale o Docker Engine e Compose Plugin

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo apt install -y docker-compose-plugin
sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
```

## 9. Restrinja o acesso do deploy ao Docker

- prefira sudoers restrito em vez de colocar `deployer` no grupo `docker`
- mantenha o socket Docker apenas local

Exemplo:

```bash
sudo cp ops/sudoers/grilotv-deployer /etc/sudoers.d/grilotv-deployer
sudo chmod 440 /etc/sudoers.d/grilotv-deployer
sudo visudo -cf /etc/sudoers.d/grilotv-deployer
```

## 10. Segredos e operacao

- nunca commite `secret.yaml`
- guarde senhas em cofre
- rode backup frequente do banco
- monitore uso de disco, RAM e CPU
- use alertas para expiracao de disco e falhas de container

## Checklist minimo

- `root` sem login SSH
- login por chave somente
- `ufw` ativo
- `fail2ban` ativo
- `unattended-upgrades` ativo
- Docker sem socket exposto em TCP
- backup funcionando
- segredos fora do Git
