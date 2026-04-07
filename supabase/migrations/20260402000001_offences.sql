create table if not exists public.offences (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default '',   -- e.g. "Violence", "Theft", "Drug Offences"
  type        text not null default '',   -- e.g. "Either Way", "Summary Only", "Indictable Only"
  offence     text not null,              -- e.g. "Theft Act 1968 s.1 — Theft"
  uploaded_by uuid references public.users(id) on delete set null,
  created_at  timestamptz default now()
);

-- Indexes for fast search and filtering
create index if not exists idx_offences_category on public.offences(category);
create index if not exists idx_offences_type     on public.offences(type);

-- Enable RLS
alter table public.offences enable row level security;

-- Any authenticated user can read (staff need to search offences when filling forms)
create policy "offences_read" on public.offences
  for select to authenticated
  using (true);

-- Only admins and super_admins can insert
create policy "offences_insert" on public.offences
  for insert to authenticated
  with check (is_firm_admin() or is_super_admin());

-- Only admins and super_admins can update
create policy "offences_update" on public.offences
  for update to authenticated
  using  (is_firm_admin() or is_super_admin())
  with check (is_firm_admin() or is_super_admin());

-- Only admins and super_admins can delete
create policy "offences_delete" on public.offences
  for delete to authenticated
  using  (is_firm_admin() or is_super_admin());
