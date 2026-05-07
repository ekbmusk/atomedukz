-- ─────────────────────────────────────────────────────────────────────────────
-- Atomsite: domain schema (atomic & molecular physics course)
--
-- 15 topics × {lecture (slide PNGs), problems, lab, quiz, PhET sims, videos}
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Topics ───────────────────────────────────────────────────────────────────
CREATE TABLE public.topics (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number  INT NOT NULL UNIQUE CHECK (week_number BETWEEN 1 AND 15),
  title_kz     TEXT NOT NULL,
  title_ru     TEXT,
  description_kz  TEXT,
  description_ru  TEXT,
  learning_objectives JSONB DEFAULT '[]'::jsonb,
  lecture_pdf_url     TEXT,
  slides_storage_path TEXT,         -- e.g. "topic-01/slides/" — PNGs inside
  slides_count        INT DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topics readable by authenticated" ON public.topics
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "topics writable by teachers" ON public.topics
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'));

-- ── Videos (per topic) ───────────────────────────────────────────────────────
CREATE TABLE public.videos (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id   UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  title_kz   TEXT NOT NULL,
  title_ru   TEXT,
  url        TEXT NOT NULL,
  duration_seconds INT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX videos_topic_idx ON public.videos(topic_id);
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "videos readable by authenticated" ON public.videos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "videos writable by teachers" ON public.videos
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'));

-- ── PhET simulations (per topic) ─────────────────────────────────────────────
CREATE TABLE public.phet_simulations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id   UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  sim_id     TEXT NOT NULL,             -- e.g. "build-an-atom"
  title_kz   TEXT NOT NULL,
  title_ru   TEXT,
  description_kz TEXT,
  description_ru TEXT,
  default_lang TEXT NOT NULL DEFAULT 'ru' CHECK (default_lang IN ('kk', 'ru', 'en')),
  sort_order INT DEFAULT 0
);
CREATE INDEX phet_topic_idx ON public.phet_simulations(topic_id);
ALTER TABLE public.phet_simulations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phet readable by authenticated" ON public.phet_simulations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "phet writable by teachers" ON public.phet_simulations
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'));

-- ── Problems (per topic, with difficulty levels) ─────────────────────────────
CREATE TABLE public.problems (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id      UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  problem_text_kz TEXT NOT NULL,
  problem_text_ru TEXT,
  expected_answer TEXT,                 -- numeric string or short text
  unit          TEXT,                   -- e.g. "эВ", "нм"
  tolerance     NUMERIC,                -- relative tolerance for numeric answers
  weight        NUMERIC NOT NULL DEFAULT 1.0,
  difficulty    INT NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  solution_steps JSONB DEFAULT '[]'::jsonb,
  sort_order    INT DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX problems_topic_diff_idx ON public.problems(topic_id, difficulty);
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "problems readable by authenticated" ON public.problems
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "problems writable by teachers" ON public.problems
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'));

-- ── Problem attempts (student submissions) ───────────────────────────────────
CREATE TABLE public.problem_attempts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id   UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  topic_id     UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  given_answer TEXT,
  is_correct   BOOLEAN NOT NULL DEFAULT false,
  time_spent_seconds INT,
  anti_cheat   JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pa_user_idx ON public.problem_attempts(user_id);
CREATE INDEX pa_topic_idx ON public.problem_attempts(topic_id);
ALTER TABLE public.problem_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students see own attempts" ON public.problem_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "students insert own attempts" ON public.problem_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ── Labs (one per topic) ─────────────────────────────────────────────────────
CREATE TABLE public.labs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id        UUID NOT NULL UNIQUE REFERENCES public.topics(id) ON DELETE CASCADE,
  title_kz        TEXT NOT NULL,
  title_ru        TEXT,
  theory_kz       TEXT,
  theory_ru       TEXT,
  procedure_kz    TEXT,
  procedure_ru    TEXT,
  expected_results JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.labs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "labs readable by authenticated" ON public.labs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "labs writable by teachers" ON public.labs
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'teacher'))
  WITH CHECK (public.has_role(auth.uid(), 'teacher'));

-- ── Lab submissions ──────────────────────────────────────────────────────────
CREATE TABLE public.lab_submissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lab_id       UUID NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  topic_id     UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  report_text  TEXT,
  report_file_url TEXT,
  data         JSONB,                   -- captured measurements
  score        INT CHECK (score BETWEEN 0 AND 100),
  teacher_comment TEXT,
  reviewed_by  UUID REFERENCES auth.users(id),
  reviewed_at  TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ls_user_idx ON public.lab_submissions(user_id);
ALTER TABLE public.lab_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students see own lab subs" ON public.lab_submissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "students insert own lab subs" ON public.lab_submissions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "teachers update lab subs" ON public.lab_submissions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'teacher'));

-- ── Quiz attempts (per topic, summary of problem attempts) ───────────────────
CREATE TABLE public.quiz_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id      UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  level         INT NOT NULL CHECK (level BETWEEN 1 AND 3),
  score         INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  total_questions INT NOT NULL,
  correct_count   INT NOT NULL,
  per_question  JSONB NOT NULL,         -- [{problem_id, given, correct, time_s}]
  anti_cheat    JSONB,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX qa_user_idx ON public.quiz_attempts(user_id);
CREATE INDEX qa_topic_idx ON public.quiz_attempts(topic_id);
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students see own quiz attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'teacher'));
CREATE POLICY "students insert own quiz attempts" ON public.quiz_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ── Group visibility: students see peers' progress in same group_name ────────
CREATE POLICY "peers see quiz attempts in same group" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (
    user_id IN (
      SELECT p.user_id FROM public.profiles p
      WHERE p.group_name = (SELECT group_name FROM public.profiles WHERE user_id = auth.uid())
        AND p.group_name IS NOT NULL
    )
  );

-- ── Storage bucket for lecture slide PNGs ────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('lecture-slides', 'lecture-slides', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read lecture-slides"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'lecture-slides');

CREATE POLICY "Teachers upload lecture-slides"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lecture-slides' AND public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers update lecture-slides"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'lecture-slides' AND public.has_role(auth.uid(), 'teacher'));

CREATE POLICY "Teachers delete lecture-slides"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'lecture-slides' AND public.has_role(auth.uid(), 'teacher'));

-- ── Storage bucket for student lab reports ───────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('lab-reports', 'lab-reports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Students upload own lab reports"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'lab-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Students read own lab reports"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'lab-reports' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'teacher')));
