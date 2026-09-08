-- Cadastro de empresas como entidade própria (o CRM só tinha um campo de
-- texto livre "company" dentro de contacts). Aditiva e não destrutiva:
-- mantém contacts.company como está, apenas soma o cadastro estruturado.
--
-- Esta migration precisa ser aplicada manualmente (SQL Editor do Supabase ou
-- `supabase db push`) por quem tiver acesso administrativo ao projeto.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  name text not null,
  segment text,
  notes text,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

alter table public.companies enable row level security;
create policy companies_org_access on public.companies
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.companies to authenticated;

-- Popula o cadastro estruturado com os nomes de empresa já usados em contatos.
insert into public.companies (organization_id, name)
select distinct organization_id, btrim(company)
from public.contacts
where company is not null and btrim(company) <> ''
on conflict (organization_id, name) do nothing;
