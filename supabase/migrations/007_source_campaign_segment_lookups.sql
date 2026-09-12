-- Vira campos de texto livre em listas de seleção, para permitir relatórios
-- melhores: origem do lead, campanha e segmento da empresa.
--
-- Aditiva e não destrutiva: cria as tabelas de apoio e faz backfill a partir
-- dos valores já usados, mas não adiciona CHECK constraint nas colunas de
-- texto (contacts.source, contacts.campaign, companies.segment) para não
-- travar em valores legados. A validação de opções fica só na UI.

create table if not exists public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.company_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

alter table public.lead_sources enable row level security;
create policy lead_sources_org_access on public.lead_sources
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

alter table public.company_segments enable row level security;
create policy company_segments_org_access on public.company_segments
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.lead_sources to authenticated;
grant select, insert, update, delete on public.company_segments to authenticated;

insert into public.lead_sources (organization_id, name)
select distinct organization_id, btrim(source)
from public.contacts
where source is not null and btrim(source) <> ''
on conflict (organization_id, name) do nothing;

insert into public.company_segments (organization_id, name)
select distinct organization_id, btrim(segment)
from public.companies
where segment is not null and btrim(segment) <> ''
on conflict (organization_id, name) do nothing;

insert into public.campaigns (organization_id, name)
select distinct organization_id, btrim(campaign)
from public.contacts
where campaign is not null and btrim(campaign) <> ''
on conflict (organization_id, name) do nothing;
