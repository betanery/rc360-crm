alter table public.contacts
  add column if not exists external_id text,
  add column if not exists whatsapp_opt_in boolean not null default false,
  add column if not exists email_opt_in boolean not null default false,
  add column if not exists opt_in_at timestamptz,
  add column if not exists opt_in_source text;

alter table public.opportunities
  add column if not exists external_id text,
  add column if not exists checkout_url text,
  add column if not exists recovery_reason text;

create table if not exists public.automation_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  channel text not null check (channel in ('whatsapp','email')),
  automation_type text not null,
  subject text,
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','processing','sent','blocked','failed')),
  attempts integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists automation_queue_pending_idx
  on public.automation_queue(status, scheduled_at);
create index if not exists automation_queue_contact_idx
  on public.automation_queue(contact_id, created_at desc);

alter table public.automation_queue enable row level security;
create policy automation_queue_org_access on public.automation_queue
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.automation_queue to authenticated;

create or replace function public.enqueue_automation(
  p_contact_id uuid,
  p_opportunity_id uuid,
  p_channel text,
  p_automation_type text,
  p_message text,
  p_subject text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_scheduled_at timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_whatsapp_opt_in boolean;
  v_email_opt_in boolean;
  v_status text := 'pending';
  v_id uuid;
begin
  select organization_id, whatsapp_opt_in, email_opt_in
    into v_org, v_whatsapp_opt_in, v_email_opt_in
  from public.contacts
  where id = p_contact_id;

  if v_org is null or not public.is_org_member(v_org) then
    raise exception 'contact_not_accessible';
  end if;

  if p_channel = 'whatsapp' and not v_whatsapp_opt_in then v_status := 'blocked'; end if;
  if p_channel = 'email' and not v_email_opt_in then v_status := 'blocked'; end if;
  if p_channel not in ('whatsapp','email') then raise exception 'invalid_channel'; end if;

  insert into public.automation_queue(
    organization_id, contact_id, opportunity_id, channel, automation_type,
    subject, message, metadata, scheduled_at, status, created_by
  ) values (
    v_org, p_contact_id, p_opportunity_id, p_channel, p_automation_type,
    p_subject, coalesce(p_message,''), coalesce(p_metadata,'{}'::jsonb),
    coalesce(p_scheduled_at, now()), v_status, auth.uid()
  ) returning id into v_id;

  return v_id;
end $$;

grant execute on function public.enqueue_automation(uuid,uuid,text,text,text,text,jsonb,timestamptz) to authenticated;
