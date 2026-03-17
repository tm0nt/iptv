# StreamBox Pro — Atualização Completa

## Resumo das Mudanças

### 1. 🚀 Progressive Loading (Scroll Infinito)
**Problema:** O catálogo carregava TODOS os canais de uma vez, travando o site.

**Solução:**
- **`/api/channels`** agora é **paginado** — carrega 4 categorias por vez
- **`useCatalog` hook** gerencia loading progressivo com IntersectionObserver
- **Skeleton loaders** aparecem enquanto próximas categorias carregam
- **Virtualização** no carrossel — só renderiza cards visíveis na viewport

**Arquivos alterados:**
- `src/app/api/channels/route.ts` — API paginada (params: page, limit, type)
- `src/hooks/useCatalog.ts` — Hook novo para infinite scroll
- `src/components/catalog/CatalogCarousel.tsx` — Lazy loading de imagens + virtualização
- `src/app/(client)/watch/page.tsx` — Reescrita completa com progressive loading

---

### 2. 📺 Renderização Imediata
**Problema:** Só mostrava conteúdo depois de carregar TUDO.

**Solução:**
- Primeira batch (4 categorias) renderiza **imediatamente**
- Hero banner aparece assim que a primeira categoria chega
- Tabs funcionam sem esperar o catálogo completo
- Skeletons animados preenchem o espaço enquanto mais conteúdo carrega
- Imagens usam `loading="lazy"` nativo do browser

---

### 3. 🎬 Catalogação de Séries e Filmes
**Problema:** "Black Mirror S01 E01" aparecia como canal avulso, sem estrutura.

**Solução — Nova estrutura no banco:**

```
Series (Black Mirror)
  └── Season (Temporada 1)
        └── Episode (E01, E02, E03...)
              └── Channel (stream URL)
```

**Parser inteligente** (`m3u-parser.ts`) detecta automaticamente:
- `S01 E01`, `S01E01` — padrão internacional
- `T02E05` — padrão PT-BR
- `Season 1 Episode 1` — por extenso
- `Temporada 1 Episódio 3` — por extenso PT-BR

**Detecção por grupo M3U:**
- Grupo "Netflix" + nome "Altered Carbon S01 E01" → Série
- Grupo "Ação e Crime" + nome "Matrix (1999)" → Filme  
- Grupo "GLOBO SUDESTE" → Canal ao vivo
- Grupo "MARATONA 24H" → Live (não série)

**Novos modelos Prisma:**
- `Series` — título, slug, poster, provider (Netflix/HBO/etc), gênero
- `Season` — liga a Series, número da temporada
- `Episode` — liga a Season, número do episódio
- `Channel.contentType` — LIVE | MOVIE | SERIES | RADIO
- `Channel.episodeId` — liga canal a um episódio

---

## Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/hooks/useCatalog.ts` | Hook de infinite scroll + IntersectionObserver |
| `src/components/catalog/SeriesCarousel.tsx` | Carrossel de séries com posters verticais |
| `src/app/api/series/route.ts` | API para listar/detalhar séries |
| `src/app/(client)/series/[id]/page.tsx` | Página de detalhe de série (temporadas + episódios) |
| `prisma/migrations/20260315220000_add_series_vod/` | Migration para Series/Season/Episode |

## Arquivos Modificados

| Arquivo | O que mudou |
|---------|-------------|
| `prisma/schema.prisma` | +Series +Season +Episode, Channel.contentType |
| `prisma/seed.ts` | Categorias essenciais BR atualizadas |
| `src/lib/m3u-parser.ts` | Detecção de contentType + extração de série/temporada/episódio |
| `src/types/index.ts` | +SeriesItem +SeasonItem +EpisodeItem +SeriesDetail |
| `src/app/api/channels/route.ts` | Paginação (page/limit/type params) |
| `src/app/api/search/route.ts` | Busca séries além de canais |
| `src/app/api/admin/import/route.ts` | Cria Series/Season/Episode no import |
| `src/app/api/admin/auto-categorize/route.ts` | Usa contentType, cria categorias automaticamente |
| `src/components/catalog/CatalogCarousel.tsx` | Virtualização + lazy loading + skeleton |
| `src/components/catalog/SearchModal.tsx` | Mostra séries nos resultados |
| `src/components/catalog/HeroBanner.tsx` | Import fix |
| `src/app/(client)/watch/page.tsx` | Reescrita com progressive loading + tabs |

---

## Como Aplicar

```bash
# 1. Copie os arquivos para seu projeto (sobrescreva)
cp -r output/* seu-projeto/

# 2. Rode a migration
npx prisma migrate dev --name add_series_vod

# 3. Rode o seed atualizado
npx prisma db seed

# 4. Re-importe seus M3U (agora cria séries automaticamente)
# Via admin panel: Import → Upload arquivos

# 5. Rode a auto-categorização
# Via admin panel ou POST /api/admin/auto-categorize
```

## Fluxo de Import Atualizado

1. **Upload M3U** → Parser detecta contentType de cada canal
2. **Channels criados** com contentType (LIVE/MOVIE/SERIES/RADIO)
3. **Séries detectadas** → Cria Series + Season + Episode automaticamente
4. **Auto-categorize** → Categoriza todos os canais baseado em grupo + nome
5. **Frontend** → Carrega progressivamente, mostra séries separadas

## Performance

- **Antes:** 1 request carregava tudo → 3-10s de espera
- **Depois:** 4 categorias por request → ~200ms primeira renderização
- **Imagens:** lazy loading + virtualização = só carrega o visível
- **Séries:** API separada, carrega sob demanda
- **Busca:** Retorna canais + séries em paralelo
