-- =========================================
-- 3. USERS
-- =========================================
create table users (
    id uuid primary key default gen_random_uuid(),
    firm_id uuid not null,
    role_id uuid not null,
    name varchar(255) not null,
    email varchar(255) unique not null,
    password_hash text not null,
    is_active boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),

    constraint fk_users_firm
        foreign key (firm_id)
        references firms(id)
        on delete cascade,

    constraint fk_users_role
        foreign key (role_id)
        references roles(id)
);

create index idx_users_firm on users(firm_id);
create index idx_users_email on users(email);
