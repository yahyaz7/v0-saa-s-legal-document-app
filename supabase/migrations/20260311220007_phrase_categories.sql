-- =========================================
-- 8. PHRASE CATEGORIES
-- =========================================
create table phrase_categories (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null,
    name varchar(255) not null,
    created_at timestamptz default now(),

    constraint fk_phrase_categories_firm
        foreign key (firm_id)
        references firms(id)
        on delete cascade
);

create index idx_phrase_categories_firm
on phrase_categories(firm_id);
