-- ─────────────────────────────────────────────────────────────────────────────
-- Seed: 30 фейковых студентов с разнообразной статистикой.
--
-- Зачем: проверка teacher dashboard, global leaderboard, аналитики и UI
-- на «живых» данных без необходимости вручную регистрировать пользователей.
--
-- Безопасность:
--   • Все email в зоне @atomedu.test (reserved TLD — никто не получит письма).
--   • encrypted_password = NULL ⇒ signInWithPassword вернёт invalid credentials.
--   • email_confirmed_at заполнен ⇒ пользователи не висят как unconfirmed.
--   • Префикс seed-student-NN ⇒ легко найти и удалить одним DELETE.
--
-- Чтобы откатить ВЕСЬ сид (CASCADE снесёт profiles, user_roles,
-- problem_attempts, lab_submissions, ai_hints):
--   DELETE FROM auth.users WHERE email LIKE 'seed-student-%@atomedu.test';
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1) 30 студентов в auth.users ──────────────────────────────────────────────
-- Триггер public.handle_new_user автоматически создаст profiles и user_roles
-- (role='student') для каждой строки. avatar_url берётся из
-- raw_user_meta_data->>'avatar_url'.

INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  gen_random_uuid(),
  'authenticated', 'authenticated',
  'seed-student-' || lpad(rn::text, 2, '0') || '@atomedu.test',
  NULL,
  now() - (random() * interval '60 days'),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', full_name, 'avatar_url', avatar_url),
  now() - (random() * interval '60 days'),
  now(),
  '', '', '', ''
FROM (
  SELECT
    row_number() OVER () AS rn,
    full_name,
    avatar_url
  FROM (VALUES
    ('Айгерім Нұрланқызы',     '/avatars/preset-bohr.svg'),
    ('Бекжан Сериков',         '/avatars/preset-nucleus.svg'),
    ('Дина Қалиева',           '/avatars/preset-orbital.svg'),
    ('Ерлан Мұратов',          '/avatars/preset-spectrum.svg'),
    ('Жанна Әбілова',          '/avatars/preset-water.svg'),
    ('Қайрат Сәдуақасов',      '/avatars/preset-wave.svg'),
    ('Лаура Тұрсынова',        '/avatars/preset-bohr.svg'),
    ('Мейіржан Оспанов',       '/avatars/preset-nucleus.svg'),
    ('Назерке Жұмабекова',     '/avatars/preset-orbital.svg'),
    ('Олжас Бекетов',          '/avatars/preset-spectrum.svg'),
    ('Перизат Сұлтанқызы',     '/avatars/preset-water.svg'),
    ('Рустам Кәрімов',         '/avatars/preset-wave.svg'),
    ('Сая Айдарова',           '/avatars/preset-bohr.svg'),
    ('Темірлан Қасенов',       '/avatars/preset-nucleus.svg'),
    ('Ұлжан Серікова',         '/avatars/preset-orbital.svg'),
    ('Фариза Бектұрсынова',    '/avatars/preset-spectrum.svg'),
    ('Хадиша Жарықбасова',     '/avatars/preset-water.svg'),
    ('Чингиз Әлімов',          '/avatars/preset-wave.svg'),
    ('Шынар Дәулетова',        '/avatars/preset-bohr.svg'),
    ('Эльдар Ибраев',          '/avatars/preset-nucleus.svg'),
    ('Юлия Орынбасарова',      '/avatars/preset-orbital.svg'),
    ('Ясмина Хайруллина',      '/avatars/preset-spectrum.svg'),
    ('Алмас Бөлекбаев',        '/avatars/preset-water.svg'),
    ('Балжан Тоқтарова',       '/avatars/preset-wave.svg'),
    ('Вадим Лиханов',          '/avatars/preset-bohr.svg'),
    ('Гүлжан Әбдікәрімова',    '/avatars/preset-nucleus.svg'),
    ('Дамир Шарипов',          '/avatars/preset-orbital.svg'),
    ('Елдос Қожахмет',         '/avatars/preset-spectrum.svg'),
    ('Зарина Бейсенова',       '/avatars/preset-water.svg'),
    ('Ислам Нұрғалиев',        '/avatars/preset-wave.svg')
  ) AS t(full_name, avatar_url)
) data;

