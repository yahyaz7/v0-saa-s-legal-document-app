-- ============================================================
-- Seed Test Users for Development
-- ============================================================
-- NOTE: This creates users directly in auth.users for testing.
-- In production, users should sign up through the normal flow.
-- 
-- Run this in the Supabase SQL Editor after running the profiles migration.
-- ============================================================

-- Test User 1: Admin
insert into auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  role,
  aud,
  created_at,
  updated_at
)
values (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@legaldocs.test',
  crypt('TestPass123!', gen_salt('bf')),
  now(),
  '{"full_name": "Admin User"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now()
)
on conflict (email) do nothing;

-- Test User 2: Fee Earner
insert into auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  role,
  aud,
  created_at,
  updated_at
)
values (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'feeearner@legaldocs.test',
  crypt('TestPass123!', gen_salt('bf')),
  now(),
  '{"full_name": "John Gray"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now()
)
on conflict (email) do nothing;

-- Test User 3: Regular User
insert into auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  role,
  aud,
  created_at,
  updated_at
)
values (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'user@legaldocs.test',
  crypt('TestPass123!', gen_salt('bf')),
  now(),
  '{"full_name": "Sarah Smith"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now()
)
on conflict (email) do nothing;

-- Update profile roles after the trigger creates them
update public.profiles set role = 'admin', firm_name = 'LegalDocs Pro' 
where email = 'admin@legaldocs.test';

update public.profiles set role = 'fee_earner', firm_name = 'Gray''s Defence Solicitors' 
where email = 'feeearner@legaldocs.test';

update public.profiles set role = 'user', firm_name = 'Gray''s Defence Solicitors' 
where email = 'user@legaldocs.test';
