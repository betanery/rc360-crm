# Plano: conectar backend Supabase real ao RC360 CRM

## Objetivo
Trocar os dados de demonstração e placeholders pelo backend real, usando o schema Supabase já preparado no projeto.

## Escopo
- Ativar Lovable Cloud e provisionar o projeto Supabase.
- Aplicar as migrations existentes (`001_initial_schema.sql` e `002_crm_automations.sql`).
- Substituir variáveis de ambiente placeholder pelas reais do projeto.
- Fazer o `CRMProvider` carregar e alterar dados no Supabase.
- Inserir dados iniciais de exemplo (contatos, oportunidades, tarefas e recuperações) via migration.
- Corrigir o erro de hidratação no Dashboard causado por `new Date()` durante SSR.
- Verificar build e preview.

## O que será entregue
- Backend Supabase conectado ao RC360 CRM.
- Dashboard, Contatos, Pipeline, Tarefas e Recuperações lendo e gravando no banco.
- Dados iniciais disponíveis para demonstração imediata.
- Build passando sem erros de hidratação.

## Detalhes técnicos

### 1. Ativar Lovable Cloud
- Pré-requisito: créditos disponíveis no workspace.
- Ação: `supabase--enable` para criar/conectar o projeto.

### 2. Aplicar migrations existentes
- `supabase/migrations/001_initial_schema.sql`: cria tabelas (`organizations`, `profiles`, `contacts`, `opportunities`, `tasks`, `tags`, `contact_tags`, `payments`, `cart_recoveries`, `activities`, `automation_events`, `message_templates`), funções auxiliares, RLS e grants.
- `supabase/migrations/002_crm_automations.sql`: adiciona colunas de opt-in, tabela `automation_queue` e função `enqueue_automation`.

### 3. Variáveis de ambiente
- Atualizar `.env.example` e `.env` com:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_SUPABASE_PROJECT_ID`
- Remover aviso de placeholder do `src/integrations/supabase/client.ts` quando as variáveis forem reais.
- Garantir acesso via `import.meta.env["VITE_*"]` (notação de índice) para evitar erros de tipo.

### 4. Cliente Supabase
- Manter `src/integrations/supabase/client.ts` como cliente browser principal.
- Avaliar se `src/lib/supabase.ts` continua necessário ou pode ser unificado.
- Adicionar `database.types.ts` com tipos reais ou gerar tipos do schema.

### 5. Integração com `src/lib/crm-data.tsx`
- `refresh()` já consulta Supabase quando configurado; validar mapeamento de colunas snake_case para camelCase.
- `addContact`, `moveOpportunity`, `toggleTask` e `updateCart` já tentam gravar no Supabase; garantir tratamento de erros e atualização otimista da UI.
- Remover fallback para `localStorage` quando o Supabase estiver ativo.
- Adicionar indicador de carregamento e erros sem bloquear a navegação.

### 6. Seed de dados
- Criar migration `003_seed_demo_data.sql` inserindo:
  - 1 organização `RC360`.
  - 5 contatos de exemplo.
  - 4 oportunidades em diferentes estágios.
  - 3 tarefas pendentes.
  - 1 recuperação de carrinho.
- Dados atribuídos à primeira organização criada.

### 7. Correção de hidratação no Dashboard
- Substituir `new Date()` executado durante renderização por valores estáveis ou calcular dentro de `useEffect`.
- Garantir que formatação de datas seja consistente entre servidor e cliente.

### 8. Verificação
- Executar `build:dev` e inspecionar preview.
- Confirmar que Dashboard exibe os dados reais sem erros de console.
- Testar navegação entre rotas e uma operação de escrita (ex.: mover oportunidade).

## Fora do escopo deste plano
- Autenticação social (Google/Apple).
- Edge Functions de automação/importação/WhatsApp.
- Integrações externas (Kiwify, BotConversa).
- Painel administrativo de configurações avançadas.
