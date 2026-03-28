-- Add logo_url to firms table
-- Super-admin can upload a logo per firm, displayed in the admin shell.
alter table firms add column if not exists logo_url text;

-- Storage bucket for firm logos (public read so logos load without auth)
insert into storage.buckets (id, name, public)
values ('firm-logos', 'firm-logos', true)
on conflict (id) do nothing;

-- Super-admin can upload/delete logos
create policy "super_admin_logo_upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'firm-logos'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

create policy "super_admin_logo_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'firm-logos'
    and (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- Anyone authenticated can read logos (needed for admin shell display)
create policy "authenticated_logo_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'firm-logos');
