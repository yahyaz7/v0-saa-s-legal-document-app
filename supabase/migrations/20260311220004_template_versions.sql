-- =========================================
-- 5. TEMPLATE VERSIONS
-- =========================================
create table template_versions (
    id uuid primary key default gen_random_uuid(),
    template_id uuid not null,
    version_number integer not null,
    docx_template_path text not null,
    is_active boolean default true,
    created_by uuid,
    created_at timestamptz default now(),

    constraint fk_template_versions_template
        foreign key (template_id)
        references templates(id)
        on delete cascade,

    constraint fk_template_versions_user
        foreign key (created_by)
        references users(id),

    constraint unique_template_version
        unique(template_id, version_number)
);

create index idx_template_versions_template
on template_versions(template_id);
