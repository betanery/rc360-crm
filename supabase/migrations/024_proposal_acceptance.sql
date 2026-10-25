-- Link público da proposta: o cliente abre, vê o PDF e aceita (aceite
-- simples, não é assinatura digital qualificada).

alter table public.proposals
  add column if not exists public_token uuid not null default gen_random_uuid(),
  add column if not exists viewed_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_name text,
  add column if not exists accepted_ip text;

create unique index if not exists proposals_public_token_idx on public.proposals (public_token);
