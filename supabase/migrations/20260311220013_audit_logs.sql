-- =========================================
-- 14. AUDIT LOGS
-- =========================================
create table audit_logs (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null,
    user_id uuid,
    action varchar(100) not null,
    entity_type varchar(100),
    entity_id uuid,
    metadata_json jsonb,
    created_at timestamptz default now(),

    constraint fk_audit_logs_firm
        foreign key (firm_id)
        references firms(id)
        on delete cascade,

    constraint fk_audit_logs_user
        foreign key (user_id)
        references users(id)
);

create index idx_audit_logs_firm
on audit_logs(firm_id);
