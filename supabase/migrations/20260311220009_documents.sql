-- =========================================
-- 10. DOCUMENTS
-- =========================================
create table documents (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null,
    template_id uuid not null,
    template_version_id uuid not null,
    created_by uuid,
    title varchar(255),
    status varchar(50) default 'draft',
    created_at timestamptz default now(),
    updated_at timestamptz default now(),

    constraint fk_documents_firm
        foreign key (firm_id)
        references firms(id)
        on delete cascade,

    constraint fk_documents_template
        foreign key (template_id)
        references templates(id),

    constraint fk_documents_template_version
        foreign key (template_version_id)
        references template_versions(id),

    constraint fk_documents_user
        foreign key (created_by)
        references users(id)
);

create index idx_documents_template
on documents(template_id);

create index idx_documents_creator
on documents(created_by);

create index idx_documents_firm
on documents(firm_id);
