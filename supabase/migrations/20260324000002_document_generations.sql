-- =========================================
-- DOCUMENT GENERATIONS
-- Tracks every DOCX download event.
-- Lightweight — no FK to documents table
-- so it works with both draft-based and
-- full-document flows.
-- =========================================

create table if not exists document_generations (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null,
    template_id  uuid not null,
    draft_id     uuid,           -- optional: which saved_form_drafts row triggered this
    generated_at timestamptz default now(),

    constraint fk_docgen_user
        foreign key (user_id)
        references users(id),

    constraint fk_docgen_template
        foreign key (template_id)
        references templates(id)
        on delete cascade
);

create index if not exists idx_docgen_user       on document_generations(user_id);
create index if not exists idx_docgen_template   on document_generations(template_id);
create index if not exists idx_docgen_generated  on document_generations(generated_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table document_generations enable row level security;

-- Users can read their own generation history
create policy "own_generations_read" on document_generations
    for select to authenticated
    using (user_id = auth.uid());

-- Firm admins can read all generations within their firm
create policy "admin_read_firm_generations" on document_generations
    for select to authenticated
    using (
        (is_firm_admin() or is_super_admin())
        and user_id in (
            select id from users where firm_id = get_my_firm_id()
        )
    );

-- Inserts happen via service-role (admin client) on the server — no client insert policy needed
