-- Torna as etapas do pipeline configuráveis por organização, preservando os
-- nomes atuais ("Novo lead" ... "Perdido") como seed inicial.
--
-- Esta migration precisa ser aplicada manualmente (SQL Editor do Supabase ou
-- `supabase db push`) por quem tiver acesso administrativo ao projeto.

create table if not exists public.funnel_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  name text not null,
  position numeric not null default 0,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

alter table public.funnel_stages enable row level security;
create policy funnel_stages_org_access on public.funnel_stages
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.funnel_stages to authenticated;

-- Semeia as etapas atuais para toda organização existente.
insert into public.funnel_stages (organization_id, name, position, is_won, is_lost)
select o.id, s.name, s.position, s.is_won, s.is_lost
from public.organizations o
cross join (values
  ('Novo lead', 0, false, false),
  ('Em qualificação', 1, false, false),
  ('Call agendada', 2, false, false),
  ('Proposta enviada', 3, false, false),
  ('Ganho', 4, true, false),
  ('Perdido', 5, false, true)
) as s(name, position, is_won, is_lost)
on conflict (organization_id, name) do nothing;

-- Substitui a lista fixa de etapas por uma validação dinâmica contra
-- funnel_stages da mesma organização, mantendo as regras de negócio de
-- "Ganho exige valor" e "Perdido exige motivo" (essas continuam usando os
-- nomes literais 'Ganho' e 'Perdido' por convenção).
alter table public.opportunities drop constraint if exists opportunities_stage_check;

create or replace function public.stage_exists(target_org uuid, target_stage text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.funnel_stages
    where organization_id = target_org and name = target_stage
  )
$$;

alter table public.opportunities
  add constraint opportunities_stage_valid
  check (public.stage_exists(organization_id, stage));

grant execute on function public.stage_exists(uuid, text) to authenticated;
