-- ============================================================
-- LegalDocs Pro — Initial Schema
-- ============================================================

-- ------------------------------------------------------------
-- templates
-- Stores template definitions (e.g. Magistrates Attendance Note)
-- ------------------------------------------------------------
create table if not exists public.templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  category    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- template_fields
-- Stores field definitions for each template.
-- field_type: text | textarea | select | date | repeater
-- options: JSON array of strings, used when field_type = 'select'
--   e.g. ["Guilty", "Not Guilty", "No Plea"]
-- repeater_fields: JSON array of sub-field objects, used when
--   field_type = 'repeater', e.g. for Offences rows
--   e.g. [{"key":"offence","label":"Offence","type":"text"}, ...]
-- ------------------------------------------------------------
create table if not exists public.template_fields (
  id               uuid primary key default gen_random_uuid(),
  template_id      uuid not null references public.templates(id) on delete cascade,
  field_key        text not null,           -- snake_case, matches DOCX placeholder
  label            text not null,           -- display label shown in form
  field_type       text not null            -- text | textarea | select | date | repeater
                   check (field_type in ('text', 'textarea', 'select', 'date', 'repeater')),
  section          text not null,           -- section heading, e.g. 'Header', 'Offences'
  section_order    integer not null default 0, -- controls section display order
  field_order      integer not null default 0, -- controls field order within section
  required         boolean not null default false,
  options          jsonb,                   -- for select: ["Option A", "Option B"]
  repeater_fields  jsonb,                   -- for repeater: [{key, label, type}, ...]
  created_at       timestamptz not null default now(),
  unique (template_id, field_key)
);

-- ------------------------------------------------------------
-- phrase_bank_entries
-- Reusable legal phrases, linked to a template and optional field.
-- ------------------------------------------------------------
create table if not exists public.phrase_bank_entries (
  id               uuid primary key default gen_random_uuid(),
  template_id      uuid references public.templates(id) on delete set null,
  field_key        text,                    -- optional: ties phrase to a specific field
  title            text not null,
  content          text not null,
  offence_tags     text[] not null default '{}',
  stage            text,                    -- e.g. 'Sentencing', 'Pre-sentence'
  category         text,                    -- e.g. 'Mitigation', 'Character'
  trigger_keywords text[] not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- saved_form_drafts
-- Stores form data as JSON against a user and template.
-- A user may have multiple drafts per template.
-- ------------------------------------------------------------
create table if not exists public.saved_form_drafts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.templates(id) on delete cascade,
  form_data   jsonb not null default '{}',  -- full form values keyed by field_key
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- generated_documents
-- Metadata for DOCX files generated from a draft.
-- file_path: storage path within Supabase Storage bucket
-- file_url: public download URL (set after upload)
-- ------------------------------------------------------------
create table if not exists public.generated_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.templates(id) on delete cascade,
  draft_id    uuid references public.saved_form_drafts(id) on delete set null,
  file_name   text not null,               -- e.g. "magistrates-note-smith-2026-03-08.docx"
  file_path   text,                        -- storage path, e.g. "documents/user-id/file.docx"
  file_url    text,                        -- public URL after upload
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists template_fields_template_id_idx
  on public.template_fields(template_id);

create index if not exists phrase_bank_entries_template_id_idx
  on public.phrase_bank_entries(template_id);

create index if not exists saved_form_drafts_user_id_idx
  on public.saved_form_drafts(user_id);

create index if not exists saved_form_drafts_template_id_idx
  on public.saved_form_drafts(template_id);

create index if not exists generated_documents_user_id_idx
  on public.generated_documents(user_id);

create index if not exists generated_documents_draft_id_idx
  on public.generated_documents(draft_id);

-- ============================================================
-- updated_at auto-update trigger
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_templates_updated_at
  before update on public.templates
  for each row execute function public.set_updated_at();

create trigger set_phrase_bank_entries_updated_at
  before update on public.phrase_bank_entries
  for each row execute function public.set_updated_at();

create trigger set_saved_form_drafts_updated_at
  before update on public.saved_form_drafts
  for each row execute function public.set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.templates          enable row level security;
alter table public.template_fields    enable row level security;
alter table public.phrase_bank_entries enable row level security;
alter table public.saved_form_drafts  enable row level security;
alter table public.generated_documents enable row level security;

-- templates and template_fields: readable by all authenticated users
create policy "Authenticated users can read templates"
  on public.templates for select
  to authenticated
  using (true);

create policy "Authenticated users can read template fields"
  on public.template_fields for select
  to authenticated
  using (true);

-- phrase_bank_entries: readable by all authenticated users
create policy "Authenticated users can read phrase bank"
  on public.phrase_bank_entries for select
  to authenticated
  using (true);

-- saved_form_drafts: users can only access their own drafts
create policy "Users can read own drafts"
  on public.saved_form_drafts for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own drafts"
  on public.saved_form_drafts for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own drafts"
  on public.saved_form_drafts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own drafts"
  on public.saved_form_drafts for delete
  to authenticated
  using (auth.uid() = user_id);

-- generated_documents: users can only access their own records
create policy "Users can read own generated documents"
  on public.generated_documents for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own generated documents"
  on public.generated_documents for insert
  to authenticated
  with check (auth.uid() = user_id);
