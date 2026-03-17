#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#   StreamBox Pro — Setup Script
#   Usage: chmod +x setup.sh && ./setup.sh
# ═══════════════════════════════════════════════════════════════
set -e

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║       StreamBox Pro — Setup           ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

# ── 1. Check Node.js ───────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo -e "${RED}❌ Node.js não encontrado. Instale Node.js 18+ primeiro.${NC}"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}❌ Node.js 18+ é necessário. Versão atual: $(node -v)${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v) encontrado${NC}"

# ── 2. Create .env if it doesn't exist ───────────────────────
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠️  Criando .env a partir de .env.example...${NC}"
  cp .env.example .env
  
  # Generate random NEXTAUTH_SECRET
  SECRET=$(openssl rand -base64 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  
  # Replace placeholder in .env
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/your-super-secret-key-here-change-this/$SECRET/" .env
  else
    sed -i "s/your-super-secret-key-here-change-this/$SECRET/" .env
  fi
  
  echo -e "${YELLOW}⚠️  Edite o arquivo .env e configure DATABASE_URL com sua conexão PostgreSQL!${NC}"
  echo ""
  echo -e "  DATABASE_URL=\"postgresql://USER:PASSWORD@HOST:5432/streambox\""
  echo ""
  
  read -p "Pressione ENTER após editar o .env para continuar..." -r
fi

# ── 3. Install dependencies ───────────────────────────────────
echo -e "\n${BLUE}📦 Instalando dependências...${NC}"
npm install

# ── 4. Generate Prisma client ──────────────────────────────────
echo -e "\n${BLUE}🗄️  Gerando cliente Prisma...${NC}"
npx prisma generate

# ── 5. Push DB schema ─────────────────────────────────────────
echo -e "\n${BLUE}🗄️  Aplicando schema ao banco de dados...${NC}"
npx prisma db push

# ── 6. Seed database ───────────────────────────────────────────
echo -e "\n${BLUE}🌱 Populando banco de dados com dados iniciais...${NC}"
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts

# ── 7. Create placeholder PWA icons ──────────────────────────
echo -e "\n${BLUE}🎨 Criando ícones PWA placeholder...${NC}"
mkdir -p public/icons

# Create simple SVG icons (replace with real ones in production)
cat > /tmp/icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#3b82f6"/>
  <rect x="96" y="160" width="320" height="200" rx="16" fill="white" opacity="0.9"/>
  <rect x="176" y="360" width="160" height="24" rx="8" fill="white" opacity="0.7"/>
  <rect x="216" y="384" width="80" height="40" rx="4" fill="white" opacity="0.5"/>
  <circle cx="256" cy="232" r="40" fill="#3b82f6"/>
  <polygon points="244,216 244,248 276,232" fill="white"/>
</svg>
EOF

# Convert to PNG if ImageMagick is available, otherwise copy SVG placeholder
if command -v convert &>/dev/null; then
  convert -resize 192x192 /tmp/icon.svg public/icons/icon-192.png 2>/dev/null || cp /tmp/icon.svg public/icons/icon-192.png
  convert -resize 512x512 /tmp/icon.svg public/icons/icon-512.png 2>/dev/null || cp /tmp/icon.svg public/icons/icon-512.png
  echo -e "${GREEN}✅ Ícones PNG criados${NC}"
else
  cp /tmp/icon.svg public/icons/icon-192.png
  cp /tmp/icon.svg public/icons/icon-512.png
  echo -e "${YELLOW}⚠️  ImageMagick não encontrado — usando SVG como placeholder. Substitua por PNG real.${NC}"
fi

# ── 8. Done! ──────────────────────────────────────────────────
echo -e "\n${GREEN}"
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║  ✅ Setup concluído com sucesso!           ║"
echo "  ╚═══════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${BLUE}🚀 Para iniciar o servidor de desenvolvimento:${NC}"
echo -e "   npm run dev"
echo ""
echo -e "${BLUE}📋 Credenciais de teste:${NC}"
echo -e "   Admin:      ${YELLOW}admin@iptvbox.com${NC}      / ${YELLOW}admin123${NC}"
echo -e "   Revendedor: ${YELLOW}revendedor@iptvbox.com${NC} / ${YELLOW}reseller123${NC}"
echo -e "   Cliente:    ${YELLOW}cliente@iptvbox.com${NC}    / ${YELLOW}client123${NC}"
echo ""
echo -e "${BLUE}🌐 Acesse:${NC}  http://localhost:3000"
echo -e "${BLUE}🗄️  Prisma Studio:${NC}  npm run db:studio"
echo ""
