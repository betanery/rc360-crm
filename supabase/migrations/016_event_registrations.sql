-- Liga contatos a eventos de forma estruturada (contact_id + event_id),
-- em vez de depender só de contacts.campaign (que é sobrescrito a cada
-- nova inscrição e não serve pra quem se inscreve em mais de um evento).
-- Também guarda se o inscrito efetivamente compareceu.

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id()
    references public.organizations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  registered_at timestamptz not null default now(),
  attended boolean not null default false,
  attended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, contact_id)
);

create trigger event_registrations_updated_at before update
  on public.event_registrations for each row execute function public.set_updated_at();

alter table public.event_registrations enable row level security;
create policy event_registrations_org_access on public.event_registrations
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.event_registrations to authenticated;

create index if not exists event_registrations_event_idx
  on public.event_registrations(event_id);
