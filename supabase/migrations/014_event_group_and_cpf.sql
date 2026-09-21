-- Link do grupo (WhatsApp/Telegram) mostrado na tela de inscrição confirmada
-- e CPF do inscrito, coletado no formulário público do evento.

alter table public.events add column if not exists group_url text;
alter table public.events add column if not exists group_cta text;

alter table public.contacts add column if not exists cpf text;

create index if not exists contacts_cpf_idx on public.contacts (organization_id, cpf);
