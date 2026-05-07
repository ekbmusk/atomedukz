-- ─────────────────────────────────────────────────────────────────────────────
-- AI tutor — per-request audit / quota table.
--
-- The Edge Function `ai-hint` (Deno) reads `problems.expected_answer` with
-- service-role and then logs each generated hint here. The row count over
-- the last 24h drives the per-student daily quota (10/day in app code).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE public.ai_hints (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id    UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  level         INT  NOT NULL CHECK (level BETWEEN 1 AND 3),
  response_text TEXT NOT NULL,
  model         TEXT,
  tokens_input  INT,
  tokens_output INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_hints_user_idx ON public.ai_hints(user_id, created_at DESC);
CREATE INDEX ai_hints_problem_idx ON public.ai_hints(problem_id);

ALTER TABLE public.ai_hints ENABLE ROW LEVEL SECURITY;

-- Students see their own request history (so the UI can show "X requests
-- left today" without an extra round trip), teachers see everyone's for
-- moderation/analytics.
CREATE POLICY "ai_hints visible to self or teacher" ON public.ai_hints
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'teacher'));

-- INSERTs come from the Edge Function with service-role; intentionally no
-- INSERT policy for the regular authenticated role so a malicious client
-- can't forge hint records (which would inflate quota usage for others or
-- attribute fake hints to a peer).
