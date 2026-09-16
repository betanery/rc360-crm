-- Adiciona o campo Instagram, presente na planilha de controle de leads que
-- a Roberta usava antes do CRM mas ainda não existia aqui.

alter table public.contacts add column if not exists instagram text;
