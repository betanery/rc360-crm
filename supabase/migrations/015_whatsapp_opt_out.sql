alter table public.contacts
  add column if not exists opt_out_at timestamptz,
  add column if not exists opt_out_reason text;
