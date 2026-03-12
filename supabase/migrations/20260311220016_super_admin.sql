-- =========================================
-- 17. SUPER ADMIN ROLE + SCHEMA ADJUSTMENTS
-- =========================================

-- Add super_admin role (sits above all firms)
insert into roles (name, description)
values ('super_admin', 'Platform super administrator — full cross-firm access')
on conflict (name) do nothing;

-- Make firm_id nullable on users so super_admin can exist without a firm
alter table users
    alter column firm_id drop not null;

-- Relax firm_id constraint: allow null (super_admin has no firm)
-- The existing FK constraint remains for non-null values, which is correct
