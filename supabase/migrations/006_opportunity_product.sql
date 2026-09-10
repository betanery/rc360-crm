-- Permite que cada oportunidade tenha seu próprio produto, em vez de herdar
-- sempre o produto cadastrado no contato. Isso possibilita múltiplas
-- oportunidades (produtos diferentes) para o mesmo contato.

alter table public.opportunities add column if not exists product text;

update public.opportunities o
set product = c.product
from public.contacts c
where o.contact_id = c.id and o.product is null;

alter table public.opportunities
  add constraint opportunities_product_valid
  check (public.product_exists(organization_id, product));

alter table public.opportunities alter column product set not null;
