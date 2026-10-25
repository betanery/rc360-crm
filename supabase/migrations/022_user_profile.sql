-- Perfil do usuário: foto, cargo, telefone, assinatura e preferências de
-- notificação. Também fecha uma brecha: pela política atual qualquer usuário
-- podia alterar o próprio cargo (role) ou organização.

alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists job_title text,
  add column if not exists phone text,
  add column if not exists signature text,
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() nulo = service role / SQL do projeto (convites, manutenção).
  if (new.role is distinct from old.role
      or new.organization_id is distinct from old.organization_id)
     and auth.uid() is not null
     and not public.is_org_admin(old.organization_id) then
    raise exception 'Apenas administradores podem alterar cargo de acesso ou organização.';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- Fotos de perfil: leitura pública (aparecem no cabeçalho), escrita só na
-- própria pasta {user_id}/.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars own insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars own update" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars own delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
