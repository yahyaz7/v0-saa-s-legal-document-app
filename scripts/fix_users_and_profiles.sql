-- ============================================================
-- COMPLETE USER SETUP FIX
-- ============================================================
-- Run this entire script in Supabase SQL Editor to:
-- 1. Create/fix the profiles table
-- 2. Set up auto-profile creation trigger
-- 3. Create test users with working passwords
-- 4. Sync existing auth.users to profiles
-- ============================================================

-- ------------------------------------------------------------
-- STEP 1: Create profiles table (if not exists)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique,
  full_name   text,
  role        text default 'user' check (role in ('admin', 'user', 'fee_earner')),
  firm_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Index for faster lookups
create index if not exists profiles_email_idx on public.profiles(email);

-- ------------------------------------------------------------
-- STEP 2: Enable RLS on profiles
-- ------------------------------------------------------------
alter table public.profiles enable row level security;

-- Drop existing policies if they exist (to avoid conflicts)
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Service role can insert profiles" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;

-- Recreate policies
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Service role can insert profiles"
  on public.profiles for insert
  to service_role
  with check (true);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- ------------------------------------------------------------
-- STEP 3: Create set_updated_at function (if not exists)
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Updated_at trigger for profiles
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- STEP 4: Auto-create profile on user signup
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Trigger to call handle_new_user on auth.users insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- STEP 5: Sync existing auth.users to profiles
-- ------------------------------------------------------------
insert into public.profiles (id, email, full_name)
select 
  id,
  email,
  coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- STEP 6: Delete existing test users (clean slate)
-- ------------------------------------------------------------
delete from auth.users where email in (
  'admin@legaldocs.test',
  'feeearner@legaldocs.test', 
  'user@legaldocs.test'
);

-- ------------------------------------------------------------
-- STEP 7: Create test users with proper identities
-- NOTE: Supabase requires auth.identities for login to work
-- ------------------------------------------------------------

-- Admin user
do $$
declare
  admin_id uuid := gen_random_uuid();
begin
  -- Insert into auth.users
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    raw_app_meta_data,
    role,
    aud,
    confirmation_token,
    recovery_token,
    created_at,
    updated_at
  ) values (
    admin_id,
    '00000000-0000-0000-0000-000000000000',
    'admin@legaldocs.test',
    crypt('Admin123!', gen_salt('bf')),
    now(),
    '{"full_name": "Admin User"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    'authenticated',
    'authenticated',
    '',
    '',
    now(),
    now()
  );
  
  -- Insert identity for email provider
  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    admin_id,
    jsonb_build_object('sub', admin_id, 'email', 'admin@legaldocs.test'),
    'email',
    admin_id::text,
    now(),
    now(),
    now()
  );
  
  -- Update profile role
  update public.profiles 
  set role = 'admin', firm_name = 'LegalDocs Pro'
  where id = admin_id;
end $$;

-- Fee Earner user
do $$
declare
  fee_earner_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    raw_app_meta_data,
    role,
    aud,
    confirmation_token,
    recovery_token,
    created_at,
    updated_at
  ) values (
    fee_earner_id,
    '00000000-0000-0000-0000-000000000000',
    'feeearner@legaldocs.test',
    crypt('FeeEarner123!', gen_salt('bf')),
    now(),
    '{"full_name": "John Gray"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    'authenticated',
    'authenticated',
    '',
    '',
    now(),
    now()
  );
  
  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    fee_earner_id,
    jsonb_build_object('sub', fee_earner_id, 'email', 'feeearner@legaldocs.test'),
    'email',
    fee_earner_id::text,
    now(),
    now(),
    now()
  );
  
  update public.profiles 
  set role = 'fee_earner', firm_name = 'Gray''s Defence Solicitors'
  where id = fee_earner_id;
end $$;

-- Regular user
do $$
declare
  user_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    raw_app_meta_data,
    role,
    aud,
    confirmation_token,
    recovery_token,
    created_at,
    updated_at
  ) values (
    user_id,
    '00000000-0000-0000-0000-000000000000',
    'user@legaldocs.test',
    crypt('User123!', gen_salt('bf')),
    now(),
    '{"full_name": "Sarah Smith"}'::jsonb,
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    'authenticated',
    'authenticated',
    '',
    '',
    now(),
    now()
  );
  
  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    user_id,
    jsonb_build_object('sub', user_id, 'email', 'user@legaldocs.test'),
    'email',
    user_id::text,
    now(),
    now(),
    now()
  );
  
  update public.profiles 
  set role = 'user', firm_name = 'Gray''s Defence Solicitors'
  where id = user_id;
end $$;

-- ------------------------------------------------------------
-- VERIFICATION: Check results
-- ------------------------------------------------------------
select 'AUTH USERS:' as info;
select id, email, created_at from auth.users order by created_at desc limit 5;

select 'PROFILES:' as info;
select id, email, full_name, role, firm_name from public.profiles order by created_at desc limit 5;

select 'IDENTITIES:' as info;
select user_id, provider, created_at from auth.identities order by created_at desc limit 5;
