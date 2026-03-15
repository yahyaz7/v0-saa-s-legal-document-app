-- =========================================
-- 6. TEMPLATE FIELDS
-- =========================================
create table template_fields (
    id uuid primary key default gen_random_uuid(),
    template_version_id uuid not null,
    field_key varchar(255) not null,
    field_label varchar(255) not null,
    field_type varchar(50) not null,
    field_order integer default 0,
    is_required boolean default false,
    placeholder text,
    help_text text,
    created_at timestamptz default now(),

    constraint fk_template_fields_version
        foreign key (template_version_id)
        references template_versions(id)
        on delete cascade,

    constraint unique_field_key
        unique(template_version_id, field_key)
);

create index idx_template_fields_version
on template_fields(template_version_id);
