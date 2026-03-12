-- =========================================
-- 20. SEED SUPER ADMIN (runs at migration time)
--
-- Creates the platform super admin in auth.users.
-- The handle_new_user() trigger fires automatically
-- and creates the matching public.users row.
--
-- Default credentials:
--   Email:    superadmin@legaldocspro.com
--   Password: SuperAdmin123!
--
-- !! Change the password on first login !!
-- =========================================

do $$
declare
    v_id uuid := '00000000-0000-0000-0000-000000000099';
begin
    -- Idempotent: skip if already exists
    if exists (select 1 from auth.users where id = v_id) then
        return;
    end if;

    -- 1. Insert into Supabase auth.users
    insert into auth.users (
        instance_id,
        id,
        aud,
        role,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_app_meta_data,
        raw_user_meta_data,
        created_at,
        updated_at,
        confirmation_token,
        email_change,
        email_change_token_new,
        recovery_token
    ) values (
        '00000000-0000-0000-0000-000000000000',  -- instance_id (always this value)
        v_id,
        'authenticated',
        'authenticated',
        'superadmin@legaldocspro.com',
        crypt('SuperAdmin123!', gen_salt('bf')),  -- bcrypt via pgcrypto
        now(),                                    -- email pre-confirmed
        '{"provider":"email","providers":["email"],"role":"super_admin"}',
        '{"full_name":"Super Admin"}',
        now(),
        now(),
        '', '', '', ''
    );

    -- 2. Identity row required for email/password sign-in to work
    insert into auth.identities (
        id,
        user_id,
        provider_id,
        identity_data,
        provider,
        last_sign_in_at,
        created_at,
        updated_at
    ) values (
        gen_random_uuid(),
        v_id,
        'superadmin@legaldocspro.com',  -- provider_id for email = email address
        jsonb_build_object(
            'sub',            v_id::text,
            'email',          'superadmin@legaldocspro.com',
            'email_verified', true,
            'phone_verified', false
        ),
        'email',
        now(),
        now(),
        now()
    );

    -- NOTE: public.users row is created automatically by the
    -- handle_new_user() trigger (migration 20260311220017).
    -- It will set firm_id = NULL and role = super_admin.

end $$;
