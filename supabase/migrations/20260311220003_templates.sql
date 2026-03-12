-- =========================================
-- 4. TEMPLATES
-- =========================================
create table templates (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null,
    name varchar(255) not null,
    description text,
    is_active boolean default true,
    created_by uuid,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),

    constraint fk_templates_firm
        foreign key (firm_id)
        references firms(id)
        on delete cascade,

    constraint fk_templates_creator
        foreign key (created_by)
        references users(id)
);

create index idx_templates_firm on templates(firm_id);
