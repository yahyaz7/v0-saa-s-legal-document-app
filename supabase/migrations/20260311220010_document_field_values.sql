-- =========================================
-- 11. DOCUMENT FIELD VALUES
-- =========================================
create table document_field_values (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null,
    template_field_id uuid not null,
    value_text text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),

    constraint fk_document_values_document
        foreign key (document_id)
        references documents(id)
        on delete cascade,

    constraint fk_document_values_field
        foreign key (template_field_id)
        references template_fields(id)
);

create index idx_document_values_document
on document_field_values(document_id);
