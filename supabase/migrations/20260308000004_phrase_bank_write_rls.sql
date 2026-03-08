-- ============================================================
-- Phrase bank write policies
-- Authenticated users can create, update and delete phrase bank
-- entries. For MVP there is no per-user ownership on phrases
-- (they are shared across the firm). Restricting to per-user
-- can be added later without breaking the existing select policy.
-- ============================================================

create policy "Authenticated users can insert phrases"
  on public.phrase_bank_entries for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update phrases"
  on public.phrase_bank_entries for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete phrases"
  on public.phrase_bank_entries for delete
  to authenticated
  using (true);
