-- Libera o cadastro de produtos: contacts.product e cart_recoveries.product
-- deixam de estar presos aos 3 nomes fixos e passam a aceitar qualquer
-- produto ativo cadastrado em public.products pela própria organização.
--
-- Esta migration precisa ser aplicada manualmente (SQL Editor do Supabase ou
-- `supabase db push`) por quem tiver acesso administrativo ao projeto.

create or replace function public.product_exists(target_org uuid, target_product text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.products
    where organization_id = target_org and name = target_product
  )
$$;

grant execute on function public.product_exists(uuid, text) to authenticated;

alter table public.contacts drop constraint if exists contacts_product_check;
alter table public.contacts
  add constraint contacts_product_valid
  check (public.product_exists(organization_id, product));

alter table public.cart_recoveries drop constraint if exists cart_recoveries_product_check;
alter table public.cart_recoveries
  add constraint cart_recoveries_product_valid
  check (public.product_exists(organization_id, product));
