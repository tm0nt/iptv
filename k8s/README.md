# Kubernetes

Manifestos pensados para `k3s` em uma VPS Debian.

Importante:

- Com **uma VPS so**, o Kubernetes melhora reinicio automatico, rollout e organizacao.
- Ele **nao entrega HA real de infraestrutura** se a maquina cair.
- Para alta disponibilidade de verdade, o proximo passo e:
  - `3` nos `k3s`, ou
  - app em `k3s` + banco gerenciado + segunda zona/regiao

## O que existe aqui

- `namespace.yaml`
- `configmap.yaml`
- `secret.example.yaml`
- `clusterissuer.yaml`
- `postgres.yaml`
- `app.yaml`
- `ingress.yaml`
- `networkpolicy.yaml`
- `pdb.yaml`

## Premissas

- dominio `grilotv.online`
- `k3s` com `traefik`
- `cert-manager` instalado
- classe de storage `local-path`

## 1. Instalar k3s

```bash
curl -sfL https://get.k3s.io | sh -
sudo kubectl get nodes
```

## 2. Instalar cert-manager

Use a release atual do projeto oficial:

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
kubectl wait --for=condition=Available deployment -n cert-manager cert-manager --timeout=180s
kubectl wait --for=condition=Available deployment -n cert-manager cert-manager-webhook --timeout=180s
kubectl wait --for=condition=Available deployment -n cert-manager cert-manager-cainjector --timeout=180s
```

## 3. Construir a imagem da app para o k3s local

Como esta arquitetura e pensada para uma VPS unica, o caminho mais simples e:

```bash
docker build -t grilotv/iptv-app:local .
docker save grilotv/iptv-app:local | sudo k3s ctr images import -
```

## 4. Criar o secret real

Copie o exemplo e troque os valores:

```bash
cp k8s/secret.example.yaml k8s/secret.yaml
```

O arquivo `secret.example.yaml` e so modelo e **nao** entra no `kustomization`.

Depois:

- troque `NEXTAUTH_SECRET`
- troque `POSTGRES_PASSWORD`
- troque `DATABASE_URL`
- troque `SEED_ADMIN_EMAIL`
- troque `SEED_ADMIN_PASSWORD`
- preencha os tokens de gateway se quiser seedar isso ja no bootstrap

## 5. Ajustar o issuer

Em [clusterissuer.yaml](/home/montenegro/Documentos/iptv-system/k8s/clusterissuer.yaml) troque o email ACME se necessario.

## 6. Aplicar manifests

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -k k8s
```

## 7. Verificar

```bash
kubectl get pods -n grilotv
kubectl get svc -n grilotv
kubectl get ingress -n grilotv
kubectl logs -n grilotv deploy/grilotv-app
kubectl logs -n grilotv statefulset/grilotv-postgres
```

## Observacoes importantes do projeto

### App em 1 replica

O projeto hoje grava arquivos em:

- `/app/public/uploads`
- `/app/public/logos`

Por isso, nesta base Kubernetes a app fica em `1 replica`.

Se voce quiser `2+ replicas` sem inconsistencias:

1. mover uploads/logos para S3, MinIO ou storage compartilhado `RWX`
2. tirar `migrate/seed` do startup da app e passar para `Job` separado
3. so depois escalar horizontalmente

### Banco

O Postgres aqui e `StatefulSet` simples para VPS unica.

Para producao mais forte:

- use backup recorrente
- monitore disco e memoria
- pense em banco gerenciado se quiser reduzir risco operacional

## Atualizar deploy

```bash
git pull
docker build -t grilotv/iptv-app:local .
docker save grilotv/iptv-app:local | sudo k3s ctr images import -
kubectl rollout restart deployment/grilotv-app -n grilotv
kubectl rollout status deployment/grilotv-app -n grilotv
```
