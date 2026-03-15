-- =========================================
-- INITIAL SEED DATA
-- =========================================

-- 1. Insert Initial Firm
insert into firms (id, name, slug)
values (
    '11111111-1111-1111-1111-111111111111',
    'Gray''s Defence Solicitors',
    'grays-defence'
)
on conflict (slug) do nothing;

-- 2. Insert Admin User
-- The role_id is fetched dynamically by looking up the 'admin' role.
-- The password_hash below is a bcrypt hash for the password: "password"
insert into users (id, firm_id, role_id, name, email, password_hash, is_active)
values (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    (select id from roles where name = 'admin' limit 1),
    'System Admin',
    'admin@grays-defence.co.uk',
    '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- "password"
    true
)
on conflict (email) do nothing;
