-- ============================================================
-- Doctor Bridge — Super Admin Seed Script
-- Run this in: Supabase Dashboard → SQL Editor
--
-- Creates a fresh super_admin account.
-- Credentials:
--   Email    : superadmin@doctorbridge.com
--   Password : DoctorBridge@2026!
--
-- After running, log in at /login with the above credentials.
-- The account will see all pending hospitals, unverified doctors,
-- and platform-wide analytics automatically via RLS policies.
-- ============================================================

DO $$
DECLARE
  v_user_id      UUID;
  v_platform_id  UUID := '00000000-0000-0000-0000-000000000001';
  v_email        TEXT := 'superadmin@doctorbridge.com';
  v_password     TEXT := 'DoctorBridge@2026!';
BEGIN

  -- ── 1. Ensure the platform "meta-clinic" exists ─────────────────────
  --    user_roles.clinic_id is NOT NULL + FK to clinics.
  --    Super admins aren't tied to any real clinic, so we anchor them
  --    to a fixed internal record that is never shown in the UI.
  INSERT INTO public.clinics (
    id, name, slug, email,
    plan, is_active, verification_status,
    settings, created_at, updated_at
  ) VALUES (
    v_platform_id,
    'Doctor Bridge Platform',
    'doctorbridge-platform',
    'platform@doctorbridge.com',
    'ENTERPRISE',
    true,
    'ACTIVE',
    '{}',
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── 2. Skip if super admin already exists ───────────────────────────
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;

  IF v_user_id IS NOT NULL THEN
    RAISE NOTICE 'Super admin already exists (id: %)', v_user_id;

    -- Still ensure the role row is present (idempotent)
    INSERT INTO public.user_roles (user_id, clinic_id, role)
    VALUES (v_user_id, v_platform_id, 'super_admin')
    ON CONFLICT DO NOTHING;

  ELSE

    -- ── 3. Create the auth user ────────────────────────────────────────
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change,
      email_change_token_new,
      email_change_token_current,
      phone,
      phone_change,
      reauthentication_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"first_name":"Platform","last_name":"Admin"}',
      'authenticated',
      'authenticated',
      now(),
      now(),
      '', '', '', '', '', '', '', ''
    );

    -- ── 4. Create auth.identities row (required by Supabase Auth) ─────
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      v_email,
      jsonb_build_object('sub', v_user_id, 'email', v_email),
      'email',
      now(),
      now(),
      now()
    );

    -- ── 5. Create the profile ──────────────────────────────────────────
    INSERT INTO public.profiles (
      id,
      email,
      first_name,
      last_name,
      account_type,
      clinic_id,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_email,
      'Platform',
      'Admin',
      'clinic_staff',
      NULL,
      true,
      now(),
      now()
    );

    -- ── 6. Assign super_admin role (anchored to platform meta-clinic) ──
    INSERT INTO public.user_roles (user_id, clinic_id, role)
    VALUES (v_user_id, v_platform_id, 'super_admin')
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '✓ Super admin created successfully';
    RAISE NOTICE '  ID       : %', v_user_id;
    RAISE NOTICE '  Email    : %', v_email;
    RAISE NOTICE '  Password : %', v_password;

  END IF;

END $$;


-- ============================================================
-- Pending work summary — what the super admin will see
-- ============================================================

SELECT
  'PENDING INSTITUTIONS'                     AS category,
  count(*)::text                             AS count
FROM public.clinics
WHERE verification_status = 'PENDING'
  AND id != '00000000-0000-0000-0000-000000000001'

UNION ALL

SELECT 'ACTIVE INSTITUTIONS', count(*)::text
FROM public.clinics
WHERE verification_status = 'ACTIVE'
  AND id != '00000000-0000-0000-0000-000000000001'

UNION ALL

SELECT 'SUSPENDED INSTITUTIONS', count(*)::text
FROM public.clinics
WHERE verification_status = 'SUSPENDED'

UNION ALL

SELECT 'UNVERIFIED DOCTORS (nmc_verified = false/null)', count(*)::text
FROM public.doctor_profiles
WHERE nmc_verified = false OR nmc_verified IS NULL

UNION ALL

SELECT 'NMC-VERIFIED DOCTORS', count(*)::text
FROM public.doctor_profiles
WHERE nmc_verified = true

UNION ALL

SELECT 'PENDING AFFILIATION REQUESTS', count(*)::text
FROM public.affiliation_requests
WHERE status = 'PENDING'

UNION ALL

SELECT 'TOTAL REFERRALS (all time)', count(*)::text
FROM public.referrals

ORDER BY category;
