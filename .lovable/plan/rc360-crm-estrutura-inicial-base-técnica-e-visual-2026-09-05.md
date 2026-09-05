# RC360 CRM — Estrutura Inicial (Base Técnica e Visual)

Criar apenas o esqueleto do app: layout com menu lateral e cabeçalho, 5 páginas vazias com rotas prontas, e a identidade visual RC360 aplicada via tokens de design. Sem banco de dados, autenticação ou funcionalidades — apenas a base visual responsiva.

## O que será construído

### 1. Identidade visual (src/styles.css)
Tokens semânticos em oklch:
- **Primária:** azul-marinho (menu lateral, cabeçalho de destaque, elementos-chave)
- **Fundo:** marfim (área de conteúdo)
- **Texto:** carvão
- **Destaque/acento:** dourado (botões principais, estados ativos, badges)
- **Alerta:** laranja (reservado apenas para avisos — token `warning`)
- Tipografia executiva: serifada elegante para títulos (ex.: Libre Baskerville ou Fraunces) + sans limpa para texto (ex.: Work Sans), carregadas via `<link>` no root.

### 2. Layout do app (shell)
- **Menu lateral** (azul-marinho): logo "RC360 CRM", itens Dashboard, Contatos, Pipeline, Tarefas, Configurações com ícones (lucide). Item ativo destacado em dourado. Em mobile, vira drawer (hambúrguer no cabeçalho).
- **Cabeçalho**: título da página atual, campo de busca (visual apenas), avatar/ícone de usuário placeholder, sino de notificações (visual apenas).
- Arquivos: `src/components/layout/AppSidebar.tsx`, `AppHeader.tsx`, `AppLayout.tsx`; layout montado em `src/routes/__root.tsx` envolvendo `<Outlet />`.

### 3. Rotas (páginas vazias, uma por arquivo)
Cada uma com `head()` próprio (título + description únicos) e corpo vazio com apenas um estado "em breve" discreto:
- `src/routes/index.tsx` → Dashboard (`/`)
- `src/routes/contatos.tsx` → Contatos
- `src/routes/pipeline.tsx` → Pipeline
- `src/routes/tarefas.tsx` → Tarefas
- `src/routes/configuracoes.tsx` → Configurações

### 4. Ajustes no root
- Trocar metadados genéricos ("Lovable App") por RC360 CRM (pt-BR, `lang="pt-BR"`).
- Adicionar links das fontes no head.
- Manter `NotFoundComponent`/`ErrorComponent` existentes.

## Fora de escopo (conforme solicitado)
Sem banco de dados, autenticação, integrações, automações ou dados reais. Nenhuma dependência nova além das já presentes (lucide-react para ícones, se disponível; senão instalo).

## Verificação
Conferir no preview: menu lateral e cabeçalho renderizam em desktop e mobile, navegação entre as 5 rotas funciona, item ativo destacado, cores RC360 aplicadas.
