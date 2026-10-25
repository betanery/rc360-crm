-- A Roberta já tinha cadastrado os três pacotes de análise comportamental
-- (START / PRÓ / MASTER), sem preço. A migration 019 criou cópias com os
-- dados completos. Aqui os dados passam para os produtos dela (que já estão
-- em uso) e as cópias, se ninguém usa, são removidas.

do $$
declare
  pair record;
begin
  for pair in
    select * from (values
      ('START - Autoconhecimento', 'Análise Comportamental – Start'),
      ('PRÓ - Conexão de Perfis', 'Análise Comportamental – Pró'),
      ('MASTER - DNA Organizacional', 'Análise Comportamental – Master')
    ) as t(hers, seeded)
  loop
    update public.products h
    set template = s.template,
        price = s.price,
        audience = s.audience,
        summary = s.summary,
        deliverables = s.deliverables,
        format = s.format,
        participants = s.participants,
        duration = s.duration,
        validity_days = s.validity_days,
        payment_terms = s.payment_terms,
        notes = s.notes
    from public.products s
    where h.name = pair.hers
      and s.name = pair.seeded
      and s.organization_id = h.organization_id
      and h.price is null
      and jsonb_array_length(h.deliverables) = 0;

    delete from public.products s
    where s.name = pair.seeded
      and exists (
        select 1 from public.products h
        where h.organization_id = s.organization_id and h.name = pair.hers and h.price is not null
      )
      and not exists (select 1 from public.contacts where organization_id = s.organization_id and product = s.name)
      and not exists (select 1 from public.opportunities where organization_id = s.organization_id and product = s.name)
      and not exists (select 1 from public.cart_recoveries where organization_id = s.organization_id and product = s.name)
      and not exists (select 1 from public.events where organization_id = s.organization_id and product = s.name);
  end loop;
end $$;
