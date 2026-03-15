-- =========================================
-- 12. DOCUMENT VERSIONS
-- =========================================
create table document_versions (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null,
    version_number integer not null,
    data_snapshot_json jsonb not null,
    created_by uuid,
    created_at timestamptz default now(),

    constraint fk_document_versions_document
        foreign key (document_id)
        references documents(id)
        on delete cascade,

    constraint fk_document_versions_user
        foreign key (created_by)
        references users(id),

    constraint unique_document_version
        unique(document_id, version_number)
);

create index idx_document_versions_document
on document_versions(document_id);
