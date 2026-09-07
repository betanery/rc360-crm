# RC360 CRM

MVP responsivo para organizar a captação, o atendimento comercial e as recuperações do ecossistema RC360.

## Funcionalidades atuais

- dashboard comercial com indicadores;
- cadastro e pesquisa de contatos;
- pipeline em Kanban com movimentação de oportunidades;
- tarefas e acompanhamentos;
- recuperação de contatos e de carrinhos;
- configuração visual das futuras integrações com BotConversa, e-mail e checkout;
- autenticação por e-mail e senha com Supabase;
- banco PostgreSQL compartilhado com isolamento por organização (RLS);
- modo demonstração local quando o Supabase ainda não estiver configurado.

## Identidade visual

Interface executiva com azul-marinho, marfim, carvão, dourado e laranja para alertas, seguindo a identidade RC360.

## Configuração do Supabase

O app usa o projeto existente **RC360 - CRM**, referência `vvmsikxxoamwqjuihtjk`.
Não crie outro Supabase nem habilite Lovable Cloud Database para este CRM.

O arquivo `.env` versionado contém somente a configuração pública do navegador:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (chave publishable) e
`VITE_SUPABASE_PROJECT_ID`. O Vite carrega esses valores no desenvolvimento e no
build, sem depender da conexão administrativa do Lovable. Variáveis do ambiente
de build e arquivos locais podem sobrescrever esses valores; mantenha-os alinhados
ao mesmo projeto. `.env.example` é apenas uma referência e não precisa ser copiado
para executar este CRM.

Após sincronizar o GitHub, o Lovable precisa reconstruir o preview. Uma compilação
bem-sucedida deve exibir a tela de login quando não houver sessão autenticada.
Entre com um usuário existente; o cadastro público está desativado. Não reaplique
migrations nem crie usuários para configurar o frontend.

Nunca adicione a chave `service_role` ao frontend. O banco já aplica RLS para que cada usuário acesse somente a organização à qual pertence.

## Próxima fase

Finalizar telas de cadastro de oportunidades e tarefas, seguida das integrações reais com BotConversa, provedor de e-mail e Kiwify.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/86abcb3f-7542-4bce-a76f-5577aa852675).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
