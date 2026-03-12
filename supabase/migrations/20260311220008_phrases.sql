-- =========================================
-- 9. PHRASES
-- =========================================
create table phrases (
    id uuid primary key default gen_random_uuid(),
    category_id uuid not null,
    phrase_text text not null,
    created_by uuid,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),

    constraint fk_phrases_category
        foreign key (category_id)
        references phrase_categories(id)
        on delete cascade,

    constraint fk_phrases_creator
        foreign key (created_by)
        references users(id)
);

create index idx_phrases_category
on phrases(category_id);