-- ── 2) problem_attempts: 20–60 попыток на студента, разная «сила» ────────────
-- Каждый студент получает индивидуальный strength ∈ [0.2, 0.9] — доля
-- правильных ответов. «Слабые» решают мало и плохо, «сильные» — много и хорошо.

INSERT INTO public.problem_attempts (
  user_id, problem_id, topic_id, given_answer,
  is_correct, time_spent_seconds, created_at
)
SELECT
  u.id,
  p.id,
  p.topic_id,
  CASE
    WHEN random() < u.strength THEN COALESCE(p.expected_answer, ((random() * 100)::int)::text)
    ELSE ((random() * 100)::int)::text
  END,
  random() < u.strength,
  30 + (random() * 900)::int,
  now() - (random() * interval '45 days')
FROM (
  SELECT
    id,
    0.2 + random() * 0.7 AS strength
  FROM auth.users
  WHERE email LIKE 'seed-student-%@atomedu.test'
) u
CROSS JOIN LATERAL (
  SELECT id, topic_id, expected_answer
  FROM public.problems
  ORDER BY random()
  LIMIT (20 + (random() * 40)::int)
) p;

-- ── 3) lab_submissions: 3–8 на студента, ~60% уже проверено учителем ─────────

INSERT INTO public.lab_submissions (
  user_id, lab_id, topic_id,
  report_text, score, teacher_comment, reviewed_at, submitted_at
)
SELECT
  u.id, l.id, l.topic_id,
  'Зертханалық жұмыс есебі. Тәжірибе нәтижелері кестеде келтірілген, ' ||
    'қателік ' || (random() * 5)::numeric(4,2) || '% шегінде.',
  CASE WHEN l.graded THEN 60 + (random() * 40)::int ELSE NULL END,
  CASE WHEN l.graded
       THEN 'Жақсы жұмыс. Қорытынды бөлімде есептеулерді кеңейту керек.'
       ELSE NULL END,
  CASE WHEN l.graded THEN now() - (random() * interval '10 days') ELSE NULL END,
  now() - (random() * interval '30 days')
FROM (
  SELECT id FROM auth.users WHERE email LIKE 'seed-student-%@atomedu.test'
) u
CROSS JOIN LATERAL (
  SELECT id, topic_id, random() < 0.65 AS graded
  FROM public.labs
  ORDER BY random()
  LIMIT (3 + (random() * 5)::int)
) l;

-- ── 4) ai_hints: 0–12 записей на студента ────────────────────────────────────

INSERT INTO public.ai_hints (
  user_id, problem_id, level, response_text, model, created_at
)
SELECT
  u.id, p.id,
  1 + (random() * 2)::int,
  'Бұл есепті шығару үшін негізгі формуланы пайдаланыңыз. ' ||
    'Берілгенді SI жүйесіне аударыңыз.',
  'llama-3.3-70b-versatile',
  now() - (random() * interval '20 days')
FROM (
  SELECT id FROM auth.users WHERE email LIKE 'seed-student-%@atomedu.test'
) u
CROSS JOIN LATERAL (
  SELECT id
  FROM public.problems
  ORDER BY random()
  LIMIT (random() * 12)::int
) p;

COMMIT;

-- ── Sanity-check после применения ─────────────────────────────────────────────
-- SELECT count(*)                                                     FROM auth.users           WHERE email LIKE 'seed-student-%@atomedu.test';   -- ожидаем 30
-- SELECT count(*) FROM profiles         WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE 'seed-student-%@atomedu.test');             -- ожидаем 30
-- SELECT count(*) FROM problem_attempts WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE 'seed-student-%@atomedu.test');             -- ожидаем ~1200
-- SELECT count(*) FROM lab_submissions  WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE 'seed-student-%@atomedu.test');             -- ожидаем ~165
-- SELECT count(*) FROM ai_hints         WHERE user_id IN (SELECT id FROM auth.users WHERE email LIKE 'seed-student-%@atomedu.test');             -- ожидаем ~180
