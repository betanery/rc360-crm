-- Resumo de prospecção gerado por IA: busca pública (Brave Search) sobre o
-- contato + dados já cadastrados no CRM, resumidos por um modelo de IA.
-- Cada geração vira uma linha nova (histórico simples); a ficha mostra a
-- mais recente.

create table public.lead_ai_research (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  summary text not null,
  sources jsonb not null default '[]'::jsonb,
  model text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index lead_ai_research_contact_idx
  on public.lead_ai_research(contact_id, created_at desc);

alter table public.lead_ai_research enable row level security;
create policy lead_ai_research_org_access on public.lead_ai_research
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.lead_ai_research to authenticated;
