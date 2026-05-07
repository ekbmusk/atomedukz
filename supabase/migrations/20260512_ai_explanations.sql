-- 20260512_ai_explanations.sql
--
-- Stores AI-generated explanations of *wrong* student answers, so that
-- when the auto-grader marks an attempt as incorrect we can offer a
-- "почему" without burning the daily hint quota. Distinct from `ai_hints`
-- because: (a) different prompt, (b) keyed by (problem, given_answer) so
-- repeats are cached, (c) not subject to the 10/day cap.

CREATE TABLE public.ai_explanations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_id    UUID NOT NULL REFERENCES public.problems(id) ON DELETE CASCADE,
  given_answer  TEXT NOT NULL,
  response_text TEXT NOT NULL,
  model         TEXT,
  tokens_input  INT,
  tokens_output INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup index for cache hits: same student, same problem, same wrong
-- answer string → reuse previous explanation.
CREATE INDEX ai_explanations_cache_idx
  ON public.ai_explanations(user_id, problem_id, given_answer);

ALTER TABLE public.ai_explanations ENABLE ROW LEVEL SECURITY;

-- Students see own; teachers see all (audit).
CREATE POLICY "ai_explanations readable" ON public.ai_explanations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'teacher'));

-- INSERTs come from the Edge Function via service role; no insert policy
-- for the regular authenticated path (would let students forge entries).
