-- =========================================
-- 7. TEMPLATE FIELD OPTIONS
-- =========================================
create table template_field_options (
    id uuid primary key default gen_random_uuid(),
    template_field_id uuid not null,
    option_label varchar(255) not null,
    option_value varchar(255) not null,
    option_order integer default 0,

    constraint fk_field_options_field
        foreign key (template_field_id)
        references template_fields(id)
        on delete cascade
);

create index idx_template_field_options_field
on template_field_options(template_field_id);
