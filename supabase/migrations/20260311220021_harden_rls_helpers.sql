-- =========================================
-- HARDEN RLS HELPERS
-- Ensures RLS works even if JWT claims (app_metadata) are missing
-- =========================================

-- Robust Version of get_my_firm_id
-- Checks JWT first (fastest), falls back to DB query
create or replace function public.get_my_firm_id()
returns uuid
language plpgsql
security definer
stable
as $$
declare
    _firm_id uuid;
begin
    -- 1. Try JWT claim
    _firm_id := (auth.jwt() -> 'app_metadata' ->> 'firm_id')::uuid;
    if _firm_id is not null then
        return _firm_id;
    end if;

    -- 2. Fallback: Query users table
    select firm_id into _firm_id from public.users where id = auth.uid();
    return _firm_id;
end;
$$;

-- Robust Version of is_super_admin
create or replace function public.is_super_admin()
returns boolean
language plpgsql
security definer
stable
as $$
declare
    _role text;
begin
    -- 1. Try JWT claim
    _role := auth.jwt() -> 'app_metadata' ->> 'role';
    if _role = 'super_admin' then
        return true;
    end if;

    -- 2. Fallback: Query roles table via users
    return exists (
        select 1 from public.users u
        join public.roles r on u.role_id = r.id
        where u.id = auth.uid() and r.name = 'super_admin'
    );
end;
$$;

-- Robust Version of is_firm_admin
create or replace function public.is_firm_admin()
returns boolean
language plpgsql
security definer
stable
as $$
declare
    _role text;
begin
    -- 1. Try JWT claim
    _role := auth.jwt() -> 'app_metadata' ->> 'role';
    if _role = 'admin' then
        return true;
    end if;

    -- 2. Fallback: Query roles table via users
    return exists (
        select 1 from public.users u
        join public.roles r on u.role_id = r.id
        where u.id = auth.uid() and r.name = 'admin'
    );
end;
$$;
