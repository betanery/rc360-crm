-- Cadências: sequências de mensagens (N etapas, com dia + horário) que
-- matriculam contatos manualmente (público escolhido na hora) ou
-- automaticamente (novo contato, tag adicionada, mudança de estágio,
-- inatividade). Reaproveita a fila que já existe (automation_queue) em vez
-- de criar um mecanismo de envio paralelo — crm-automation continua sendo o
-- único processo que efetivamente envia mensagens.

create table public.cadences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  trigger_type text not null check (trigger_type in
    ('manual', 'contact_created', 'tag_added', 'stage_changed', 'inactivity_days')),
  trigger_config jsonb not null default '{}'::jsonb,
  audience_filters jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create trigger cadences_updated_at before update on public.cadences
  for each row execute function public.set_updated_at();

create table public.cadence_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  cadence_id uuid not null references public.cadences(id) on delete cascade,
  step_order integer not null,
  day_offset integer not null default 0 check (day_offset >= 0),
  time_of_day time,
  channel text not null check (channel in ('whatsapp', 'email')),
  subject text,
  message text not null default '',
  created_at timestamptz not null default now(),
  unique (cadence_id, step_order)
);

create table public.cadence_enrollments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  cadence_id uuid not null references public.cadences(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  source text not null default 'manual' check (source in
    ('manual', 'contact_created', 'tag_added', 'stage_changed', 'inactivity_days')),
  cancelled_reason text,
  enrolled_at timestamptz not null default now(),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Impede matricular o mesmo contato duas vezes na mesma cadência enquanto a
-- matrícula anterior ainda estiver ativa.
create unique index cadence_enrollments_active_unique
  on public.cadence_enrollments(cadence_id, contact_id) where status = 'active';
create index cadence_enrollments_opportunity_idx
  on public.cadence_enrollments(opportunity_id) where status = 'active';
create index activities_contact_created_idx
  on public.activities(contact_id, created_at desc);

alter table public.cadences enable row level security;
create policy cadences_org_access on public.cadences
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
grant select, insert, update, delete on public.cadences to authenticated;

alter table public.cadence_steps enable row level security;
create policy cadence_steps_org_access on public.cadence_steps
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
grant select, insert, update, delete on public.cadence_steps to authenticated;

alter table public.cadence_enrollments enable row level security;
create policy cadence_enrollments_org_access on public.cadence_enrollments
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));
grant select, insert, update, delete on public.cadence_enrollments to authenticated;

-- Confere se um contato bate com os filtros de público de uma cadência
-- (mesmo vocabulário usado no filtro da tela de Contatos: origem, tag,
-- maior dor, quer devolutiva). Filtro ausente/nulo = não restringe.
create or replace function public.contact_matches_filters(p_contact_id uuid, p_filters jsonb)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.contacts c
    where c.id = p_contact_id
      and (p_filters->>'source' is null or c.source = p_filters->>'source')
      and (p_filters->>'main_pain' is null or c.main_pain = p_filters->>'main_pain')
      and (p_filters->>'wants_feedback' is null or c.wants_feedback = p_filters->>'wants_feedback')
      and (
        p_filters->>'tag' is null or exists (
          select 1 from public.contact_tags ct
          join public.tags t on t.id = ct.tag_id
          where ct.contact_id = c.id and t.name = p_filters->>'tag'
        )
      )
  );
$$;

-- Matricula um contato numa cadência: cria a matrícula (ignora se já existe
-- uma ativa) e materializa cada etapa como uma linha em automation_queue,
-- calculando o horário de envio a partir do momento da matrícula (fuso de
-- São Paulo, já que "horário" configurado pela usuária é sempre horário
-- local do Brasil).
--
-- Chamada tanto por gatilhos automáticos (contexto de sistema, sem
-- auth.uid()) quanto pelo início manual (usuário logado, com auth.uid()) —
-- a checagem de permissão só roda quando auth.uid() não é nulo, mesmo
-- raciocínio já usado para explicar por que crm-event-submit não pode
-- chamar enqueue_automation (que exige auth.uid()) e insere direto na fila.
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
       jsonb_build_object('cadence_id', p_cadence_id, 'step_id', v_step.id, 'enrollment_id', v_enrollment_id),
       v_scheduled, v_status, auth.uid());
  end loop;

  return v_enrollment_id;
end;
$$;

