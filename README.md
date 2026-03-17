# 📺 StreamBox Pro — IPTV System

Sistema IPTV completo com painel admin, revendedores, proxy seguro de stream e PWA.

---

## ⚡ Quick Start

```bash
# 1. Clone / extraia o projeto
cd iptv-system

# 2. Configure o banco de dados
cp .env.example .env
# Edite .env com sua DATABASE_URL PostgreSQL

# 3. Setup completo (instala deps, aplica schema, seed)
chmod +x setup.sh && ./setup.sh

# 4. Rode o servidor
npm run dev
```

Acesse: **http://localhost:3000**

---

## 🔐 Credenciais de Teste

| Perfil      | Email                       | Senha        | Rota         |
|-------------|-----------------------------|--------------|--------------|
| Admin       | admin@iptvbox.com           | admin123     | /admin       |
| Revendedor  | revendedor@iptvbox.com      | reseller123  | /revendedor  |
| Cliente     | cliente@iptvbox.com         | client123    | /watch       |

---

## 🏗️ Estrutura do Projeto

```
src/
├── app/
│   ├── (auth)/login/         # Tela de login
│   ├── (client)/
│   │   ├── watch/            # Catálogo Prime Video style
│   │   └── watch/[uuid]/     # Player de vídeo
│   ├── admin/                # Dashboard admin
│   │   ├── page.tsx          # Dashboard com MRR, churn, charts
│   │   ├── plans/            # Gestão de planos
│   │   ├── users/            # Gestão de usuários
│   │   └── resellers/        # Gestão de revendedores
│   ├── revendedor/           # Painel do revendedor
│   └── api/
│       ├── auth/             # NextAuth
│       ├── stream/[id]/      # Proxy HLS (segurança crítica)
│       ├── segment/[encoded] # Proxy de segmentos TS
│       ├── channels/         # Lista de canais (sem streamUrl)
│       ├── admin/            # APIs admin
│       ├── reseller/         # APIs revendedor
│       └── affiliate/[code]  # Rastreamento de afiliados
├── components/
│   ├── catalog/              # ClientNav, CatalogCarousel, HeroBanner
│   ├── player/               # VideoPlayer (HLS.js)
│   ├── admin/                # AdminSidebar, MetricCard
│   └── ui/                   # Toaster
├── lib/
│   ├── prisma.ts             # Prisma client singleton
│   ├── auth.ts               # NextAuth config
│   └── utils.ts              # Formatters, helpers
└── middleware.ts             # Proteção de rotas por role
```

---

## 🔒 Segurança — Proteção das URLs M3U8

O sistema possui 3 camadas de segurança para nunca expor a URL real do stream:

1. **Banco de dados**: `streamUrl` é armazenada, mas **nunca retornada pela API `/api/channels`**
2. **UUID público**: O frontend só conhece o `uuid` do canal (ex: `ch-globo-sp-fhd-0`)
3. **Proxy `/api/stream/[id]`**: Ao receber o UUID, o backend:
   - Verifica autenticação + assinatura ativa
   - Busca a URL real no banco
   - Busca o stream server-side e retorna os dados
   - Reescreve URLs internas do M3U8 para passarem também pelo proxy `/api/segment/[encoded]`

**Resultado**: A URL `http://site.poupadefrutas.shop` jamais chega ao browser do cliente.

---

## 📺 Adicionando Seus Canais M3U8

Edite `prisma/seed.ts` e substitua a constante `M3U8_SAMPLE` pelo conteúdo do seu arquivo `.m3u8` completo:

```typescript
const M3U8_SAMPLE = `#EXTM3U
#EXTINF:-1 tvg-id="..." group-title="GRUPO",Nome do Canal
http://seu-servidor.com/user/pass/12345
...
`
```

Depois rode:
```bash
npx prisma db push
npm run db:seed
```

---

## 💰 Sistema de Revendedores

- Admin cria revendedores em `/admin/users` (role = RESELLER)
- Cada revendedor recebe um `referralCode` único
- Link de afiliado: `https://seusite.com/api/affiliate/CODIGO`
- Cliques são rastreados na tabela `affiliate_clicks`
- Revendedor gerencia seus clientes em `/revendedor`
- Comissões são calculadas sobre MRR dos clientes ativos

---

## 📱 PWA — Instalar como App

O sistema é configurado como PWA. No celular/Smart TV Android:
1. Acesse o site no Chrome
2. Menu → "Adicionar à tela inicial"
3. O app instalará sem barra de endereço, como app nativo

Para produção, substitua os arquivos em `public/icons/` por PNGs reais (192x192 e 512x512).

---

## 🚀 Deploy (Vercel + Supabase)

```bash
# 1. Crie um projeto no Supabase → pegue a DATABASE_URL
# 2. Deploy no Vercel
vercel --prod

# 3. Configure as variáveis de ambiente no Vercel dashboard:
#    DATABASE_URL=...
#    NEXTAUTH_SECRET=...
#    NEXTAUTH_URL=https://seudominio.com

# 4. Rode as migrations em produção
npx prisma db push
npm run db:seed
```

---

## 📦 Scripts Disponíveis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run start        # Servidor de produção
npm run db:push      # Aplicar schema ao DB
npm run db:seed      # Popular banco com dados iniciais
npm run db:studio    # Interface visual do banco (Prisma Studio)
```

---

## 🎨 Design System

- **Glassmorphism**: `.glass-card`, `.sidebar-glass`
- **Skeleton loading**: `.skeleton`
- **Hero gradients**: `.hero-gradient`, `.hero-gradient-bottom`
- **Form inputs**: `.form-input`
- **Gradiente de texto**: `.gradient-text`
- **Scrollbar oculta**: `.scrollbar-hide`
- **Light/Dark**: automático via `next-themes`

---

## ⚙️ Stack Completa

| Tecnologia | Uso |
|------------|-----|
| Next.js 14 App Router | Framework |
| TypeScript | Tipagem |
| Tailwind CSS | Estilização |
| Prisma ORM | Banco de dados |
| PostgreSQL | Banco de dados |
| NextAuth.js | Autenticação |
| next-themes | Light/Dark mode |
| HLS.js | Player de vídeo |
| Recharts | Gráficos do dashboard |
| bcryptjs | Hash de senhas |
