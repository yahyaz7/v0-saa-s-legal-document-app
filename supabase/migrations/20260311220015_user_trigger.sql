-- =========================================
-- 16. INIT AUTH TRIGGER
-- Automatically clones new auth.users into public.users
-- =========================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
    default_firm_id uuid;
    default_role_id uuid;
begin
    -- 1. Grab the default firm (Gray's Defence) from seed
    select id into default_firm_id from firms where slug = 'grays-defence' limit 1;
    
    -- 2. Grab the default 'staff' role
    select id into default_role_id from roles where name = 'staff' limit 1;

    -- 3. Insert into the public.users table
    -- Using the user's raw_user_meta_data if available, otherwise 'New User'
    insert into public.users (id, firm_id, role_id, name, email, password_hash, is_active)
    values (
        new.id,
        default_firm_id,
        default_role_id,
        coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
        new.email,
        '', -- Leave empty as Supabase Auth inherently manages the real password hash
        true
    );
    
    return new;
end;
$$;

-- Create the trigger on the auth.users table
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();
