-- =========================================
-- Enable UUID generation
-- =========================================
create extension if not exists "pgcrypto";


-- =========================================
-- 1. FIRMS
-- =========================================
create table firms (
    id uuid primary key default gen_random_uuid(),
    name varchar(255) not null,
    slug varchar(255) unique not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index idx_firms_slug on firms(slug);
