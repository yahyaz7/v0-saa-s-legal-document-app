-- =========================================
-- 2. ROLES
-- =========================================
create table roles (
    id uuid primary key default gen_random_uuid(),
    name varchar(50) unique not null,
    description text,
    created_at timestamptz default now()
);
