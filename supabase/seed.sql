-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: minimal test users (atomsite)
-- Runs after all migrations on `supabase db reset`
-- ─────────────────────────────────────────────────────────────────────────────

-- Test student (password: 81geniyA)
DO $$
DECLARE
  _uid uuid := 'a1b2c3d4-0000-4000-8000-000000000001';
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new,
    email_change, phone, phone_change, phone_change_token,
    is_super_admin
  ) VALUES (
    _uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'student@atomsite.local',
    crypt('81geniyA', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Айдана"}',
    '', '', '',
    '', NULL, '', '',
    false
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), _uid, _uid::text,
    jsonb_build_object('sub', _uid::text, 'email', 'student@atomsite.local'),
    'email', now(), now(), now()
  ) ON CONFLICT DO NOTHING;

  UPDATE public.profiles
  SET full_name = 'Айдана', group_name = 'PHYS-301'
  WHERE user_id = _uid;
END $$;

-- Test teacher (password: 81geniyA)
DO $$
DECLARE
  _uid uuid := 'a1b2c3d4-0000-4000-8000-000000000002';
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new,
    email_change, phone, phone_change, phone_change_token,
    is_super_admin
  ) VALUES (
    _uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'teacher@atomsite.local',
    crypt('81geniyA', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Дәурен Қанатұлы"}',
    '', '', '',
    '', NULL, '', '',
    false
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), _uid, _uid::text,
    jsonb_build_object('sub', _uid::text, 'email', 'teacher@atomsite.local'),
    'email', now(), now(), now()
  ) ON CONFLICT DO NOTHING;

  UPDATE public.profiles
  SET full_name = 'Дәурен Қанатұлы'
  WHERE user_id = _uid;

  -- Promote to teacher
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'teacher')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Remove the auto-assigned 'student' role
  DELETE FROM public.user_roles WHERE user_id = _uid AND role = 'student';
END $$;