-- Início manual: a tela resolve o público (mesmos filtros de Contatos) e
-- manda a lista final de IDs, então o disparo é sempre "exatamente essas N
-- pessoas, agora" — sem risco do filtro mudar de sentido entre escolher e
-- confirmar.
create or replace function public.start_cadence(p_cadence_id uuid, p_contact_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact_id uuid;
  v_count integer := 0;
begin
  foreach v_contact_id in array coalesce(p_contact_ids, '{}') loop
    if public.enroll_contact_in_cadence(p_cadence_id, v_contact_id, null, 'manual') is not null then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

grant execute on function public.contact_matches_filters(uuid, jsonb) to authenticated;
grant execute on function public.enroll_contact_in_cadence(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.start_cadence(uuid, uuid[]) to authenticated;

-- Gatilho: novo contato criado.
create or replace function public.handle_contact_created_cadences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cadence record;
begin
  for v_cadence in
    select id from public.cadences
    where organization_id = new.organization_id and active and trigger_type = 'contact_created'
  loop
    if public.contact_matches_filters(new.id, (select audience_filters from public.cadences where id = v_cadence.id)) then
      perform public.enroll_contact_in_cadence(v_cadence.id, new.id, null, 'contact_created');
    end if;
  end loop;
  return new;
end;
$$;

create trigger cadence_contact_created_trigger
  after insert on public.contacts
  for each row execute function public.handle_contact_created_cadences();

-- Gatilho: tag adicionada a um contato.
create or replace function public.handle_tag_added_cadences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tag_name text;
  v_cadence record;
begin
  select name into v_tag_name from public.tags where id = new.tag_id;
  if v_tag_name is null then
    return new;
  end if;

  for v_cadence in
    select id, audience_filters from public.cadences
    where organization_id = new.organization_id and active and trigger_type = 'tag_added'
      and trigger_config->>'tag' = v_tag_name
  loop
    if public.contact_matches_filters(new.contact_id, v_cadence.audience_filters) then
      perform public.enroll_contact_in_cadence(v_cadence.id, new.contact_id, null, 'tag_added');
    end if;
  end loop;
  return new;
end;
$$;

create trigger cadence_tag_added_trigger
  after insert on public.contact_tags
  for each row execute function public.handle_tag_added_cadences();

-- Gatilho: oportunidade muda de estágio (ex.: "retorno sobre proposta" =
-- entrar em "Proposta enviada"). Quando o estágio muda de novo antes da
-- cadência terminar, cancela as mensagens ainda pendentes daquela
-- matrícula — evita mandar "responda a proposta" depois que a pessoa já
-- respondeu/avançou.
create or replace function public.handle_stage_changed_cadences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cadence record;
  v_enrollment record;
begin
  for v_enrollment in
    select ce.id, ce.cadence_id from public.cadence_enrollments ce
    join public.cadences c on c.id = ce.cadence_id
    where ce.opportunity_id = new.id and ce.status = 'active'
      and c.trigger_type = 'stage_changed' and c.trigger_config->>'stage' = old.stage
  loop
    update public.cadence_enrollments
      set status = 'cancelled', cancelled_reason = 'Estágio da oportunidade mudou'
      where id = v_enrollment.id;
    update public.automation_queue
      set status = 'blocked', last_error = 'Cadência cancelada: estágio da oportunidade mudou'
      where status = 'pending' and metadata->>'enrollment_id' = v_enrollment.id::text;
  end loop;

  for v_cadence in
    select id, audience_filters from public.cadences
    where organization_id = new.organization_id and active and trigger_type = 'stage_changed'
      and trigger_config->>'stage' = new.stage
  loop
    if public.contact_matches_filters(new.contact_id, v_cadence.audience_filters) then
      perform public.enroll_contact_in_cadence(v_cadence.id, new.contact_id, new.id, 'stage_changed');
    end if;
  end loop;
  return new;
end;
$$;

create trigger cadence_stage_changed_trigger
  after update on public.opportunities
  for each row
  when (new.stage is distinct from old.stage)
  execute function public.handle_stage_changed_cadences();

-- Varredura de inatividade: não é um evento, é uma passagem de tempo, então
-- roda periodicamente (chamada pelo próprio crm-automation, que já é
-- invocado de tempos em tempos por um agendador externo) em vez de precisar
-- de um cron novo. Matricula só uma vez por contato por cadência (não
-- reabre depois de cancelada/concluída), pra não reenviar o mesmo lembrete
-- de "sumiu" repetidamente.
create or replace function public.run_inactivity_cadence_scan()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cadence record;
  v_contact record;
  v_count integer := 0;
begin
  for v_cadence in
    select * from public.cadences
    where active and trigger_type = 'inactivity_days'
  loop
    for v_contact in
      select c.id from public.contacts c
      where c.organization_id = v_cadence.organization_id
        and not exists (
          select 1 from public.cadence_enrollments ce
          where ce.cadence_id = v_cadence.id and ce.contact_id = c.id
        )
        and coalesce(
          (select max(a.created_at) from public.activities a where a.contact_id = c.id),
          c.created_at
        ) < now() - make_interval(days => coalesce((v_cadence.trigger_config->>'days')::int, 7))
        and public.contact_matches_filters(c.id, v_cadence.audience_filters)
    loop
      if public.enroll_contact_in_cadence(v_cadence.id, v_contact.id, null, 'inactivity_days') is not null then
        v_count := v_count + 1;
      end if;
    end loop;
  end loop;
  return v_count;
end;
$$;
