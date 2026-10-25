-- E-mails de conteúdo (aquecimento): campos extras nos passos das cadências,
-- histórico de envios avulsos e a função que enfileira um envio avulso.

alter table public.cadence_steps
  add column if not exists preheader text,
  add column if not exists cta_label text,
  add column if not exists cta_url text;

create table if not exists public.content_broadcasts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id()
    references public.organizations(id) on delete cascade,
  subject text not null,
  preheader text,
  body text not null,
  cta_label text,
  cta_url text,
  audience jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null default now(),
  recipients integer not null default 0,
  skipped integer not null default 0,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.content_broadcasts enable row level security;
create policy content_broadcasts_org_access on public.content_broadcasts
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.content_broadcasts to authenticated;

-- Os passos de cadência passam a levar preheader e botão para a fila.
create or replace function public.enroll_contact_in_cadence(
  p_cadence_id uuid,
  p_contact_id uuid,
  p_opportunity_id uuid default null,
  p_source text default 'manual'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cadence public.cadences%rowtype;
  v_contact public.contacts%rowtype;
  v_enrollment_id uuid;
  v_step public.cadence_steps%rowtype;
  v_local_now timestamp;
  v_scheduled timestamptz;
  v_status text;
  v_message text;
begin
  select * into v_cadence from public.cadences where id = p_cadence_id and active;
  if v_cadence is null then
    return null;
  end if;

  if auth.uid() is not null and not public.is_org_member(v_cadence.organization_id) then
    raise exception 'not_authorized';
  end if;

  select * into v_contact from public.contacts
    where id = p_contact_id and organization_id = v_cadence.organization_id;
  if v_contact is null then
    return null;
  end if;

  insert into public.cadence_enrollments
    (organization_id, cadence_id, contact_id, opportunity_id, source, created_by)
  values
    (v_cadence.organization_id, p_cadence_id, p_contact_id, p_opportunity_id, p_source, auth.uid())
  on conflict (cadence_id, contact_id) where status = 'active' do nothing
  returning id into v_enrollment_id;

  if v_enrollment_id is null then
    return null;
  end if;

  v_local_now := now() at time zone 'America/Sao_Paulo';

  for v_step in
    select * from public.cadence_steps where cadence_id = p_cadence_id order by step_order
  loop
    if v_step.time_of_day is not null then
      v_scheduled := (date_trunc('day', v_local_now) + (v_step.day_offset || ' days')::interval
        + v_step.time_of_day) at time zone 'America/Sao_Paulo';
    else
      v_scheduled := (v_local_now + (v_step.day_offset || ' days')::interval)
        at time zone 'America/Sao_Paulo';
    end if;

    v_message := replace(coalesce(v_step.message, ''), '{{nome}}', split_part(v_contact.name, ' ', 1));

    v_status := 'pending';
    if v_step.channel = 'whatsapp' and not v_contact.whatsapp_opt_in then v_status := 'blocked'; end if;
    if v_step.channel = 'email' and not v_contact.email_opt_in then v_status := 'blocked'; end if;

    insert into public.automation_queue
      (organization_id, contact_id, opportunity_id, channel, automation_type,
       subject, message, metadata, scheduled_at, status, created_by)
    values
      (v_cadence.organization_id, p_contact_id, p_opportunity_id, v_step.channel, 'cadence_step',
       v_step.subject, v_message,
       jsonb_build_object(
         'cadence_id', p_cadence_id,
         'step_id', v_step.id,
         'enrollment_id', v_enrollment_id,
         'preheader', v_step.preheader,
         'cta_label', v_step.cta_label,
         'cta_url', v_step.cta_url
       ),
       v_scheduled, v_status, auth.uid());
  end loop;

  return v_enrollment_id;
end;
$$;

-- Envio avulso de conteúdo: recebe a lista final de contatos (a tela resolve
-- o público) e enfileira e-mails só para quem tem autorização de e-mail.
create or replace function public.enqueue_broadcast(
  p_subject text,
  p_preheader text,
  p_body text,
  p_cta_label text,
  p_cta_url text,
  p_contact_ids uuid[],
  p_scheduled_at timestamptz default now(),
  p_audience jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_broadcast_id uuid;
  v_contact public.contacts%rowtype;
  v_queued integer := 0;
  v_total integer := coalesce(array_length(p_contact_ids, 1), 0);
begin
  if auth.uid() is null then
    raise exception 'not_authorized';
  end if;

  v_org := public.current_organization_id();
  if v_org is null then
    raise exception 'not_authorized';
  end if;

  if btrim(coalesce(p_subject, '')) = '' or btrim(coalesce(p_body, '')) = '' then
    raise exception 'subject_and_body_required';
  end if;

  insert into public.content_broadcasts
    (organization_id, subject, preheader, body, cta_label, cta_url, audience, scheduled_at)
  values
    (v_org, p_subject, nullif(btrim(p_preheader), ''), p_body, nullif(btrim(p_cta_label), ''),
     nullif(btrim(p_cta_url), ''), coalesce(p_audience, '{}'::jsonb), coalesce(p_scheduled_at, now()))
  returning id into v_broadcast_id;

  for v_contact in
    select * from public.contacts
    where organization_id = v_org
      and id = any(p_contact_ids)
      and email_opt_in
      and btrim(coalesce(email, '')) <> ''
  loop
    insert into public.automation_queue
      (organization_id, contact_id, channel, automation_type, subject, message, metadata,
       scheduled_at, status, created_by)
    values
      (v_org, v_contact.id, 'email', 'content', p_subject,
       replace(p_body, '{{nome}}', split_part(v_contact.name, ' ', 1)),
       jsonb_build_object(
         'broadcast_id', v_broadcast_id,
         'preheader', nullif(btrim(p_preheader), ''),
         'cta_label', nullif(btrim(p_cta_label), ''),
         'cta_url', nullif(btrim(p_cta_url), '')
       ),
       coalesce(p_scheduled_at, now()), 'pending', auth.uid());
    v_queued := v_queued + 1;
  end loop;

  update public.content_broadcasts
    set recipients = v_queued, skipped = v_total - v_queued
    where id = v_broadcast_id;

  return jsonb_build_object('broadcast_id', v_broadcast_id, 'queued', v_queued, 'skipped', v_total - v_queued);
end;
$$;

grant execute on function public.enqueue_broadcast(
  text, text, text, text, text, uuid[], timestamptz, jsonb
) to authenticated;
