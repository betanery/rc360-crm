-- Eventos/workshops/aulas com formulário público de inscrição. Cada evento
-- tem sua própria identidade visual (cor, título, logo) e dispara uma
-- sequência de mensagens (boas-vindas, lembretes, encerramento, follow-up)
-- via a fila de automação que já existe (enqueue_automation).

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  slug text not null,
  name text not null,
  product text not null,
  headline text,
  subtitle text,
  brand_color text not null default '#132e50',
  logo_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  reminder_days integer[] not null default '{}',
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'email', 'both')),
  welcome_message text,
  reminder_message text,
  closing_message text,
  followup_message text,
  active boolean not null default true,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

alter table public.events enable row level security;
create policy events_org_access on public.events
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.events to authenticated;

-- Bucket de logos de evento: leitura pública (a página de inscrição é
-- pública), upload só por usuário autenticado.
insert into storage.buckets (id, name, public)
values ('event-branding', 'event-branding', true)
on conflict (id) do nothing;

create policy "event-branding public read" on storage.objects
  for select using (bucket_id = 'event-branding');

create policy "event-branding authenticated insert" on storage.objects
  for insert with check (bucket_id = 'event-branding' and auth.role() = 'authenticated');

create policy "event-branding authenticated update" on storage.objects
  for update using (bucket_id = 'event-branding' and auth.role() = 'authenticated');

create policy "event-branding authenticated delete" on storage.objects
  for delete using (bucket_id = 'event-branding' and auth.role() = 'authenticated');
