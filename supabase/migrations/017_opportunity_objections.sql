-- Objeções do prospect (tags reaproveitando a tabela `tags` já usada
-- pelos contatos) e mapa de decisão (texto livre) por oportunidade.

alter table public.opportunities
  add column if not exists decision_map text;

create table if not exists public.opportunity_objections (
  organization_id uuid not null default public.current_organization_id()
    references public.organizations(id) on delete cascade,
  opportunity_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (opportunity_id, tag_id),
  foreign key (opportunity_id)
    references public.opportunities(id) on delete cascade,
  foreign key (organization_id, tag_id)
    references public.tags(organization_id, id) on delete cascade
);

alter table public.opportunity_objections enable row level security;
create policy opportunity_objections_org_access on public.opportunity_objections
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.opportunity_objections to authenticated;
