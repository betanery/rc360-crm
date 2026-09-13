-- Campos de qualificação de lead (vindos hoje de formulários de evento como
-- o Blindspot) deixam de ser texto solto dentro de "notes" e viram colunas
-- próprias, com uma tabela de opções compartilhada (um discriminador de
-- campo em vez de 5 tabelas quase idênticas).

create table if not exists public.contact_field_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  field text not null check (field in ('market_time', 'team_size', 'referred_by', 'main_pain', 'wants_feedback')),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, field, name)
);

alter table public.contact_field_options enable row level security;
create policy contact_field_options_org_access on public.contact_field_options
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.contact_field_options to authenticated;

alter table public.contacts add column if not exists market_time text;
alter table public.contacts add column if not exists team_size text;
alter table public.contacts add column if not exists referred_by text;
alter table public.contacts add column if not exists main_pain text;
alter table public.contacts add column if not exists wants_feedback text;
