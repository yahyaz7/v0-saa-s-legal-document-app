-- =========================================
-- 13. GENERATED DOCUMENTS
-- =========================================
create table generated_documents (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null,
    file_path text not null,
    generated_by uuid,
    generated_at timestamptz default now(),

    constraint fk_generated_documents_document
        foreign key (document_id)
        references documents(id)
        on delete cascade,

    constraint fk_generated_documents_user
        foreign key (generated_by)
        references users(id)
);

create index idx_generated_documents_document
on generated_documents(document_id);
