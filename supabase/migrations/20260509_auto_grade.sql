-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-grading for `problem_attempts`.
--
-- Goal: shift the bulk of "is this answer correct?" decisions off the
-- teacher's plate. When the teacher set `expected_answer` on a problem,
-- the server now checks the student's answer at submit time (numeric with
-- relative tolerance, falling back to case-insensitive string compare).
-- The teacher only sees:
--   • problems without `expected_answer` (open-ended → still manual)
--   • attempts where the student pressed "Оспорить" (`disputed = true`)
--
-- Security: `expected_answer` never leaves the database. Submit goes
-- through a SECURITY DEFINER RPC that grades server-side and writes the
-- attempt row; the client only learns `is_correct`/`auto_graded`.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Allow NULL is_correct so we can distinguish "pending teacher review"
--    from "graded as wrong". Existing rows keep their boolean.
ALTER TABLE public.problem_attempts ALTER COLUMN is_correct DROP NOT NULL;
ALTER TABLE public.problem_attempts ALTER COLUMN is_correct DROP DEFAULT;

-- 2) Track student's request for human review of an auto-graded attempt.
ALTER TABLE public.problem_attempts
  ADD COLUMN IF NOT EXISTS disputed BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS pa_disputed_idx
  ON public.problem_attempts(disputed)
  WHERE disputed = true;

-- 3) Submit + auto-grade RPC. Inserts the attempt and returns just the
--    grading verdict (never the expected_answer itself).
CREATE OR REPLACE FUNCTION public.submit_problem_answer(
  p_problem_id    UUID,
  p_given_answer  TEXT,
  p_time_seconds  INT DEFAULT NULL
)
RETURNS TABLE (
  attempt_id   UUID,
  is_correct   BOOLEAN,
  auto_graded  BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_problem  RECORD;
  v_correct  BOOLEAN;
  v_auto     BOOLEAN := false;
  v_attempt  UUID;
  v_student  NUMERIC;
  v_expected NUMERIC;
  v_tol      NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT id, topic_id, expected_answer, tolerance
    INTO v_problem
    FROM public.problems
   WHERE id = p_problem_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'problem not found';
  END IF;

  IF v_problem.expected_answer IS NOT NULL AND length(trim(v_problem.expected_answer)) > 0 THEN
    v_auto := true;
    -- Try numeric compare first (Cyrillic comma decimals → dots).
    BEGIN
      v_student  := replace(trim(p_given_answer),       ',', '.')::NUMERIC;
      v_expected := replace(trim(v_problem.expected_answer), ',', '.')::NUMERIC;
      v_tol      := COALESCE(v_problem.tolerance, 0.05);
      IF v_expected = 0 THEN
        v_correct := abs(v_student - v_expected) <= v_tol;
      ELSE
        v_correct := abs(v_student - v_expected) / abs(v_expected) <= v_tol;
      END IF;
    EXCEPTION WHEN others THEN
      -- Fall back to case-insensitive trimmed string equality.
      v_correct := lower(trim(p_given_answer)) = lower(trim(v_problem.expected_answer));
    END;
  ELSE
    v_correct := NULL;
  END IF;

  INSERT INTO public.problem_attempts (
    user_id, problem_id, topic_id, given_answer,
    is_correct, time_spent_seconds, reviewed_at
  ) VALUES (
    v_user_id, v_problem.id, v_problem.topic_id, p_given_answer,
    v_correct, p_time_seconds,
    CASE WHEN v_auto THEN now() ELSE NULL END
  )
  RETURNING id INTO v_attempt;

  RETURN QUERY SELECT v_attempt, v_correct, v_auto;
END $$;

GRANT EXECUTE ON FUNCTION public.submit_problem_answer(UUID, TEXT, INT) TO authenticated;

-- 4) Dispute RPC — student flags an auto-graded attempt for human review.
--    Resets `reviewed_at` so it shows up in the teacher's queue again.
CREATE OR REPLACE FUNCTION public.dispute_problem_attempt(p_attempt_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.problem_attempts
     SET disputed = true,
         reviewed_at = NULL,
         reviewed_by = NULL
   WHERE id = p_attempt_id
     AND user_id = v_user_id;
END $$;

GRANT EXECUTE ON FUNCTION public.dispute_problem_attempt(UUID) TO authenticated;
