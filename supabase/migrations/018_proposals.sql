-- Lista própria de objeções (separada das tags de contato) e propostas em
-- PDF com itens customizados por cliente.

alter table public.tags
  add column if not exists kind text not null default 'tag'
  check (kind in ('tag', 'objection'));

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id()
    references public.organizations(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  contact_id uuid not null,
  template text not null default 'executiva'
    check (template in ('entrada', 'executiva', 'estrategica')),
  -- Conteúdo preenchido na proposta (desafios, entregáveis, valores...).
  content jsonb not null default '{}'::jsonb,
  total numeric(14,2) not null default 0 check (total >= 0),
  valid_until date,
  pdf_path text,
  created_by uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  foreign key (organization_id, contact_id)
    references public.contacts(organization_id, id) on delete cascade
);

create index if not exists proposals_opportunity_idx on public.proposals (opportunity_id);

alter table public.proposals enable row level security;
create policy proposals_org_access on public.proposals
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.proposals to authenticated;

-- Bucket privado: a proposta tem preço de cliente. O CRM grava aqui e a
-- edge function de envio gera um link assinado temporário (service role).
-- Caminho: {organization_id}/{opportunity_id}/{proposal_id}.pdf
insert into storage.buckets (id, name, public)
values ('proposals', 'proposals', false)
on conflict (id) do nothing;

create policy "proposals org read" on storage.objects
  for select using (
    bucket_id = 'proposals'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy "proposals org insert" on storage.objects
  for insert with check (
    bucket_id = 'proposals'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

create policy "proposals org delete" on storage.objects
  for delete using (
    bucket_id = 'proposals'
    and public.is_org_member(((storage.foldername(name))[1])::uuid)
  );
