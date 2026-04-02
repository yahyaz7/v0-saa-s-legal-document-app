-- =========================================
-- SAVED FORM DRAFTS
-- Lightweight JSON draft store. One row per
-- save; user_id = auth.uid() via RLS.
-- =========================================

create table if not exists saved_form_drafts (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null,
    template_id uuid not null,
    form_data   jsonb not null default '{}',
    created_at  timestamptz default now(),
    updated_at  timestamptz default now(),

    constraint fk_drafts_user
        foreign key (user_id)
        references users(id)
        on delete cascade,

    constraint fk_drafts_template
        foreign key (template_id)
        references templates(id)
        on delete cascade
);

create index if not exists idx_drafts_user       on saved_form_drafts(user_id);
create index if not exists idx_drafts_template   on saved_form_drafts(template_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table saved_form_drafts enable row level security;

-- Each user owns their own drafts (staff + admin creating docs for themselves)
create policy "own_drafts_all" on saved_form_drafts
    for all to authenticated
    using  (user_id = auth.uid())
    with check (user_id = auth.uid());

-- Firm admins can read all drafts within their firm (for oversight)
create policy "admin_read_firm_drafts" on saved_form_drafts
    for select to authenticated
    using (
        (is_firm_admin() or is_super_admin())
        and user_id in (
            select id from users where firm_id = get_my_firm_id()
        )
    );

-- Super-admin full access
create policy "super_admin_drafts_all" on saved_form_drafts
    for all to authenticated
    using (is_super_admin())
    with check (is_super_admin());

-- Auto-update updated_at on row update
create or replace function update_saved_form_drafts_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger trg_drafts_updated_at
    before update on saved_form_drafts
    for each row execute function update_saved_form_drafts_updated_at();
