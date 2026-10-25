-- Cadastro de produto completo (preço, público, entregáveis, condições) para
-- a proposta em PDF nascer preenchida, e bloqueio de renomear produto em uso
-- (o nome é a chave em contatos, oportunidades, recuperação e eventos).

alter table public.products
  add column if not exists template text not null default 'executiva'
    check (template in ('entrada', 'executiva', 'estrategica')),
  add column if not exists price numeric(14,2) check (price is null or price >= 0),
  add column if not exists audience text,
  add column if not exists summary text,
  add column if not exists deliverables jsonb not null default '[]'::jsonb,
  add column if not exists format text,
  add column if not exists participants text,
  add column if not exists duration text,
  add column if not exists validity_days integer not null default 15
    check (validity_days > 0),
  add column if not exists payment_terms text,
  add column if not exists notes text;

create or replace function public.block_product_rename()
returns trigger
language plpgsql
as $$
begin
  if new.name is distinct from old.name and (
    exists (select 1 from public.contacts where organization_id = old.organization_id and product = old.name)
    or exists (select 1 from public.opportunities where organization_id = old.organization_id and product = old.name)
    or exists (select 1 from public.cart_recoveries where organization_id = old.organization_id and product = old.name)
    or exists (select 1 from public.events where organization_id = old.organization_id and product = old.name)
  ) then
    raise exception 'Produto em uso: desative-o e crie outro com o novo nome.';
  end if;
  return new;
end $$;

drop trigger if exists products_block_rename on public.products;
create trigger products_block_rename
  before update of name on public.products
  for each row execute function public.block_product_rename();

-- Pacotes do documento "Venda Assessment" (análise comportamental).
insert into public.products (
  organization_id, name, active, template, price, audience, summary,
  deliverables, format, participants, duration, validity_days, payment_terms, notes
)
select
  o.id, p.name, true, p.template, p.price, p.audience, p.summary,
  p.deliverables::jsonb, 'Online; presencial sob consulta', p.participants, p.duration,
  15, p.payment_terms, p.notes
from public.organizations o
cross join (values
  (
    'Análise Comportamental – Start', 'entrada', 297.00,
    'Empresários e líderes que desejam conhecer seu perfil.',
    'Autoconhecimento: relatório comportamental completo, devolutiva individual de 60 minutos e orientações práticas sobre comunicação, liderança, decisões e relacionamento profissional.',
    '[{"name":"Relatório comportamental individual","qty":"1","criteria":"Análise de características comportamentais, fatores motivacionais, tendências de atuação, comunicação e relacionamento."},{"name":"Devolutiva personalizada","qty":"1","criteria":"Encontro individual de 60 minutos para interpretação dos resultados e esclarecimento das principais características identificadas."},{"name":"Recomendações práticas","qty":"1","criteria":"Orientações para utilizar suas forças, desenvolver pontos de atenção e aprimorar relacionamentos e decisões."}]',
    '1 pessoa', 'Devolutiva de 60 minutos',
    'Antecipado, via Pix ou cartão',
    'O valor corresponde ao pacote individual com relatório e devolutiva de 60 minutos.'
  ),
  (
    'Análise Comportamental – Pró', 'executiva', 897.00,
    'Sócios, gestores e duplas profissionais que desejam trabalhar melhor juntos.',
    'Conexão de Perfis: dois relatórios, duas devolutivas individuais e um encontro conjunto dedicado a complementaridades, diferenças, comunicação e alinhamento profissional.',
    '[{"name":"Relatórios comportamentais individuais","qty":"2","criteria":"Um relatório para cada participante."},{"name":"Devolutivas individuais","qty":"2","criteria":"60 minutos cada."},{"name":"Análise comparativa dos perfis","qty":"1","criteria":"Análise da dupla."},{"name":"Devolutiva conjunta","qty":"1","criteria":"60 minutos, com recomendações práticas para a dupla."}]',
    '2 pessoas', '3 horas de reuniões no total',
    'Antecipado, via Pix ou cartão',
    null
  ),
  (
    'Análise Comportamental – Master', 'executiva', 1997.00,
    'Empresas que desejam compreender o comportamento coletivo da equipe.',
    'DNA Organizacional: cinco análises comportamentais, relatório DNA Organizacional e devolutiva estratégica coletiva. Não inclui devolutivas individuais.',
    '[{"name":"Relatórios comportamentais individuais","qty":"5","criteria":"Um para cada participante, até 5 pessoas."},{"name":"Relatório DNA Organizacional","qty":"1","criteria":"Tendências do grupo, competências, motivadores, estilos de liderança e oportunidades de desenvolvimento."},{"name":"Análise comparativa dos perfis","qty":"1","criteria":"Análise da equipe."},{"name":"Devolutiva conjunta","qty":"1","criteria":"120 minutos, com recomendações práticas para o time."}]',
    'Até 5 pessoas', '2 horas de reuniões no total',
    'Conforme proposta e contrato',
    'Não equivale a auditoria de cultura, avaliação de desempenho ou diagnóstico integral da empresa. Participantes adicionais: orçamento complementar.'
  )
) as p(name, template, price, audience, summary, deliverables, participants, duration, payment_terms, notes)
on conflict (organization_id, name) do nothing;
