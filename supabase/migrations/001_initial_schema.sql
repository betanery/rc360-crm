create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'commercial' check (role in ('admin', 'manager', 'commercial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.current_organization_id()
returns uuid language sql stable security definer set search_path = public
as $$ select organization_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_org_member(target uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and organization_id = target) $$;

create or replace function public.is_org_admin(target uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.profiles where id = auth.uid() and organization_id = target and role = 'admin') $$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  name text not null,
  source text,
  starts_at date,
  ends_at date,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  name text not null,
  company text,
  phone text not null,
  email text,
  product text not null check (product in ('Rotas do Lucro', 'Fastrack', 'Consultoria 4X')),
  source text,
  campaign text,
  owner_name text,
  notes text,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create unique index contacts_org_email_unique on public.contacts (organization_id, lower(email))
  where email is not null and btrim(email) <> '';
create unique index contacts_org_phone_unique on public.contacts
  (organization_id, regexp_replace(phone, '[^0-9]', '', 'g'));

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  contact_id uuid not null,
  stage text not null default 'Novo lead' check (stage in ('Novo lead', 'Em qualificação', 'Call agendada', 'Proposta enviada', 'Ganho', 'Perdido')),
  value numeric(14,2) not null default 0 check (value >= 0),
  next_action text not null,
  next_action_at timestamptz not null,
  lost_reason text,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, contact_id) references public.contacts(organization_id, id) on delete cascade,
  check (stage <> 'Ganho' or value > 0),
  check (stage <> 'Perdido' or nullif(btrim(lost_reason), '') is not null)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  contact_id uuid not null,
  title text not null,
  due_at timestamptz not null,
  type text not null check (type in ('Call', 'Ligação', 'WhatsApp', 'E-mail', 'Follow-up')),
  status text not null default 'Pendente' check (status in ('Pendente', 'Concluída')),
  assigned_to uuid references public.profiles(id),
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, contact_id) references public.contacts(organization_id, id) on delete cascade
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);

create table public.contact_tags (
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  contact_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id),
  foreign key (organization_id, contact_id) references public.contacts(organization_id, id) on delete cascade,
  foreign key (organization_id, tag_id) references public.tags(organization_id, id) on delete cascade
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  contact_id uuid not null,
  external_id text,
  provider text not null default 'Kiwify',
  product text not null,
  value numeric(14,2) not null default 0,
  status text not null,
  occurred_at timestamptz not null default now(),
  raw_event jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (organization_id, contact_id) references public.contacts(organization_id, id) on delete cascade,
  unique (organization_id, provider, external_id)
);

create table public.cart_recoveries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  contact_id uuid not null,
  product text not null check (product in ('Rotas do Lucro', 'Fastrack', 'Consultoria 4X')),
  reason text not null,
  value numeric(14,2) not null default 0,
  status text not null default 'Em recuperação' check (status in ('Em recuperação', 'Recuperado', 'Encerrado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, contact_id) references public.contacts(organization_id, id) on delete cascade
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.automation_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  provider text not null,
  event_type text not null,
  external_id text,
  status text not null default 'received',
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  unique (organization_id, provider, external_id)
);

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  name text not null,
  channel text not null check (channel in ('WhatsApp', 'E-mail')),
  subject text,
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger contacts_updated_at before update on public.contacts for each row execute function public.set_updated_at();
create trigger opportunities_updated_at before update on public.opportunities for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger carts_updated_at before update on public.cart_recoveries for each row execute function public.set_updated_at();
create trigger templates_updated_at before update on public.message_templates for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_org uuid;
  target_role text := 'commercial';
begin
  select id into target_org from public.organizations order by created_at limit 1;
  if target_org is null then
    insert into public.organizations(name) values ('RC360') returning id into target_org;
    target_role := 'admin';
    insert into public.products(organization_id, name) values
      (target_org, 'Rotas do Lucro'), (target_org, 'Fastrack'), (target_org, 'Consultoria 4X');
  end if;
  insert into public.profiles(id, organization_id, full_name, role)
  values (new.id, target_org, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), target_role);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.campaigns enable row level security;
alter table public.contacts enable row level security;
alter table public.opportunities enable row level security;
alter table public.tasks enable row level security;
alter table public.tags enable row level security;
alter table public.contact_tags enable row level security;
alter table public.payments enable row level security;
alter table public.cart_recoveries enable row level security;
alter table public.activities enable row level security;
alter table public.automation_events enable row level security;
alter table public.message_templates enable row level security;

create policy organizations_read on public.organizations for select using (public.is_org_member(id));
create policy organizations_admin_update on public.organizations for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));
create policy profiles_read on public.profiles for select using (public.is_org_member(organization_id));
create policy profiles_update on public.profiles for update using (id = auth.uid() or public.is_org_admin(organization_id)) with check (public.is_org_member(organization_id));

do $$
declare table_name text;
begin
  foreach table_name in array array['products','campaigns','contacts','opportunities','tasks','tags','contact_tags','payments','cart_recoveries','activities','automation_events','message_templates']
  loop
    execute format('create policy %I on public.%I for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id))', table_name || '_org_access', table_name);
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;

-- Segurança operacional: desative cadastros públicos no painel Auth do Supabase.
-- Crie os usuários da equipe em Authentication > Users. O primeiro será administrador.
