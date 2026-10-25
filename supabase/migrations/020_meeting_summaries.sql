-- Resumo de reunião aprovado pela Roberta (a transcrição em si não é
-- guardada) e rascunho de proposta extraído dela.

create table if not exists public.meeting_summaries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id()
    references public.organizations(id) on delete cascade,
  contact_id uuid not null,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  summary text not null,
  proposal_draft jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, contact_id)
    references public.contacts(organization_id, id) on delete cascade
);

create index if not exists meeting_summaries_contact_idx
  on public.meeting_summaries (contact_id, created_at desc);

alter table public.meeting_summaries enable row level security;
create policy meeting_summaries_org_access on public.meeting_summaries
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.meeting_summaries to authenticated;
