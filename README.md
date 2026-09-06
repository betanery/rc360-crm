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

1. Crie um projeto no Supabase.
2. Execute `supabase/migrations/001_initial_schema.sql` no SQL Editor.
3. Em Authentication, desative cadastro público e crie o primeiro usuário da RC360. Ele será administrador.
4. Copie `.env.example` para `.env.local` e informe a URL e a chave pública `anon` do projeto.
5. No Lovable, cadastre as mesmas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nos secrets do projeto.

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
