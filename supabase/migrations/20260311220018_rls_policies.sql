-- =========================================
-- 19. ROW LEVEL SECURITY — HELPER FUNCTIONS + POLICIES
--
-- Role hierarchy:
--   super_admin  → sees and manages everything, no firm restriction
--   admin        → manages users/templates/data within their firm
--   staff        → reads and writes their firm's data, owns their own docs
--
-- Role and firm_id are stored in JWT app_metadata, set at user creation
-- via auth.admin.createUser(). No extra DB query needed in policies.
-- =========================================


-- =========================================
-- HELPER FUNCTIONS
-- =========================================

-- Returns the current user's firm_id from their JWT
create or replace function public.get_my_firm_id()
returns uuid
language sql
security definer
stable
as $$
  select (auth.jwt() -> 'app_metadata' ->> 'firm_id')::uuid;
$$;

-- Returns the current user's role string from their JWT
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
as $$
  select auth.jwt() -> 'app_metadata' ->> 'role';
$$;

-- Convenience boolean checks
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
as $$
  select (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin';
$$;

create or replace function public.is_firm_admin()
returns boolean
language sql
security definer
stable
as $$
  select (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';
$$;


-- =========================================
-- ENABLE RLS ON ALL TABLES
-- =========================================

alter table firms                  enable row level security;
alter table roles                  enable row level security;
alter table users                  enable row level security;
alter table templates              enable row level security;
alter table template_versions      enable row level security;
alter table template_fields        enable row level security;
alter table template_field_options enable row level security;
alter table phrase_categories      enable row level security;
alter table phrases                enable row level security;
alter table documents              enable row level security;
alter table document_field_values  enable row level security;
alter table document_versions      enable row level security;
alter table generated_documents    enable row level security;
alter table audit_logs             enable row level security;


-- =========================================
-- FIRMS
-- super_admin: full access
-- others: read their own firm only
-- =========================================

create policy "super_admin_firms_all" on firms
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

create policy "users_read_own_firm" on firms
  for select to authenticated
  using (id = get_my_firm_id());


-- =========================================
-- ROLES (read-only for all authenticated)
-- =========================================

create policy "authenticated_read_roles" on roles
  for select to authenticated
  using (true);


-- =========================================
-- USERS
-- super_admin: full access across all firms
-- admin: manage users within their own firm
-- all:  read users in their own firm, update themselves
-- =========================================

create policy "super_admin_users_all" on users
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

create policy "admin_manage_firm_users" on users
  for all to authenticated
  using  (is_firm_admin() and firm_id = get_my_firm_id())
  with check (is_firm_admin() and firm_id = get_my_firm_id());

create policy "users_read_same_firm" on users
  for select to authenticated
  using (firm_id = get_my_firm_id());

create policy "users_update_self" on users
  for update to authenticated
  using  (id = auth.uid())
  with check (id = auth.uid());


-- =========================================
-- TEMPLATES
-- super_admin: full access
-- others: scoped to their firm
-- =========================================

create policy "super_admin_templates_all" on templates
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

create policy "firm_templates" on templates
  for all to authenticated
  using  (firm_id = get_my_firm_id())
  with check (firm_id = get_my_firm_id());


-- =========================================
-- TEMPLATE_VERSIONS
-- =========================================

create policy "super_admin_template_versions_all" on template_versions
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

create policy "firm_template_versions" on template_versions
  for all to authenticated
  using (
    template_id in (
      select id from templates where firm_id = get_my_firm_id()
    )
  )
  with check (
    template_id in (
      select id from templates where firm_id = get_my_firm_id()
    )
  );


-- =========================================
-- TEMPLATE_FIELDS
-- =========================================

create policy "super_admin_template_fields_all" on template_fields
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

create policy "firm_template_fields" on template_fields
  for all to authenticated
  using (
    template_version_id in (
      select tv.id
      from template_versions tv
      join templates t on t.id = tv.template_id
      where t.firm_id = get_my_firm_id()
    )
  )
  with check (
    template_version_id in (
      select tv.id
      from template_versions tv
      join templates t on t.id = tv.template_id
      where t.firm_id = get_my_firm_id()
    )
  );


-- =========================================
-- TEMPLATE_FIELD_OPTIONS
-- =========================================

create policy "super_admin_field_options_all" on template_field_options
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

create policy "firm_field_options" on template_field_options
  for all to authenticated
  using (
    template_field_id in (
      select tf.id
      from template_fields tf
      join template_versions tv on tv.id = tf.template_version_id
      join templates t on t.id = tv.template_id
      where t.firm_id = get_my_firm_id()
    )
  )
  with check (
    template_field_id in (
      select tf.id
      from template_fields tf
      join template_versions tv on tv.id = tf.template_version_id
      join templates t on t.id = tv.template_id
      where t.firm_id = get_my_firm_id()
    )
  );


-- =========================================
-- PHRASE_CATEGORIES
-- =========================================

create policy "super_admin_phrase_categories_all" on phrase_categories
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

create policy "firm_phrase_categories" on phrase_categories
  for all to authenticated
  using  (firm_id = get_my_firm_id())
  with check (firm_id = get_my_firm_id());


-- =========================================
-- PHRASES
-- =========================================

create policy "super_admin_phrases_all" on phrases
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

create policy "firm_phrases" on phrases
  for all to authenticated
  using (
    category_id in (
      select id from phrase_categories where firm_id = get_my_firm_id()
    )
  )
  with check (
    category_id in (
      select id from phrase_categories where firm_id = get_my_firm_id()
    )
  );


-- =========================================
-- DOCUMENTS
-- =========================================

create policy "super_admin_documents_all" on documents
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

create policy "firm_documents" on documents
  for all to authenticated
  using  (firm_id = get_my_firm_id())
  with check (firm_id = get_my_firm_id());


-- =========================================
-- DOCUMENT_FIELD_VALUES
-- =========================================

create policy "super_admin_field_values_all" on document_field_values
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

create policy "firm_field_values" on document_field_values
  for all to authenticated
  using (
    document_id in (
      select id from documents where firm_id = get_my_firm_id()
    )
  )
  with check (
    document_id in (
      select id from documents where firm_id = get_my_firm_id()
    )
  );


-- =========================================
-- DOCUMENT_VERSIONS
-- =========================================

create policy "super_admin_doc_versions_all" on document_versions
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

create policy "firm_doc_versions" on document_versions
  for all to authenticated
  using (
    document_id in (
      select id from documents where firm_id = get_my_firm_id()
    )
  )
  with check (
    document_id in (
      select id from documents where firm_id = get_my_firm_id()
    )
  );


-- =========================================
-- GENERATED_DOCUMENTS
-- =========================================

create policy "super_admin_generated_docs_all" on generated_documents
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

create policy "firm_generated_docs" on generated_documents
  for all to authenticated
  using (
    document_id in (
      select id from documents where firm_id = get_my_firm_id()
    )
  )
  with check (
    document_id in (
      select id from documents where firm_id = get_my_firm_id()
    )
  );


-- =========================================
-- AUDIT_LOGS
-- super_admin: read all
-- others: read their own firm's logs only
-- writes happen via service role (server-side), not from client
-- =========================================

create policy "super_admin_audit_all" on audit_logs
  for all to authenticated
  using (is_super_admin())
  with check (is_super_admin());

create policy "firm_audit_read" on audit_logs
  for select to authenticated
  using (firm_id = get_my_firm_id());
