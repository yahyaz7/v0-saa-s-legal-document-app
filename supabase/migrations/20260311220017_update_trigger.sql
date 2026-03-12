-- =========================================
-- 18. UPDATE AUTH TRIGGER FOR SUPER ADMIN
-- Reads role + firm_id from app_metadata set
-- by auth.admin.createUser() calls.
-- =========================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
    v_firm_id   uuid;
    v_role_id   uuid;
    v_role_name text;
begin
    -- Read role from app_metadata (set via service role createUser call)
    v_role_name := new.raw_app_meta_data ->> 'role';

    if v_role_name = 'super_admin' then
        -- Super admin: no firm, super_admin role
        v_firm_id := null;
        select id into v_role_id from roles where name = 'super_admin' limit 1;

    else
        -- Resolve firm_id: prefer app_metadata.firm_id, fallback to default firm
        if (new.raw_app_meta_data ->> 'firm_id') is not null then
            v_firm_id := (new.raw_app_meta_data ->> 'firm_id')::uuid;
        else
            select id into v_firm_id from firms where slug = 'grays-defence' limit 1;
        end if;

        -- Resolve role_id: prefer app_metadata.role, fallback to staff
        if v_role_name is not null and v_role_name <> '' then
            select id into v_role_id from roles where name = v_role_name limit 1;
        end if;

        if v_role_id is null then
            select id into v_role_id from roles where name = 'staff' limit 1;
        end if;
    end if;

    insert into public.users (id, firm_id, role_id, name, email, password_hash, is_active)
    values (
        new.id,
        v_firm_id,
        v_role_id,
        coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
        new.email,
        '', -- Supabase Auth owns the real hash
        true
    );

    return new;
end;
$$;

-- Re-attach trigger (idempotent)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
